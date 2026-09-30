import { DurableObject } from "cloudflare:workers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./worker.js";
import { coinNameFor, fetchMetaAndAssetCtxs, indexAssetCtxsByCoin } from "./hyperliquid.js";
import { decodeMarketStatus, type ListingStatus } from "./status.js";
import { evaluateFlags, type FlagMatch, type OracleSample } from "./flags.js";
import {
  fetchMarketStatuses,
  fetchPerpMarkets,
  insertOracleWatchEvents,
  insertPerpSnapshots,
  type OracleWatchEventInsert,
  type PerpMarketRow,
  type PerpSnapshotInsert,
} from "./db.js";

/** PRD §4.9/§8.6: this worker only ever polls trade.xyz's real HIP-3 dex, literally named "xyz". */
const DEX = "xyz";

/** PRD §8.6: "DO alarm every 5 s runs metaAndAssetCtxs for dex xyz." */
const POLL_INTERVAL_MS = 5_000;

/** How long the DO's own rolling sample window keeps price points for — comfortably over the 60s
 * lookback the flag rules need (§8.6). This is unrelated to perp_snapshots' 48h Supabase
 * retention (packages/db/supabase/migrations/20260927150300_retention.sql's daily prune job). */
const SAMPLE_RETENTION_SECONDS = 180;

interface QueuedFlag {
  market: PerpMarketRow;
  match: FlagMatch;
  primary: ListingStatus;
  secondaries: ListingStatus[];
}

export class Watcher extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS oracle_samples (
          market_name TEXT NOT NULL,
          t INTEGER NOT NULL,
          oracle_px REAL NOT NULL,
          PRIMARY KEY (market_name, t)
        )
      `);

      // Self-arming: a Durable Object only runs once something accesses it (here, the Worker's
      // GET /health — see src/worker.ts). This first alarm is the one external nudge the loop
      // ever needs; alarm() below re-arms its own successor every tick from then on.
      const existingAlarm = await this.ctx.storage.getAlarm();
      if (existingAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now());
      }
    });
  }

  /** RPC method the Worker's /health route calls. Idempotently ensures the poll loop is armed,
   * and reports enough to prove it's alive without waiting for a real flag. */
  async ping(): Promise<{ armed: boolean; sampledMarkets: number }> {
    const existingAlarm = await this.ctx.storage.getAlarm();
    if (existingAlarm === null) {
      await this.ctx.storage.setAlarm(Date.now());
    }

    const row = this.ctx.storage.sql.exec<{ n: number }>("SELECT COUNT(DISTINCT market_name) as n FROM oracle_samples").one();
    return { armed: true, sampledMarkets: row.n };
  }

  async alarm(): Promise<void> {
    try {
      await this.tick();
    } catch (error) {
      // Logged, not swallowed: observability (wrangler.jsonc) picks this up as a structured
      // Worker log. Re-arming unconditionally in `finally` — rather than letting the exception
      // propagate — keeps this DO's own 5s cadence in full control, instead of racing the
      // platform's separate automatic alarm-retry-on-throw backoff.
      console.error("Watcher tick failed", error);
    } finally {
      await this.ctx.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
    }
  }

  private async tick(): Promise<void> {
    const supabase = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY);
    const now = Math.floor(Date.now() / 1000);

    const markets = await fetchPerpMarkets(supabase, DEX);
    if (markets.length === 0) return; // perp_markets not seeded yet — nothing to poll or flag

    const assetCtxs = await fetchMetaAndAssetCtxs({ dex: DEX });
    const pricesByCoin = indexAssetCtxsByCoin(assetCtxs);

    const listingIds = new Set<string>();
    for (const market of markets) {
      if (market.primary_listing_id) listingIds.add(market.primary_listing_id);
      for (const id of market.underlying_listing_ids) listingIds.add(id);
    }
    const statusByListingId = await fetchMarketStatuses(supabase, [...listingIds]);

    const snapshotInserts: PerpSnapshotInsert[] = [];
    const queuedFlags: QueuedFlag[] = [];

    for (const market of markets) {
      const prices = pricesByCoin.get(coinNameFor(market.dex, market.name));
      if (!prices) continue; // unmapped on Hyperliquid's side right now — PRD's S07 "Market unmapped" state

      this.recordSample(market.name, now, prices.oraclePx);
      snapshotInserts.push({
        name: market.name,
        t: new Date(now * 1000).toISOString(),
        oracle_px: prices.oraclePx,
        mark_px: prices.markPx,
      });

      if (!market.primary_listing_id) continue; // can't evaluate any rule without a primary listing

      const primary = decodeMarketStatus(statusByListingId.get(market.primary_listing_id), market.primary_listing_id);
      const secondaries = market.underlying_listing_ids
        .filter((id) => id !== market.primary_listing_id)
        .map((id) => decodeMarketStatus(statusByListingId.get(id), id));
      const allListings = [primary, ...secondaries];

      const samples = this.readRecentSamples(market.name, now);
      const matches = evaluateFlags({ samples, now, primary, secondaries, allListings });
      for (const match of matches) {
        queuedFlags.push({ market, match, primary, secondaries });
      }
    }

    this.pruneOldSamples(now);

    await insertPerpSnapshots(supabase, snapshotInserts);
    if (queuedFlags.length > 0) {
      await this.publishFlags(supabase, queuedFlags);
    }
  }

  private recordSample(marketName: string, t: number, oraclePx: number): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO oracle_samples (market_name, t, oracle_px) VALUES (?, ?, ?)",
      marketName,
      t,
      oraclePx,
    );
  }

  private readRecentSamples(marketName: string, now: number): OracleSample[] {
    const rows = this.ctx.storage.sql
      .exec<{ t: number; oracle_px: number }>(
        "SELECT t, oracle_px FROM oracle_samples WHERE market_name = ? AND t >= ? ORDER BY t ASC",
        marketName,
        now - SAMPLE_RETENTION_SECONDS,
      )
      .toArray();
    return rows.map((r) => ({ t: r.t, oraclePx: r.oracle_px }));
  }

  private pruneOldSamples(now: number): void {
    this.ctx.storage.sql.exec("DELETE FROM oracle_samples WHERE t < ?", now - SAMPLE_RETENTION_SECONDS);
  }

  private async publishFlags(supabase: SupabaseClient, queuedFlags: QueuedFlag[]): Promise<void> {
    const eventRows: OracleWatchEventInsert[] = queuedFlags.map(({ market, match, primary, secondaries }) => ({
      name: market.name,
      flag: match.flag,
      window_start: new Date(match.windowStart * 1000).toISOString(),
      window_end: new Date(match.windowEnd * 1000).toISOString(),
      move_pct: match.movePct,
      status_context: {
        primary: statusContext(primary),
        secondaries: secondaries.map(statusContext),
      },
    }));

    await insertOracleWatchEvents(supabase, eventRows);

    await Promise.all(
      queuedFlags.map(({ market, match }) =>
        this.env.EVENTS_QUEUE.send({
          id: `evt_${crypto.randomUUID()}`,
          type: "oraclewatch.flagged",
          createdAt: new Date().toISOString(),
          data: {
            name: market.name,
            dex: market.dex,
            flag: match.flag,
            movePct: match.movePct,
            windowStart: new Date(match.windowStart * 1000).toISOString(),
            windowEnd: new Date(match.windowEnd * 1000).toISOString(),
          },
        }),
      ),
    );
  }
}

function statusContext(status: ListingStatus): { listingId: string; session: string; interruption: string } {
  return { listingId: status.listingId, session: status.session, interruption: status.interruption };
}
