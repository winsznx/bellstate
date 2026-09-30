import { INTERRUPTIONS, REASON_CATEGORIES, SESSIONS, type MarketState } from "@winsznx/bellstate-engine";
import { decodeReasonCode } from "@winsznx/bellstate-protocol";

/** The subset of BellstateHub's `MarketView` tuple (src/chain/hubAbi.ts) this signer needs to
 * rebuild an engine-shaped MarketState for diffing in `tick()`. */
export interface OnchainMarketView {
  session: number;
  interruption: number;
  reasonCategory: number;
  reasonCode: `0x${string}`;
  sessionSince: bigint;
  interruptionSince: bigint;
  nextScheduledTransition: bigint;
  expectedResumption: bigint;
  seq: number;
  writtenAt: bigint;
}

export interface OnchainMarketSubject {
  onchainSeq: number;
  /** null when the record has never been attested (writtenAt === 0) — tick.ts's ListingSubject
   * treats that as always-diff, seq 0 + 1. A record that exists but has decayed past its onchain
   * max-age (StatusLib's staleness rule) is NOT null: the hub already zeroes its enum/timestamp
   * fields in that case, which this still faithfully converts. */
  onchainState: MarketState | null;
}

/**
 * Inverse of packages/protocol's buildMarketUpdateMessage's enum-index encoding, for the one
 * direction that package doesn't need: reading the hub's already-attested state back into the
 * engine's string-enum shape so it can be diffed against a freshly derived MarketState.
 */
export function toMarketSubject(v: OnchainMarketView): OnchainMarketSubject {
  if (v.writtenAt === 0n) {
    return { onchainSeq: Number(v.seq), onchainState: null };
  }

  const state: MarketState = {
    session: SESSIONS[v.session] ?? "UNKNOWN",
    interruption: INTERRUPTIONS[v.interruption] ?? "UNKNOWN",
    reasonCategory: REASON_CATEGORIES[v.reasonCategory] ?? "NONE",
    reasonCode: decodeReasonCode(v.reasonCode),
    sessionSince: Number(v.sessionSince),
    interruptionSince: Number(v.interruptionSince),
    nextScheduledTransition: Number(v.nextScheduledTransition),
    expectedResumption: Number(v.expectedResumption),
  };

  return { onchainSeq: Number(v.seq), onchainState: state };
}
