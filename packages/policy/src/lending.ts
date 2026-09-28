import type { MarketView, ProgramView, ValuationView } from "./types.js";
import { sub64 } from "./util.js";

// Mirrors packages/contracts/src/libraries/LendingPolicy.sol exactly.

const SESSION_UNKNOWN = 0;
const SESSION_REGULAR = 1;
const SESSION_EXTENDED = 2;
const SESSION_CLOSED = 4;

const INTERRUPTION_UNKNOWN = 0;
const INTERRUPTION_NONE = 1;
const INTERRUPTION_PRICE_CONSTRAINED = 2;
const INTERRUPTION_ASSET_HALTED = 3;
const INTERRUPTION_VENUE_HALTED = 4;

const LIFECYCLE_ACTIVE = 2;
const PROGRAM_STATUS_NORMAL = 1;
const CONDITION_UPDATING = 1;
const CONDITION_DELAYED = 3;

export enum LendingProfile {
  Strict = 0,
  Extended = 1,
  HaltOnly = 2,
}

export enum LendingReason {
  Ok = 0,
  SequencerDown = 1,
  SequencerGrace = 2,
  Stale = 3,
  Lifecycle = 4,
  ProgramSuspended = 5,
  Halted = 6,
  UnknownStatus = 7,
  Session = 8,
  Valuation = 9,
}

const SEQUENCER_GRACE_SECONDS = 3600n;

export interface LiquidationInput {
  market: MarketView;
  program: ProgramView;
  valuation: ValuationView;
  hasValuation: boolean;
  profile: LendingProfile;
  nowTs: bigint;
  seqUp: boolean;
  seqStartedAt: bigint;
}

export function canLiquidate(input: LiquidationInput): { ok: boolean; reason: LendingReason } {
  const { market, program, valuation, hasValuation, profile, nowTs, seqUp, seqStartedAt } = input;

  if (!seqUp) return { ok: false, reason: LendingReason.SequencerDown };
  if (sub64(nowTs, seqStartedAt) < SEQUENCER_GRACE_SECONDS) return { ok: false, reason: LendingReason.SequencerGrace };

  if (market.stale || program.stale || (hasValuation && valuation.stale)) {
    return { ok: false, reason: LendingReason.Stale };
  }

  if (program.lifecycle !== LIFECYCLE_ACTIVE) return { ok: false, reason: LendingReason.Lifecycle };
  if (program.programStatus !== PROGRAM_STATUS_NORMAL) return { ok: false, reason: LendingReason.ProgramSuspended };

  if (market.interruption === INTERRUPTION_UNKNOWN || market.session === SESSION_UNKNOWN) {
    return { ok: false, reason: LendingReason.UnknownStatus };
  }

  if (market.interruption === INTERRUPTION_ASSET_HALTED || market.interruption === INTERRUPTION_VENUE_HALTED) {
    return { ok: false, reason: LendingReason.Halted };
  }

  const valuationOk = !hasValuation || valuation.condition === CONDITION_UPDATING;

  if (profile === LendingProfile.Strict) {
    if (market.session !== SESSION_REGULAR) return { ok: false, reason: LendingReason.Session };
    if (market.interruption !== INTERRUPTION_NONE) return { ok: false, reason: LendingReason.Halted };
    if (!valuationOk) return { ok: false, reason: LendingReason.Valuation };
    return { ok: true, reason: LendingReason.Ok };
  }

  if (profile === LendingProfile.Extended) {
    if (market.session !== SESSION_REGULAR && market.session !== SESSION_EXTENDED) {
      return { ok: false, reason: LendingReason.Session };
    }
    if (market.interruption !== INTERRUPTION_NONE) return { ok: false, reason: LendingReason.Halted };
    if (!valuationOk) return { ok: false, reason: LendingReason.Valuation };
    return { ok: true, reason: LendingReason.Ok };
  }

  return { ok: true, reason: LendingReason.Ok };
}

export function maxLtvBps(
  market: MarketView,
  valuation: ValuationView,
  hasValuation: boolean,
  baseLtvBps: number,
  seqUp: boolean,
  nowTs: bigint,
  seqStartedAt: bigint,
): number {
  if (!seqUp) return 0;
  if (sub64(nowTs, seqStartedAt) < SEQUENCER_GRACE_SECONDS) return 0;
  if (market.stale) return 0;
  if (market.session === SESSION_UNKNOWN || market.interruption === INTERRUPTION_UNKNOWN) return 0;
  if (market.interruption === INTERRUPTION_ASSET_HALTED || market.interruption === INTERRUPTION_VENUE_HALTED) return 0;
  if (hasValuation && valuation.condition === CONDITION_DELAYED) return 0;

  let max = baseLtvBps;
  if (market.interruption === INTERRUPTION_PRICE_CONSTRAINED) {
    max = subFloor(max, 1_500);
  } else if (market.session === SESSION_EXTENDED || market.session === 3 /* AUCTION */) {
    max = subFloor(max, 500);
  } else if (market.session === SESSION_CLOSED) {
    max = subFloor(max, 1_000);
  }

  return max;
}

function subFloor(a: number, b: number): number {
  return a > b ? a - b : 0;
}
