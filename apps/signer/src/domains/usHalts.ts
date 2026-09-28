import type { HaltRecord, ReasonCategory } from "@winsznx/bellstate-engine";
import type { NasdaqHaltItem } from "@winsznx/bellstate-source-nasdaq-halts";
import { classifyReasonCode, marketToMic } from "@winsznx/bellstate-source-nasdaq-halts";
import type { NyseHaltRow } from "@winsznx/bellstate-source-nyse-halts";
import { classifyNyseReason } from "@winsznx/bellstate-source-nyse-halts";

const MWC_CODES = new Set(["MWC0", "MWC1", "MWC2", "MWC3"]);

interface TrackedHalt {
  key: string; // `${symbol}|${haltAt}`
  symbol: string;
  mic: string;
  scope: "VENUE" | "ASSET";
  haltAt: number;
  resumeTradeAt: number | null;
  reasonCategory: ReasonCategory;
  reasonCode: string;
  /** Whether Nasdaq has posted a reasonCode for this key — once true, NYSE may no longer
   * overwrite it (§4.2: "Nasdaq's ReasonCode wins"). */
  reasonFromNasdaq: boolean;
}

/**
 * PRD §4.1/§4.2's cross-poll US halt state, kept by the signer's UsHalts Durable Object (this
 * module is the pure, DO-runtime-independent reducer the DO calls on each poll). See
 * packages/sources/{nasdaq,nyse}-halts's READMEs for why this state doesn't live in either
 * parser package.
 */
export class UsHaltsState {
  private halts = new Map<string, TrackedHalt>();

  private upsert(next: Omit<TrackedHalt, "key">): void {
    const key = `${next.symbol}|${next.haltAt}`;
    this.halts.set(key, { ...next, key });
  }

  private closeOpenVenueHalts(atOrBefore: number, resumeTradeAt: number): void {
    for (const halt of this.halts.values()) {
      if (halt.scope === "VENUE" && halt.resumeTradeAt === null && halt.haltAt <= atOrBefore) {
        halt.resumeTradeAt = resumeTradeAt;
      }
    }
  }

  /** §4.1: Nasdaq's fields always win for reasonCode/reasonCategory. MWCQ closes every
   * currently-open MWC0/1/2/3 venue-wide halt rather than describing a new one. */
  applyNasdaqItems(items: readonly NasdaqHaltItem[]): void {
    for (const item of items) {
      const info = classifyReasonCode(item.reasonCode);

      if (item.reasonCode === "MWCQ") {
        this.closeOpenVenueHalts(item.haltAt, item.haltAt);
        continue;
      }

      this.upsert({
        symbol: item.symbol,
        mic: marketToMic(item.market),
        scope: MWC_CODES.has(item.reasonCode) ? "VENUE" : "ASSET",
        haltAt: item.haltAt,
        resumeTradeAt: item.resumeTradeAt,
        reasonCategory: info.category,
        reasonCode: item.reasonCode,
        reasonFromNasdaq: true,
      });
    }
  }

  /** §4.2: NYSE fills a missing resumption and can trigger a halt Nasdaq hasn't posted yet, but
   * never overwrites a reasonCode Nasdaq already supplied. */
  applyNyseRows(rows: readonly NyseHaltRow[]): void {
    for (const row of rows) {
      const key = `${row.symbol}|${row.haltAt}`;
      const existing = this.halts.get(key);

      if (!existing) {
        const info = classifyNyseReason(row.reason);
        this.upsert({
          symbol: row.symbol,
          mic: row.sourceExchange,
          scope: "ASSET",
          haltAt: row.haltAt,
          resumeTradeAt: row.resumeTradeAt,
          reasonCategory: info.category,
          reasonCode: info.reasonCode,
          reasonFromNasdaq: false,
        });
        continue;
      }

      if (existing.resumeTradeAt === null && row.resumeTradeAt !== null) {
        existing.resumeTradeAt = row.resumeTradeAt;
      }
    }
  }

  /**
   * Halts relevant to one listing at time t: its own ASSET halts plus every VENUE-wide halt, in
   * the shape packages/engine's deriveMarket expects. §3.3: "MWC1, MWC2, MWC3 and MWC0 apply to
   * every US MIC" — a VENUE-scoped halt always applies here regardless of `mic`, since this
   * state only ever tracks halts sourced from the US family.
   */
  haltsForListing(symbol: string, _mic: string): HaltRecord[] {
    const out: HaltRecord[] = [];
    for (const halt of this.halts.values()) {
      const appliesToListing = halt.scope === "ASSET" && halt.symbol === symbol;
      const appliesToVenue = halt.scope === "VENUE";
      if (!appliesToListing && !appliesToVenue) continue;
      out.push({
        scope: halt.scope,
        haltAt: halt.haltAt,
        resumeTradeAt: halt.resumeTradeAt,
        reasonCategory: halt.reasonCategory,
        reasonCode: halt.reasonCode,
      });
    }
    return out;
  }

  /** Drops halts resumed more than `maxAgeSeconds` ago, so state doesn't grow without bound.
   * Open halts (resumeTradeAt === null) are never pruned. */
  prune(now: number, maxAgeSeconds: number): void {
    for (const [key, halt] of this.halts) {
      if (halt.resumeTradeAt !== null && now - halt.resumeTradeAt > maxAgeSeconds) {
        this.halts.delete(key);
      }
    }
  }

  size(): number {
    return this.halts.size;
  }
}
