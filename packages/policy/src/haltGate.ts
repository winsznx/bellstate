import type { MarketView, ProgramView, Resumption } from "./types.js";
import { sub64 } from "./util.js";

// Mirrors packages/contracts/src/libraries/HaltGatePolicy.sol exactly — see that file for the
// enum-value and rule-numbering comments this file deliberately doesn't repeat.

const INTERRUPTION_UNKNOWN = 0;
const INTERRUPTION_PRICE_CONSTRAINED = 2;
const INTERRUPTION_ASSET_HALTED = 3;
const INTERRUPTION_VENUE_HALTED = 4;

const SESSION_UNKNOWN = 0;
const SESSION_REGULAR = 1;
const SESSION_EXTENDED = 2;
const SESSION_AUCTION = 3;

const LIFECYCLE_UNKNOWN = 0;
const LIFECYCLE_SETTLEMENT_PENDING = 3;
const LIFECYCLE_TERMINATED = 4;

const PROGRAM_STATUS_UNKNOWN = 0;
const PROGRAM_STATUS_SUSPENDED = 2;

const CATEGORY_MARKET_WIDE = 4;
const CATEGORY_VOLATILITY = 2;

const MODE_REGULAR = 0;
const MODE_EXTENDED = 1;
const MODE_AUCTION = 2;
const MODE_CLOSED = 3;
const MODE_CONSTRAINED = 4;
const MODE_DEGRADED = 5;

export enum Verdict {
  Allow = 0,
  RevertProgramNotActive = 1,
  RevertMarketHalted = 2,
  RevertStatusUnknown = 3,
}

export interface HaltGateParams {
  feeRegular: number;
  feeExtended: number;
  feeAuction: number;
  feeClosed: number;
  feeConstrained: number;
  feeDegraded: number;
  degradeAfter: bigint;
  surgeNewsRegulatoryCorporateOther: number;
  surgeNewsDuration: bigint;
  surgeMarketWide: number;
  surgeMarketWideDuration: bigint;
  surgeVolatility: number;
  surgeVolatilityDuration: bigint;
  maxFee: number;
}

export interface HaltGateDecision {
  verdict: Verdict;
  mode: number;
  fee: number;
  interruption: number;
  reasonCategory: number;
  reasonCode: `0x${string}`;
  since: bigint;
  expectedResumption: bigint;
  unknownSince: bigint;
  degradesAt: bigint;
}

const ZERO_BYTES8 = "0x0000000000000000" as const;

function empty(overrides: Partial<HaltGateDecision> = {}): HaltGateDecision {
  return {
    verdict: Verdict.Allow,
    mode: 0,
    fee: 0,
    interruption: 0,
    reasonCategory: 0,
    reasonCode: ZERO_BYTES8,
    since: 0n,
    expectedResumption: 0n,
    unknownSince: 0n,
    degradesAt: 0n,
    ...overrides,
  };
}

export function defaultParams(): HaltGateParams {
  return {
    feeRegular: 1_000,
    feeExtended: 3_000,
    feeAuction: 3_000,
    feeClosed: 5_000,
    feeConstrained: 10_000,
    feeDegraded: 10_000,
    degradeAfter: 1_800n,
    surgeNewsRegulatoryCorporateOther: 30_000,
    surgeNewsDuration: 900n,
    surgeMarketWide: 20_000,
    surgeMarketWideDuration: 600n,
    surgeVolatility: 10_000,
    surgeVolatilityDuration: 300n,
    maxFee: 50_000,
  };
}

export function decide(
  m: MarketView,
  p: ProgramView,
  r: Resumption,
  params: HaltGateParams,
  nowTs: bigint,
): HaltGateDecision {
  if (p.lifecycle === LIFECYCLE_SETTLEMENT_PENDING || p.lifecycle === LIFECYCLE_TERMINATED || p.programStatus === PROGRAM_STATUS_SUSPENDED) {
    return empty({ verdict: Verdict.RevertProgramNotActive });
  }

  if (m.interruption === INTERRUPTION_ASSET_HALTED || m.interruption === INTERRUPTION_VENUE_HALTED) {
    return empty({
      verdict: Verdict.RevertMarketHalted,
      interruption: m.interruption,
      reasonCategory: m.reasonCategory,
      reasonCode: m.reasonCode,
      since: m.interruptionSince,
      expectedResumption: m.expectedResumption,
    });
  }

  const anyUnknown =
    m.session === SESSION_UNKNOWN ||
    m.interruption === INTERRUPTION_UNKNOWN ||
    p.lifecycle === LIFECYCLE_UNKNOWN ||
    p.programStatus === PROGRAM_STATUS_UNKNOWN;

  if (anyUnknown) {
    const unknownSince = m.unknownSince !== 0n ? m.unknownSince : m.effectiveAsOf;
    const degradesAt = unknownSince + params.degradeAfter;

    if (sub64(nowTs, unknownSince) <= params.degradeAfter) {
      return empty({ verdict: Verdict.RevertStatusUnknown, unknownSince, degradesAt });
    }

    return applySurge(empty({ mode: MODE_DEGRADED, fee: params.feeDegraded }), r, params, nowTs);
  }

  if (m.interruption === INTERRUPTION_PRICE_CONSTRAINED) {
    return applySurge(empty({ mode: MODE_CONSTRAINED, fee: params.feeConstrained }), r, params, nowTs);
  }

  let mode: number;
  let fee: number;
  if (m.session === SESSION_REGULAR) {
    mode = MODE_REGULAR;
    fee = params.feeRegular;
  } else if (m.session === SESSION_EXTENDED) {
    mode = MODE_EXTENDED;
    fee = params.feeExtended;
  } else if (m.session === SESSION_AUCTION) {
    mode = MODE_AUCTION;
    fee = params.feeAuction;
  } else {
    mode = MODE_CLOSED;
    fee = params.feeClosed;
  }

  return applySurge(empty({ mode, fee }), r, params, nowTs);
}

function applySurge(d: HaltGateDecision, r: Resumption, params: HaltGateParams, nowTs: bigint): HaltGateDecision {
  if (r.at === 0n) return cap(d, params);

  const [surge, duration] = surgeFor(r.category, params);
  if (duration === 0n) return cap(d, params);

  const elapsed = sub64(nowTs, r.at);
  if (elapsed >= duration) return cap(d, params);

  const remaining = duration - elapsed;
  const add = (BigInt(surge) * remaining) / duration;
  return cap({ ...d, fee: d.fee + Number(add) }, params);
}

function surgeFor(category: number, params: HaltGateParams): [number, bigint] {
  if (category === CATEGORY_MARKET_WIDE) return [params.surgeMarketWide, params.surgeMarketWideDuration];
  if (category === CATEGORY_VOLATILITY) return [params.surgeVolatility, params.surgeVolatilityDuration];
  return [params.surgeNewsRegulatoryCorporateOther, params.surgeNewsDuration];
}

function cap(d: HaltGateDecision, params: HaltGateParams): HaltGateDecision {
  return d.fee > params.maxFee ? { ...d, fee: params.maxFee } : d;
}
