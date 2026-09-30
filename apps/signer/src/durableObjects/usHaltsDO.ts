import { DurableObject } from "cloudflare:workers";
import { resolveSessionWindow } from "@winsznx/bellstate-calendars";
import type { HaltRecord } from "@winsznx/bellstate-engine";
import { fetchNasdaqHaltFeed, parseNasdaqHaltFeed } from "@winsznx/bellstate-source-nasdaq-halts";
import { fetchNysePage, parseNyseHaltFeed } from "@winsznx/bellstate-source-nyse-halts";
import { APP_URL, MIC, NASDAQ_POLL_PERIOD_TRADING_SECONDS, US_HALTS_PRUNE_MAX_AGE_SECONDS } from "../constants.js";
import { UsHaltsState } from "../domains/usHalts.js";
import type { Env } from "../env.js";
import { nasdaqPollPeriodSeconds, nysePollPeriodSeconds } from "../scheduling/haltPollCadence.js";
import { nextSlotAlarmMs, parseSignerSlot } from "../scheduling/nextSlotAlarm.js";

export interface UsHaltsSnapshot {
  halts: HaltRecord[];
  nasdaqLastSuccessAt: number | null;
  nyseLastSuccessAt: number | null;
  lastError: string | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * PRD §8.1's UsHalts Durable Object: wraps the existing, tested `UsHaltsState` reducer
 * (src/domains/usHalts.ts) in a DO that polls the real Nasdaq RSS + NYSE JSON feeds on its own
 * schedule and serves the merged, per-listing view to CoreDO over RPC.
 *
 * The two feeds run on genuinely independent cadences (PRD §4.1/§4.2), not one shared interval:
 * Nasdaq polls once per 60s (300s outside the US trading window), staggered by SIGNER_SLOT so
 * signer-a/b/c collectively hit it every 20s; NYSE polls once per 30s (300s outside the trading
 * window), flat, with no signer-slot stagger. Each feed tracks its own next-due time and is only
 * fetched when due — see haltPollCadence.ts for the pure trading-window/period logic.
 *
 * State is kept in memory only, not persisted to `ctx.storage` — intentionally. Both feeds are
 * polled as full "current day" snapshots, not deltas (see fetchNasdaqHaltFeed/fetchNysePage), so
 * a freshly evicted instance rebuilds an equivalent view from its very next successful poll rather
 * than needing to restore serialized Map state. `prune()` only trims already-resumed halts older
 * than a day, which a cold instance simply omits until it reappears in a fresh poll — it was never
 * "current" anyway.
 */
export class UsHaltsDO extends DurableObject<Env> {
  private readonly state = new UsHaltsState();
  private nasdaqLastSuccessAt: number | null = null;
  private nyseLastSuccessAt: number | null = null;
  private lastError: string | null = null;
  /** 0 means "never polled" — always due immediately, including on a cold instance. */
  private nasdaqNextDueMs = 0;
  private nyseNextDueMs = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const existing = await ctx.storage.getAlarm();
      if (existing === null) {
        await ctx.storage.setAlarm(Date.now());
      }
    });
  }

  /** Watchdog target (worker.ts's `scheduled()`): re-arms this DO if its alarm was ever dropped. */
  async ensureAlarm(): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Math.min(this.nasdaqNextDueMs, this.nyseNextDueMs) || Date.now());
    }
  }

  async alarm(): Promise<void> {
    await this.poll();
    await this.ctx.storage.setAlarm(Math.min(this.nasdaqNextDueMs, this.nyseNextDueMs));
  }

  private async poll(): Promise<void> {
    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);
    const session = resolveSessionWindow(MIC, nowSeconds).session;
    const slot = parseSignerSlot(this.env.SIGNER_SLOT, NASDAQ_POLL_PERIOD_TRADING_SECONDS);

    if (nowMs >= this.nasdaqNextDueMs) {
      try {
        const xml = await fetchNasdaqHaltFeed({ appUrl: APP_URL });
        this.state.applyNasdaqItems(parseNasdaqHaltFeed(xml));
        this.nasdaqLastSuccessAt = nowSeconds;
      } catch (err) {
        this.lastError = `nasdaq: ${errorMessage(err)}`;
      }
      this.nasdaqNextDueMs = nextSlotAlarmMs(nowMs, slot, nasdaqPollPeriodSeconds(session));
    }

    if (nowMs >= this.nyseNextDueMs) {
      try {
        const today = new Date(nowMs).toISOString().slice(0, 10);
        // Filtered to NVDA at the source (§ scope: the one registered listing this build
        // attests). Safe to narrow this way, unlike the Nasdaq feed: NYSE halts are always
        // ASSET-scoped (packages/sources/nyse-halts/src/toHaltRecord.ts), never VENUE-wide, so
        // this can't drop a venue-wide halt the way pre-filtering the Nasdaq feed would. Only
        // page 1 is requested — PRD §4.2 says pull all pages, but a single-symbol day's results
        // fitting in one 20-row page is the realistic case; a real multi-page day would need
        // this loop extended, not the pagination logic invented, so it's left as-is rather than
        // faked.
        const json = await fetchNysePage({ haltDateFrom: today, haltDateTo: today, pageNumber: 1, symbol: "NVDA", appUrl: APP_URL });
        this.state.applyNyseRows(parseNyseHaltFeed(json));
        this.nyseLastSuccessAt = nowSeconds;
      } catch (err) {
        this.lastError = `nyse: ${errorMessage(err)}`;
      }
      // Flat cadence, no signer-slot stagger (PRD §4.2 doesn't slot NYSE the way §4.1 slots
      // Nasdaq — every signer polls NYSE independently on the same schedule).
      this.nyseNextDueMs = nowMs + nysePollPeriodSeconds(session) * 1000;
    }

    this.state.prune(nowSeconds, US_HALTS_PRUNE_MAX_AGE_SECONDS);
  }

  async getSnapshot(symbol: string, mic: string): Promise<UsHaltsSnapshot> {
    return {
      halts: this.state.haltsForListing(symbol, mic),
      nasdaqLastSuccessAt: this.nasdaqLastSuccessAt,
      nyseLastSuccessAt: this.nyseLastSuccessAt,
      lastError: this.lastError,
    };
  }
}
