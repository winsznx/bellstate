import { describe, expect, it } from "vitest";
import { selectQuorumBatch, type AttestationRow } from "../src/quorum.js";

const SIGNER_A = "0x1000000000000000000000000000000000000a" as `0x${string}`;
const SIGNER_B = "0x2000000000000000000000000000000000000b" as `0x${string}`;
const SIGNER_C = "0x3000000000000000000000000000000000000c" as `0x${string}`;

const LISTING = "0x1111111111111111111111111111111111111111111111111111111111111111" as `0x${string}`;

function row(overrides: Partial<AttestationRow> & Pick<AttestationRow, "digest" | "signer">): AttestationRow {
  return {
    kind: "MarketUpdate",
    subject: LISTING,
    seq: 1,
    epoch: 100n,
    signature: `0xsig-${overrides.signer}` as `0x${string}`,
    ...overrides,
  };
}

describe("selectQuorumBatch", () => {
  it("drops a digest with fewer than quorum distinct signers", () => {
    const rows = [row({ digest: "0xd1" as `0x${string}`, signer: SIGNER_A })];
    expect(selectQuorumBatch(rows, 2)).toEqual([]);
  });

  it("includes a digest once it reaches quorum, with signers sorted ascending", () => {
    const digest = "0xd1" as `0x${string}`;
    const rows = [
      row({ digest, signer: SIGNER_B }),
      row({ digest, signer: SIGNER_A }),
    ];
    const batch = selectQuorumBatch(rows, 2);
    expect(batch).toHaveLength(1);
    expect(batch[0]?.signers).toEqual([SIGNER_A, SIGNER_B]);
    expect(batch[0]?.signatures).toEqual([`0xsig-${SIGNER_A}`, `0xsig-${SIGNER_B}`]);
  });

  it("dedupes a signer who submits the same digest twice instead of double-counting", () => {
    const digest = "0xd1" as `0x${string}`;
    const rows = [
      row({ digest, signer: SIGNER_A }),
      row({ digest, signer: SIGNER_A }),
    ];
    expect(selectQuorumBatch(rows, 2)).toEqual([]);
  });

  it("drops a superseded (lower-seq) digest once a higher-seq digest for the same subject also reaches quorum", () => {
    const staleDigest = "0xstale" as `0x${string}`;
    const freshDigest = "0xfresh" as `0x${string}`;
    const rows = [
      row({ digest: staleDigest, signer: SIGNER_A, seq: 1 }),
      row({ digest: staleDigest, signer: SIGNER_B, seq: 1 }),
      row({ digest: freshDigest, signer: SIGNER_A, seq: 2 }),
      row({ digest: freshDigest, signer: SIGNER_B, seq: 2 }),
    ];
    const batch = selectQuorumBatch(rows, 2);
    expect(batch).toHaveLength(1);
    expect(batch[0]?.digest).toBe(freshDigest);
    expect(batch[0]?.seq).toBe(2);
  });

  it("keeps the higher-seq digest even when it individually has fewer signers than the stale one, as long as it still meets quorum", () => {
    const staleDigest = "0xstale" as `0x${string}`;
    const freshDigest = "0xfresh" as `0x${string}`;
    const rows = [
      row({ digest: staleDigest, signer: SIGNER_A, seq: 1 }),
      row({ digest: staleDigest, signer: SIGNER_B, seq: 1 }),
      row({ digest: staleDigest, signer: SIGNER_C, seq: 1 }),
      row({ digest: freshDigest, signer: SIGNER_A, seq: 2 }),
      row({ digest: freshDigest, signer: SIGNER_B, seq: 2 }),
    ];
    const batch = selectQuorumBatch(rows, 2);
    expect(batch).toHaveLength(1);
    expect(batch[0]?.digest).toBe(freshDigest);
  });

  it("batches independent (kind, subject) pairs separately", () => {
    const listingA = "0xaaaa" as `0x${string}`;
    const listingB = "0xbbbb" as `0x${string}`;
    const digestA = "0xda" as `0x${string}`;
    const digestB = "0xdb" as `0x${string}`;
    const rows = [
      row({ digest: digestA, signer: SIGNER_A, subject: listingA }),
      row({ digest: digestA, signer: SIGNER_B, subject: listingA }),
      row({ digest: digestB, signer: SIGNER_A, subject: listingB }),
      row({ digest: digestB, signer: SIGNER_B, subject: listingB }),
    ];
    const batch = selectQuorumBatch(rows, 2);
    expect(batch.map((b) => b.subject).sort()).toEqual([listingA, listingB].sort());
  });

  it("orders Heartbeats by epoch instead of seq, since Heartbeat has no seq", () => {
    const staleDigest = "0xstale" as `0x${string}`;
    const freshDigest = "0xfresh" as `0x${string}`;
    const rows: AttestationRow[] = [
      row({ digest: staleDigest, signer: SIGNER_A, kind: "Heartbeat", subject: "1", seq: null, epoch: 100n }),
      row({ digest: staleDigest, signer: SIGNER_B, kind: "Heartbeat", subject: "1", seq: null, epoch: 100n }),
      row({ digest: freshDigest, signer: SIGNER_A, kind: "Heartbeat", subject: "1", seq: null, epoch: 200n }),
      row({ digest: freshDigest, signer: SIGNER_B, kind: "Heartbeat", subject: "1", seq: null, epoch: 200n }),
    ];
    const batch = selectQuorumBatch(rows, 2);
    expect(batch).toHaveLength(1);
    expect(batch[0]?.digest).toBe(freshDigest);
    expect(batch[0]?.epoch).toBe(200n);
  });

  it("returns an empty batch for an empty input", () => {
    expect(selectQuorumBatch([], 2)).toEqual([]);
  });
});
