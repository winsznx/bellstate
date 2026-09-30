import { describe, expect, it } from "vitest";
import type { AttestationRow } from "../src/quorum.js";
import { HEARTBEAT_MIN_INTERVAL_MS, throttleHeartbeats } from "../src/heartbeatThrottle.js";

function heartbeatRow(overrides: Partial<AttestationRow> = {}): AttestationRow {
  return {
    digest: "0xdigest1",
    signer: "0xsigner1",
    signature: "0xsig1",
    kind: "Heartbeat",
    subject: "US_MARKETS",
    seq: null,
    epoch: 100n,
    ...overrides,
  } as AttestationRow;
}

function marketRow(overrides: Partial<AttestationRow> = {}): AttestationRow {
  return {
    digest: "0xmarketdigest",
    signer: "0xsigner1",
    signature: "0xsig1",
    kind: "MarketUpdate",
    subject: "0xlisting",
    seq: 5,
    epoch: 100n,
    ...overrides,
  } as AttestationRow;
}

describe("throttleHeartbeats — PRD §6.4: at most one heartbeat per domain per 60s", () => {
  it("passes through every non-Heartbeat row untouched", () => {
    const rows = [marketRow()];
    const { eligible, supersededDigests } = throttleHeartbeats(rows, new Map(), 0);
    expect(eligible).toEqual(rows);
    expect(supersededDigests).toEqual([]);
  });

  it("allows a domain's first-ever heartbeat through (never submitted before)", () => {
    const rows = [heartbeatRow()];
    const { eligible, supersededDigests } = throttleHeartbeats(rows, new Map(), 0);
    expect(eligible).toEqual(rows);
    expect(supersededDigests).toEqual([]);
  });

  it("blocks a heartbeat submitted less than 60s after the last one for that domain", () => {
    const rows = [heartbeatRow({ epoch: 101n })];
    const lastSubmitted = new Map([["US_MARKETS", 1_000]]);
    const now = 1_000 + HEARTBEAT_MIN_INTERVAL_MS - 1;
    const { eligible } = throttleHeartbeats(rows, lastSubmitted, now);
    expect(eligible).toEqual([]);
  });

  it("allows a heartbeat exactly at the 60s boundary and after", () => {
    const rows = [heartbeatRow({ epoch: 101n })];
    const lastSubmitted = new Map([["US_MARKETS", 1_000]]);
    const now = 1_000 + HEARTBEAT_MIN_INTERVAL_MS;
    const { eligible } = throttleHeartbeats(rows, lastSubmitted, now);
    expect(eligible).toEqual(rows);
  });

  it("keeps all signer rows for the winning (highest-epoch) digest, not just one representative", () => {
    const rows = [
      heartbeatRow({ digest: "0xd200", epoch: 200n, signer: "0xsignerA", signature: "0xsigA" }),
      heartbeatRow({ digest: "0xd200", epoch: 200n, signer: "0xsignerB", signature: "0xsigB" }),
    ];
    const { eligible, supersededDigests } = throttleHeartbeats(rows, new Map(), 0);
    expect(eligible).toHaveLength(2);
    expect(eligible.map((r) => r.signer).sort()).toEqual(["0xsignerA", "0xsignerB"]);
    expect(supersededDigests).toEqual([]);
  });

  it("marks every row of a lower-epoch heartbeat digest as superseded regardless of throttle state", () => {
    const rows = [
      heartbeatRow({ digest: "0xold", epoch: 100n, signer: "0xsignerA" }),
      heartbeatRow({ digest: "0xold", epoch: 100n, signer: "0xsignerB" }),
      heartbeatRow({ digest: "0xnew", epoch: 105n, signer: "0xsignerA" }),
    ];
    // Even when the domain is still throttled (so 0xnew isn't eligible yet either), the stale
    // 0xold rows must still be cleaned up — otherwise the table grows one row per epoch forever.
    const lastSubmitted = new Map([["US_MARKETS", 1_000]]);
    const now = 1_000 + 1; // well inside the 60s window
    const { eligible, supersededDigests } = throttleHeartbeats(rows, lastSubmitted, now);
    expect(eligible).toEqual([]);
    expect(supersededDigests.sort()).toEqual(["0xold", "0xold"].sort());
  });

  it("throttles each domain independently", () => {
    const rows = [heartbeatRow({ subject: "US_MARKETS", digest: "0xus" }), heartbeatRow({ subject: "HK_MARKETS", digest: "0xhk" })];
    const lastSubmitted = new Map([
      ["US_MARKETS", 1_000], // still throttled (submitted 1ms ago)
      ["HK_MARKETS", -100_000], // due (submitted well over 60s ago)
    ]);
    const now = 1_000 + 1;
    const { eligible } = throttleHeartbeats(rows, lastSubmitted, now);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]?.subject).toBe("HK_MARKETS");
  });
});
