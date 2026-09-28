import { describe, expect, it } from "vitest";
import { canLiquidate, LendingProfile, LendingReason, maxLtvBps } from "../src/lending.js";
import type { MarketView, ValuationView } from "../src/types.js";

// Same scenarios as packages/contracts/test/LendingGuard.t.sol, replicated in TS.

const NOW = 1_800_000_000n;
const SEQ_STARTED_AT = NOW - 7200n; // well past the 3600s grace window

function market(overrides: Partial<MarketView> = {}): MarketView {
  return {
    session: 1, // REGULAR
    interruption: 1, // NONE
    reasonCategory: 0,
    reasonCode: "0x0000000000000000",
    sessionSince: 0n,
    interruptionSince: 0n,
    nextScheduledTransition: 0n,
    expectedResumption: 0n,
    seq: 1,
    writtenAt: 0n,
    effectiveAsOf: NOW - 10n,
    unknownSince: 0n,
    stale: false,
    mic: `0x${"00".repeat(32)}`,
    ...overrides,
  };
}

const PROGRAM = { lifecycle: 2, programStatus: 1, programReason: 0, seq: 1, writtenAt: 0n, effectiveAsOf: 0n, stale: false };
const VALUATION: ValuationView = {
  condition: 1,
  sourceMarketStatus: 0,
  conditionSince: 0n,
  valueAsOf: 0n,
  nextExpectedUpdate: 0n,
  seq: 1,
  writtenAt: 0n,
  effectiveAsOf: 0n,
  stale: false,
};

describe("canLiquidate — LendingGuard.t.sol's HALT_ONLY scenarios", () => {
  it("HALT_ONLY blocks liquidation during ASSET_HALTED", () => {
    const { ok, reason } = canLiquidate({
      market: market({ interruption: 3 }),
      program: PROGRAM,
      valuation: VALUATION,
      hasValuation: false,
      profile: LendingProfile.HaltOnly,
      nowTs: NOW,
      seqUp: true,
      seqStartedAt: SEQ_STARTED_AT,
    });
    expect(ok).toBe(false);
    expect(reason).toBe(LendingReason.Halted);
  });

  it("HALT_ONLY allows liquidation during a CLOSED session (not a halt)", () => {
    const { ok, reason } = canLiquidate({
      market: market({ session: 4 }),
      program: PROGRAM,
      valuation: VALUATION,
      hasValuation: false,
      profile: LendingProfile.HaltOnly,
      nowTs: NOW,
      seqUp: true,
      seqStartedAt: SEQ_STARTED_AT,
    });
    expect(ok).toBe(true);
    expect(reason).toBe(LendingReason.Ok);
  });
});

describe("maxLtvBps — LendingGuard.t.sol's session-discount scenarios", () => {
  it("regular session returns the base LTV unchanged", () => {
    const ltv = maxLtvBps(market(), VALUATION, false, 8000, true, NOW, SEQ_STARTED_AT);
    expect(ltv).toBe(8000);
  });

  it("closed session reduces the base LTV by 1000 bps", () => {
    const ltv = maxLtvBps(market({ session: 4 }), VALUATION, false, 8000, true, NOW, SEQ_STARTED_AT);
    expect(ltv).toBe(7000);
  });

  it("sequencer down returns 0 regardless of everything else", () => {
    const ltv = maxLtvBps(market(), VALUATION, false, 8000, false, NOW, SEQ_STARTED_AT);
    expect(ltv).toBe(0);
  });
});
