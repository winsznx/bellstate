import type { HaltRecord, ReasonCategory } from "@winsznx/bellstate-engine";
import type { HkexAnnouncement } from "@winsznx/bellstate-source-hkex-halts";
import { toHaltOpens, toResumptions } from "@winsznx/bellstate-source-hkex-halts";

interface TrackedHalt {
  haltAt: number;
  resumeTradeAt: number | null;
  reasonCategory: ReasonCategory;
  reasonCode: string;
}

/**
 * PRD §4.3's cross-poll HK halt state, kept by the signer's HkHalts Durable Object. A RESUME
 * announcement has no haltAt of its own (packages/sources/hkex-halts's README explains why) —
 * this is what matches it to the most recent open halt for the same stock code.
 */
export class HkHaltsState {
  private bySymbol = new Map<string, TrackedHalt>();

  applyAnnouncements(announcements: readonly HkexAnnouncement[]): void {
    for (const announcement of announcements) {
      for (const open of toHaltOpens(announcement)) {
        const existing = this.bySymbol.get(open.stockCode);
        if (!existing || existing.resumeTradeAt !== null || open.record.haltAt > existing.haltAt) {
          this.bySymbol.set(open.stockCode, {
            haltAt: open.record.haltAt,
            resumeTradeAt: null,
            reasonCategory: open.record.reasonCategory,
            reasonCode: open.record.reasonCode,
          });
        }
      }
      for (const resumption of toResumptions(announcement)) {
        const existing = this.bySymbol.get(resumption.stockCode);
        if (existing && existing.resumeTradeAt === null) {
          existing.resumeTradeAt = resumption.resumeTradeAt;
        }
      }
    }
  }

  haltsForListing(stockCode: string): HaltRecord[] {
    const halt = this.bySymbol.get(stockCode);
    if (!halt) return [];
    return [{ scope: "ASSET", ...halt }];
  }

  prune(now: number, maxAgeSeconds: number): void {
    for (const [code, halt] of this.bySymbol) {
      if (halt.resumeTradeAt !== null && now - halt.resumeTradeAt > maxAgeSeconds) {
        this.bySymbol.delete(code);
      }
    }
  }

  size(): number {
    return this.bySymbol.size;
  }
}
