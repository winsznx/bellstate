import type { AttestationKind } from "./attestation.js";

/** One signer's attestation of one digest, as read back out of AttestationStore's SQLite table.
 * Pure and network-free by design (packages/protocol's signature recovery already ran once, at
 * intake time, in worker.ts) so this module stays unit-testable without a DO or a chain. */
export interface AttestationRow {
  digest: `0x${string}`;
  signer: `0x${string}`;
  signature: `0x${string}`;
  kind: AttestationKind;
  subject: string;
  /** null for Heartbeat, which has no seq field — superseding is by epoch instead. */
  seq: number | null;
  epoch: bigint;
}

export interface QuorumBatchItem {
  digest: `0x${string}`;
  kind: AttestationKind;
  subject: string;
  seq: number | null;
  epoch: bigint;
  /** Ascending by address, deduped by signer — exactly what BellstateHub._verifyQuorum requires
   * (`recovered <= prev` reverts on ties or descending order). */
  signers: `0x${string}`[];
  signatures: `0x${string}`[];
}

interface DigestGroup {
  kind: AttestationKind;
  subject: string;
  seq: number | null;
  epoch: bigint;
  signerToSignature: Map<string, { signer: `0x${string}`; signature: `0x${string}` }>;
}

/** PRD §6.5 batching step, as a pure function: "Collect every digest with >= quorum signatures,
 * drop superseded ones (older seq or epoch), and batch by facet type." Grouping by (kind, subject)
 * and keeping only the highest seq/epoch happens here; turning the result into calldata and
 * sending the transaction is attestationStore.ts's job. */
export function selectQuorumBatch(rows: readonly AttestationRow[], quorum: number): QuorumBatchItem[] {
  const byDigest = new Map<string, DigestGroup>();

  for (const row of rows) {
    let group = byDigest.get(row.digest);
    if (!group) {
      group = { kind: row.kind, subject: row.subject, seq: row.seq, epoch: row.epoch, signerToSignature: new Map() };
      byDigest.set(row.digest, group);
    }
    group.signerToSignature.set(row.signer.toLowerCase(), { signer: row.signer, signature: row.signature });
  }

  const qualifying: { digest: `0x${string}`; group: DigestGroup }[] = [];
  for (const [digest, group] of byDigest) {
    if (group.signerToSignature.size >= quorum) {
      qualifying.push({ digest: digest as `0x${string}`, group });
    }
  }

  const bestPerSubject = new Map<string, { digest: `0x${string}`; group: DigestGroup }>();
  for (const candidate of qualifying) {
    const key = `${candidate.group.kind}:${candidate.group.subject}`;
    const current = bestPerSubject.get(key);
    if (!current || supersedes(candidate.group, current.group)) {
      bestPerSubject.set(key, candidate);
    }
  }

  const batch: QuorumBatchItem[] = [];
  for (const { digest, group } of bestPerSubject.values()) {
    const signers = [...group.signerToSignature.values()].sort((a, b) =>
      a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1,
    );
    batch.push({
      digest,
      kind: group.kind,
      subject: group.subject,
      seq: group.seq,
      epoch: group.epoch,
      signers: signers.map((s) => s.signer),
      signatures: signers.map((s) => s.signature),
    });
  }
  return batch;
}

/** True when `candidate` is fresher than `current` for the same (kind, subject) slot: higher seq
 * for the four seq-carrying kinds, higher epoch for Heartbeat. */
function supersedes(candidate: DigestGroup, current: DigestGroup): boolean {
  if (candidate.seq !== null && current.seq !== null) {
    return candidate.seq > current.seq;
  }
  return candidate.epoch > current.epoch;
}
