import { resolveSessionWindow } from "@winsznx/bellstate-calendars";
import type { HaltRecord } from "@winsznx/bellstate-engine";
import type { HkexAnnouncement } from "./types.js";

/**
 * PRD §4.3: "resumeTradeAt = start of the first non-CLOSED XHKG session window at or after the
 * release time." When the release time already falls inside an active (non-CLOSED) window — an
 * edge case the PRD doesn't fully disambiguate — this returns that window's own start rather
 * than waiting for the next one, since the market is effectively already open.
 */
function firstNonClosedWindowStart(releaseAt: number, maxHops = 20): number {
  let cursor = releaseAt;
  for (let i = 0; i < maxHops; i++) {
    const window = resolveSessionWindow("XHKG", cursor);
    if (window.session !== "CLOSED") return window.sessionSince;
    cursor = window.nextScheduledTransition;
  }
  throw new Error(`no non-CLOSED XHKG window found within ${maxHops} hops of ${releaseAt}`);
}

export interface HkexHaltOpen {
  stockCode: string;
  record: HaltRecord;
}

export interface HkexResumption {
  stockCode: string;
  resumeTradeAt: number;
}

/**
 * A HALT announcement carries everything a HaltRecord needs (§4.3). A RESUME announcement does
 * not — it has no haltAt, only a resumption time for a halt announced separately, possibly days
 * earlier. Matching a resumption to the open halt it closes is the signer's HkHalts Durable
 * Object's job (it's the only thing that has seen every prior poll); this only classifies and
 * computes the resumption's effective time.
 */
export function toHaltOpens(announcement: HkexAnnouncement): HkexHaltOpen[] {
  if (announcement.classification !== "HALT") return [];
  const isSuspension = announcement.documentTitle.toUpperCase().includes("SUSPENSION");
  const reasonCode = isSuspension ? "HK:SUSP" : "HK:HALT";
  const reasonCategory = isSuspension ? ("REGULATORY" as const) : ("NEWS" as const);

  return announcement.stockCodes.map((stockCode) => ({
    stockCode,
    record: {
      scope: "ASSET" as const,
      haltAt: announcement.releaseAt,
      resumeTradeAt: null,
      reasonCategory,
      reasonCode,
    },
  }));
}

export function toResumptions(announcement: HkexAnnouncement): HkexResumption[] {
  if (announcement.classification !== "RESUME") return [];
  const resumeTradeAt = firstNonClosedWindowStart(announcement.releaseAt);
  return announcement.stockCodes.map((stockCode) => ({ stockCode, resumeTradeAt }));
}
