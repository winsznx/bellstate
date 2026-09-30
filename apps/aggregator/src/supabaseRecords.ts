import type { SupabaseClient } from "@supabase/supabase-js";
import { dbKindOf, type AttestationKind, type WireMessage } from "./attestation.js";

/** PRD §8.2: "Records. Rows go to attestations and submissions tables so the indexer can compute
 * latency." Column shapes match packages/db/supabase/migrations/20260927150000_schema.sql. */

export interface AttestationRecord {
  signer: `0x${string}`;
  kind: AttestationKind;
  subjectId: `0x${string}`;
  seq: number | null;
  epoch: bigint;
  digest: `0x${string}`;
  message: WireMessage;
  signature: `0x${string}`;
  observedAt: Date;
}

export async function recordAttestation(supabase: SupabaseClient, record: AttestationRecord): Promise<void> {
  const { error } = await supabase.from("attestations").insert({
    signer: record.signer.toLowerCase(),
    kind: dbKindOf(record.kind),
    subject_id: record.subjectId.toLowerCase(),
    seq: record.seq,
    epoch: record.epoch.toString(),
    digest: record.digest.toLowerCase(),
    message: record.message,
    signature: record.signature,
    observed_at: record.observedAt.toISOString(),
  });
  if (error) throw new Error(`failed to record attestation in Supabase: ${error.message}`);
}

export type SubmissionStatus = "pending" | "included" | "replaced" | "failed";

export interface SubmissionRecord {
  txHash: `0x${string}`;
  nonce: bigint;
  digests: `0x${string}`[];
  status: SubmissionStatus;
}

export async function recordSubmission(supabase: SupabaseClient, record: SubmissionRecord): Promise<void> {
  const { error } = await supabase.from("submissions").insert({
    tx_hash: record.txHash.toLowerCase(),
    nonce: record.nonce.toString(),
    digests: record.digests.map((d) => d.toLowerCase()),
    status: record.status,
  });
  if (error) throw new Error(`failed to record submission in Supabase: ${error.message}`);
}

export interface SubmissionStatusUpdate {
  status: SubmissionStatus;
  blockNumber?: bigint;
  blockTime?: Date;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
  error?: string;
}

export async function updateSubmissionStatus(
  supabase: SupabaseClient,
  txHash: `0x${string}`,
  update: SubmissionStatusUpdate,
): Promise<void> {
  const { error } = await supabase
    .from("submissions")
    .update({
      status: update.status,
      block_number: update.blockNumber?.toString(),
      block_time: update.blockTime?.toISOString(),
      gas_used: update.gasUsed?.toString(),
      effective_gas_price: update.effectiveGasPrice?.toString(),
      error: update.error,
    })
    .eq("tx_hash", txHash.toLowerCase());
  if (error) throw new Error(`failed to update submission status in Supabase: ${error.message}`);
}

/**
 * PRD §6.5 "Funding": ops-alert/`/network`-banner delivery is cross-app (apps/notifier sends the
 * alert, apps/web renders the banner) and this app has no queue producer binding to reach it
 * without editing wrangler.jsonc's binding surface, which is out of this pass's scope (see
 * attestationStore.ts's checkFunding for the full note). Recording into ops_audit at least makes
 * the real, live-checked balance visible to anyone querying Supabase directly.
 */
export async function recordFundingAlert(
  supabase: SupabaseClient,
  params: { submitter: `0x${string}`; balanceWei: bigint; level: "low" | "critical" },
): Promise<void> {
  const { error } = await supabase.from("ops_audit").insert({
    actor: params.submitter.toLowerCase(),
    action: params.level === "critical" ? "funding_critical" : "funding_low",
    params: { balance_wei: params.balanceWei.toString() },
  });
  if (error) throw new Error(`failed to record funding alert in Supabase: ${error.message}`);
}
