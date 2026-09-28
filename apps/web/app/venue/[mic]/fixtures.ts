import type { HaltRecord } from "@winsznx/bellstate-engine";

/** Halts-today and source-health aren't computable from packages/calendars (they need live
 * source polling) — fixture, same situation as the Board/Asset screens. The session bar,
 * special-days list and current session/next-transition ARE real, computed live from
 * packages/calendars in page.tsx, not fixtures. */
export interface VenueHaltRow extends HaltRecord {
  symbol: string;
  tracked: boolean;
}

const VENUE_HALTS_TODAY: Record<string, VenueHaltRow[]> = {
  XNAS: [
    {
      symbol: "CTNTx".replace(/x$/, ""),
      tracked: true,
      scope: "ASSET",
      haltAt: Math.floor(Date.now() / 1000) - 120,
      resumeTradeAt: null,
      reasonCategory: "NEWS",
      reasonCode: "T1",
    },
  ],
  XHKG: [],
  XKRX: [],
  NXTE: [],
  XNYS: [],
  ARCX: [],
  XASE: [],
};

export function haltsTodayFor(mic: string): VenueHaltRow[] {
  return VENUE_HALTS_TODAY[mic] ?? [];
}

export function sourceHealthyFor(mic: string): boolean {
  return true;
}
