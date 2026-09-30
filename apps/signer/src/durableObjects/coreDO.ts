import { DurableObject } from "cloudflare:workers";
import { CALENDAR_VERSION, resolveSessionWindow } from "@winsznx/bellstate-calendars";
import type { Listing, MarketSnapshot } from "@winsznx/bellstate-engine";
import { bellstateDomain, epochOf, privateKeyToAccount, signMessage } from "@winsznx/bellstate-protocol";
import { toMarketSubject } from "../chain/marketViewToState.js";
import { LISTING_ID, MAX_CLOCK_SKEW_SECONDS, MIC, SYMBOL, CORE_TICK_INTERVAL_MS } from "../constants.js";
import { serializeMessage } from "../core/attestation.js";
import { type AggregatorPostResult, postToAggregators } from "../core/postToAggregators.js";
import { computeRefusalReasons } from "../core/refusal.js";
import { tick, type ListingSubject } from "../core/tick.js";
import { isSourceHealthy } from "../domains/sourceHealth.js";
import type { Env } from "../env.js";

interface AttestationPayload {
  kind: "MarketUpdate" | "Heartbeat";
  message: Record<string, unknown>;
  signature: `0x${string}`;
  observedAt: number;
  sourceTime: number;
  sourceRefs: string[];
}

export interface CoreStatus {
  lastTickAt: number | null;
  lastTickOk: boolean;
  refusalReasons: string[];
  lastError: string | null;
  updatesSent: number;
  heartbeatsSent: number;
  postResults: AggregatorPostResult[];
  signerAddress: `0x${string}`;
  calendarVersion: number;
  epoch: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * PRD §8.1's Core Durable Object: every 5s, pulls ChainDO's onchain view and UsHaltsDO's halt
 * snapshot, runs the engine, diffs against the hub, and signs + posts to AGGREGATOR_URLS.
 *
 * Scope: this build only ever constructs one ListingSubject (XNAS:NVDA, market facet). See
 * README.md for exactly why deriveProgram/derivePrimary/deriveValuation for xstocks:NVDAx aren't
 * wired up here — programs/primaries/valuations are passed to `tick()` as empty arrays, which is
 * the correct pattern for "no subjects registered", not a placeholder.
 *
 * This signer never holds a submitter key and never calls a hub write function (§6.5) — it signs
 * with SIGNER_PRIVATE_KEY and POSTs the result to AGGREGATOR_URLS; the aggregator is responsible
 * for collecting quorum and submitting onchain.
 */
export class CoreDO extends DurableObject<Env> {
  private status: CoreStatus;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const account = privateKeyToAccount(env.SIGNER_PRIVATE_KEY as `0x${string}`);
    this.status = {
      lastTickAt: null,
      lastTickOk: false,
      refusalReasons: [],
      lastError: null,
      updatesSent: 0,
      heartbeatsSent: 0,
      postResults: [],
      signerAddress: account.address,
      calendarVersion: CALENDAR_VERSION,
      epoch: "0",
    };

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
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  async alarm(): Promise<void> {
    await this.tick();
    await this.ctx.storage.setAlarm(Date.now() + CORE_TICK_INTERVAL_MS);
  }

  async getStatus(): Promise<CoreStatus> {
    return this.status;
  }

  private async tick(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const account = privateKeyToAccount(this.env.SIGNER_PRIVATE_KEY as `0x${string}`);

    let chainView: Awaited<ReturnType<typeof this.fetchChainView>>;
    let usHaltsSnapshot: Awaited<ReturnType<typeof this.fetchUsHaltsSnapshot>>;
    try {
      [chainView, usHaltsSnapshot] = await Promise.all([this.fetchChainView(), this.fetchUsHaltsSnapshot()]);
    } catch (err) {
      this.status = {
        ...this.status,
        lastTickAt: now,
        lastTickOk: false,
        lastError: `snapshot_fetch_failed: ${errorMessage(err)}`,
      };
      return;
    }

    const refusalReasons = computeRefusalReasons({
      localCalendarVersion: CALENDAR_VERSION,
      hubCalendarVersion: chainView.calendarVersion,
      nowSeconds: now,
      frozenUntil: chainView.frozenUntil,
      latestBlockTimestamp: chainView.latestBlockTimestamp,
      maxClockSkewSeconds: MAX_CLOCK_SKEW_SECONDS,
    });

    if (refusalReasons.length > 0) {
      this.status = {
        ...this.status,
        lastTickAt: now,
        lastTickOk: true,
        refusalReasons,
        lastError: null,
        signerAddress: account.address,
      };
      return;
    }

    const sessionWindow = resolveSessionWindow(MIC, now);
    const sourceHealthy =
      isSourceHealthy(now, usHaltsSnapshot.nasdaqLastSuccessAt, sessionWindow.session) &&
      isSourceHealthy(now, usHaltsSnapshot.nyseLastSuccessAt, sessionWindow.session);

    const listing: Listing = { listingId: LISTING_ID, mic: MIC, symbol: SYMBOL, aliases: [] };
    const snapshot: MarketSnapshot = { sourceHealthy, sessionWindow, halts: usHaltsSnapshot.halts };
    const { onchainSeq, onchainState } = toMarketSubject(chainView.marketView);

    const listingSubject: ListingSubject = {
      listing,
      domain: "US_MARKETS",
      snapshot,
      onchainSeq,
      onchainState,
    };

    const result = tick({
      t: now,
      calendarVersion: CALENDAR_VERSION,
      listings: [listingSubject],
      // PRD §8.1 also runs deriveProgram/derivePrimary/deriveValuation for xstocks:NVDAx —
      // deferred (see README.md). Empty arrays are the correct "no subjects registered for this
      // facet yet" input to `tick()`, not a stand-in for unfinished work.
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions: {
        US_MARKETS: { version: chainView.usMarketsDomainVersion },
        HK_MARKETS: { version: 0n },
        KR_MARKETS: { version: 0n },
        PROGRAMS: { version: 0n },
        PRIMARY: { version: 0n },
        VALUATION: { version: 0n },
      },
    });

    const domain = bellstateDomain(this.env.HUB_ADDRESS as `0x${string}`);
    const sourceTime = Math.min(usHaltsSnapshot.nasdaqLastSuccessAt ?? now, usHaltsSnapshot.nyseLastSuccessAt ?? now);
    const hubRef = `hub:${this.env.HUB_ADDRESS}`;

    const payloads: AttestationPayload[] = [];

    for (const u of result.marketUpdates) {
      const signature = await signMessage(account, "MarketUpdate", domain, u.message);
      payloads.push({
        kind: "MarketUpdate",
        message: serializeMessage(u.message),
        signature,
        observedAt: now,
        sourceTime,
        sourceRefs: ["nasdaq-trade-halts-rss", "nyse-trade-halts-historical-filter", hubRef],
      });
    }

    for (const hb of result.heartbeats) {
      const signature = await signMessage(account, "Heartbeat", domain, hb.message);
      payloads.push({
        kind: "Heartbeat",
        message: serializeMessage(hb.message),
        signature,
        observedAt: now,
        sourceTime: now,
        sourceRefs: [hubRef, `domain:${hb.domain}`],
      });
    }

    const postResults =
      payloads.length > 0
        ? await postToAggregators(this.env.AGGREGATOR_URLS, { signerAddress: account.address, attestations: payloads })
        : [];

    this.status = {
      lastTickAt: now,
      lastTickOk: true,
      refusalReasons: [],
      lastError: null,
      updatesSent: result.marketUpdates.length,
      heartbeatsSent: result.heartbeats.length,
      postResults,
      signerAddress: account.address,
      calendarVersion: CALENDAR_VERSION,
      epoch: epochOf(now).toString(),
    };
  }

  private async fetchChainView() {
    return this.env.CHAIN.getByName("chain").getView();
  }

  private async fetchUsHaltsSnapshot() {
    return this.env.US_HALTS.getByName("us-halts").getSnapshot(SYMBOL, MIC);
  }
}
