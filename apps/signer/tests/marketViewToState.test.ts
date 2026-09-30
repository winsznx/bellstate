import { describe, expect, it } from "vitest";
import { toMarketSubject } from "../src/chain/marketViewToState.js";

const BASE_VIEW = {
  session: 4, // CLOSED
  interruption: 1, // NONE
  reasonCategory: 0, // NONE
  reasonCode: "0x0000000000000000" as const,
  sessionSince: 1_699_999_000n,
  interruptionSince: 0n,
  nextScheduledTransition: 1_700_001_000n,
  expectedResumption: 0n,
  seq: 1,
  writtenAt: 1_699_999_500n,
};

describe("toMarketSubject — reading BellstateHub.marketView() back into engine MarketState", () => {
  it("a never-attested record (writtenAt === 0) has no onchain state, seq 0", () => {
    const result = toMarketSubject({ ...BASE_VIEW, writtenAt: 0n, seq: 0 });
    expect(result).toEqual({ onchainSeq: 0, onchainState: null });
  });

  it("converts numeric enum indices and bigint timestamps back to the engine's string-enum shape", () => {
    const result = toMarketSubject(BASE_VIEW);
    expect(result.onchainSeq).toBe(1);
    expect(result.onchainState).toEqual({
      session: "CLOSED",
      interruption: "NONE",
      reasonCategory: "NONE",
      reasonCode: "NONE",
      sessionSince: 1_699_999_000,
      interruptionSince: 0,
      nextScheduledTransition: 1_700_001_000,
      expectedResumption: 0,
    });
  });

  it("decodes a real ASCII reasonCode (e.g. an asset halt) rather than leaving it as raw hex", () => {
    // "T1" ASCII-encoded, right-padded to 8 bytes — same encoding packages/protocol's
    // encodeReasonCode produces.
    const result = toMarketSubject({ ...BASE_VIEW, interruption: 3, reasonCategory: 1, reasonCode: "0x5431000000000000" });
    expect(result.onchainState?.reasonCode).toBe("T1");
  });

  it("a stale record (all fields zeroed onchain) decodes to UNKNOWN/NONE, not null — it was attested once", () => {
    const result = toMarketSubject({
      session: 0,
      interruption: 0,
      reasonCategory: 0,
      reasonCode: "0x0000000000000000",
      sessionSince: 0n,
      interruptionSince: 0n,
      nextScheduledTransition: 0n,
      expectedResumption: 0n,
      seq: 3,
      writtenAt: 1_699_000_000n,
    });
    expect(result.onchainSeq).toBe(3);
    expect(result.onchainState).toEqual({
      session: "UNKNOWN",
      interruption: "UNKNOWN",
      reasonCategory: "NONE",
      reasonCode: "NONE",
      sessionSince: 0,
      interruptionSince: 0,
      nextScheduledTransition: 0,
      expectedResumption: 0,
    });
  });
});
