import type { HaltRecord, Listing, MarketSnapshot, MarketState, UnixSeconds } from "./types.js";

function isOpen(halt: HaltRecord, t: UnixSeconds): boolean {
  return halt.haltAt <= t && (halt.resumeTradeAt === null || halt.resumeTradeAt > t);
}

function latestByHaltAt(halts: HaltRecord[]): HaltRecord {
  return halts.reduce((latest, h) => (h.haltAt > latest.haltAt ? h : latest));
}

/** PRD §3.3. Pure function of (listing, t, snapshot) — no wall-clock reads. */
export function deriveMarket(listing: Listing, t: UnixSeconds, snapshot: MarketSnapshot): MarketState {
  const { sessionWindow, halts, sourceHealthy } = snapshot;

  const openVenueHalts = halts.filter((h) => h.scope === "VENUE" && isOpen(h, t));
  const openAssetHalts = halts.filter((h) => h.scope === "ASSET" && isOpen(h, t));

  let interruption: MarketState["interruption"];
  let governing: HaltRecord | null;

  if (!sourceHealthy) {
    interruption = "UNKNOWN";
    governing = null;
  } else if (openVenueHalts.length > 0) {
    interruption = "VENUE_HALTED";
    governing = latestByHaltAt(openVenueHalts);
  } else if (openAssetHalts.length > 0) {
    interruption = "ASSET_HALTED";
    governing = latestByHaltAt(openAssetHalts);
  } else {
    interruption = "NONE";
    governing = null;
  }

  let interruptionSince: UnixSeconds;
  if (interruption === "VENUE_HALTED" || interruption === "ASSET_HALTED") {
    interruptionSince = governing!.haltAt;
  } else if (interruption === "NONE") {
    const pastResumptions = halts
      .map((h) => h.resumeTradeAt)
      .filter((r): r is UnixSeconds => r !== null && r <= t);
    interruptionSince = pastResumptions.length > 0 ? Math.max(...pastResumptions) : 0;
  } else {
    interruptionSince = 0;
  }

  const expectedResumption =
    governing?.resumeTradeAt !== null && governing?.resumeTradeAt !== undefined && governing.resumeTradeAt > t
      ? governing.resumeTradeAt
      : 0;

  const reasonCategory = governing ? governing.reasonCategory : "NONE";
  const reasonCode = governing ? governing.reasonCode : "NONE";

  return {
    session: sessionWindow.session,
    interruption,
    reasonCategory,
    reasonCode,
    sessionSince: sessionWindow.sessionSince,
    nextScheduledTransition: sessionWindow.nextScheduledTransition,
    interruptionSince,
    expectedResumption,
  };
}
