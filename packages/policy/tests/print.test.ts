import { describe, expect, it } from "vitest";
import { PrintVerdict, PRINT_FLAG, verdictSecondary, verdictSingle, type PrintVenueState } from "../src/print.js";

// Same scenarios as packages/contracts/test/PrintGuard.t.sol, replicated in TS to catch a port
// mistake before it ever needs anvil (tests/parity.fork.test.ts does the full onchain check).

const PRINT_TS = 1_785_196_802n; // Jul 28, 2026 08:00:02 KST

describe("verdictSecondary — PRD §7.6 worked example (SK hynix, Jul 28 08:00:02 KST)", () => {
  it("NXTE EXTENDED + FIRST_MINUTE, XKRX CLOSED => REJECT", () => {
    const nxte: PrintVenueState = {
      found: true,
      outOfHistory: false,
      session: 2, // EXTENDED
      interruption: 1, // NONE
      sessionStartedAt: PRINT_TS - 2n,
    };
    const xkrx: PrintVenueState = {
      found: true,
      outOfHistory: false,
      session: 4, // CLOSED
      interruption: 1,
      sessionStartedAt: PRINT_TS - 3600n,
    };

    const { verdict } = verdictSecondary(nxte, xkrx, PRINT_TS, PRINT_TS);
    expect(verdict).toBe(PrintVerdict.Reject);
  });
});

describe("verdictSingle — PrintGuard.t.sol's other scenarios", () => {
  const base: PrintVenueState = {
    found: true,
    outOfHistory: false,
    session: 1,
    interruption: 1,
    sessionStartedAt: PRINT_TS - 3600n,
  };

  it("regular session, no flags: ACCEPT", () => {
    const { verdict, flags } = verdictSingle(base, PRINT_TS, PRINT_TS);
    expect(verdict).toBe(PrintVerdict.Accept);
    expect(flags).toBe(0);
  });

  it("venue halted (ASSET_HALTED): REJECT", () => {
    const { verdict } = verdictSingle({ ...base, interruption: 3 }, PRINT_TS, PRINT_TS);
    expect(verdict).toBe(PrintVerdict.Reject);
  });

  it("venue closed: REJECT", () => {
    const { verdict } = verdictSingle({ ...base, session: 4 }, PRINT_TS, PRINT_TS);
    expect(verdict).toBe(PrintVerdict.Reject);
  });

  it("extended session, well past FIRST_MINUTE: FLAG with VENUE_EXTENDED set", () => {
    const { verdict, flags } = verdictSingle({ ...base, session: 2 }, PRINT_TS, PRINT_TS);
    expect(verdict).toBe(PrintVerdict.Flag);
    expect(flags & PRINT_FLAG.VENUE_EXTENDED).not.toBe(0);
  });

  it("printTs far outside history: UNKNOWN with OUT_OF_HISTORY set", () => {
    const { verdict, flags } = verdictSingle(
      { ...base, outOfHistory: true },
      PRINT_TS - 100_000n,
      PRINT_TS,
    );
    expect(verdict).toBe(PrintVerdict.Unknown);
    expect(flags & PRINT_FLAG.OUT_OF_HISTORY).not.toBe(0);
  });
});
