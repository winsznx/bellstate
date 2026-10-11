import { DurableObject } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";
import { decodeErrorResult, encodeFunctionData, formatEther, parseEther, parseEventLogs, type Log } from "viem";
import {
  ATTESTATION_KINDS,
  parseHeartbeatWire,
  parseMarketUpdateWire,
  parsePrimaryUpdateWire,
  parseProgramUpdateWire,
  parseValuationUpdateWire,
  toHeartbeatMessage,
  toMarketUpdateMessage,
  toPrimaryUpdateMessage,
  toProgramUpdateMessage,
  toValuationUpdateMessage,
  type AttestationKind,
  type HeartbeatWire,
  type MarketUpdateWire,
  type PrimaryUpdateWire,
  type ProgramUpdateWire,
  type ValuationUpdateWire,
  type WireMessage,
} from "./attestation.js";
import { publicClientFor, requireHubAddress, submitterAccount, walletClientFor, xLayer, type XLayerPublicClient } from "./chain.js";
import type { Env } from "./env.js";
import { throttleHeartbeats } from "./heartbeatThrottle.js";
import { hubAbi } from "./hubAbi.js";
import { quorumCached } from "./hubReads.js";
import { selectQuorumBatch, type AttestationRow, type QuorumBatchItem } from "./quorum.js";
import { recordFundingAlert, recordSubmission, updateSubmissionStatus } from "./supabaseRecords.js";

const TICK_MS = 1_000;
const REPLACE_AFTER_MS = 10_000;
const FEE_BUMP_NUMERATOR = 120n;
const FEE_BUMP_DENOMINATOR = 100n;
/** PRD §6.5: "priority 0.001 gwei" = 1_000_000 wei. */
const PRIORITY_FEE_PER_GAS = 1_000_000n;
const FUNDING_CHECK_INTERVAL_MS = 60_000;
const FUNDING_LOW_THRESHOLD = parseEther("0.05");
const FUNDING_CRITICAL_THRESHOLD = parseEther("0.01");
const MIN_SUBMITTER_BALANCE = parseEther("0.001");

export interface IngestParams {
  digest: `0x${string}`;
  signer: `0x${string}`;
  signature: `0x${string}`;
  kind: AttestationKind;
  subject: string;
  seq: number | null;
  /** Decimal string — SQLite storage columns don't carry bigint (see SqlStorageValue). */
  epoch: string;
  message: WireMessage;
}

interface AttestationSqlRow extends Record<string, string | number | null> {
  digest: string;
  signer: string;
  signature: string;
  kind: string;
  subject: string;
  seq: number | null;
  epoch: string;
  message: string;
}

interface PendingSubmissionRow extends Record<string, string | number | null> {
  id: number;
  nonce: string;
  tx_hash: string;
  digests: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
  calls: string;
  call_kinds: string;
  submitted_at: number;
}

type ResolvedBatchItem =
  | (QuorumBatchItem & { kind: "MarketUpdate"; message: MarketUpdateWire })
  | (QuorumBatchItem & { kind: "ProgramUpdate"; message: ProgramUpdateWire })
  | (QuorumBatchItem & { kind: "PrimaryUpdate"; message: PrimaryUpdateWire })
  | (QuorumBatchItem & { kind: "ValuationUpdate"; message: ValuationUpdateWire })
  | (QuorumBatchItem & { kind: "Heartbeat"; message: HeartbeatWire });

function asAttestationKind(value: string): AttestationKind | null {
  return (ATTESTATION_KINDS as readonly string[]).includes(value) ? (value as AttestationKind) : null;
}

function resolveBatchItem(item: QuorumBatchItem, rawMessage: unknown): ResolvedBatchItem | null {
  switch (item.kind) {
    case "MarketUpdate": {
      const message = parseMarketUpdateWire(rawMessage);
      return message === null ? null : { ...item, kind: "MarketUpdate", message };
    }
    case "ProgramUpdate": {
      const message = parseProgramUpdateWire(rawMessage);
      return message === null ? null : { ...item, kind: "ProgramUpdate", message };
    }
    case "PrimaryUpdate": {
      const message = parsePrimaryUpdateWire(rawMessage);
      return message === null ? null : { ...item, kind: "PrimaryUpdate", message };
    }
    case "ValuationUpdate": {
      const message = parseValuationUpdateWire(rawMessage);
      return message === null ? null : { ...item, kind: "ValuationUpdate", message };
    }
    case "Heartbeat": {
      const message = parseHeartbeatWire(rawMessage);
      return message === null ? null : { ...item, kind: "Heartbeat", message };
    }
  }
}

function createSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Best-effort decode of a SubmissionFailed event's raw `reason` bytes against BellstateHub's own
 * custom errors (see hubAbi.ts) — falls back to the raw hex when it's a plain Error(string)/
 * Panic(uint256) or something this ABI doesn't know about, rather than throwing. */
function decodeFailureReason(reason: `0x${string}`): string {
  try {
    const decoded = decodeErrorResult({ abi: hubAbi, data: reason });
    return `${decoded.errorName}(${decoded.args?.map(String).join(", ") ?? ""})`;
  } catch {
    return reason;
  }
}

function staleSeqFailure(reason: `0x${string}`): { subject: string; lastSeq: number } | null {
  try {
    const decoded = decodeErrorResult({ abi: hubAbi, data: reason });
    if (decoded.errorName !== "StaleSeq" || !decoded.args) return null;
    const [subject, expected] = decoded.args;
    return { subject: subject.toLowerCase(), lastSeq: expected - 1 };
  } catch {
    return null;
  }
}

/**
 * PRD §6.5/§8.2 — one AttestationStore per aggregator deployment (bound as ATTESTATION_STORE in
 * wrangler.jsonc). It owns three jobs: hold received attestations keyed by digest until they
 * reach quorum, own the submitter EOA's nonce, and run the 1-second batching/submission alarm.
 */
export class AttestationStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS attestations (
          digest TEXT NOT NULL,
          signer TEXT NOT NULL,
          signature TEXT NOT NULL,
          kind TEXT NOT NULL,
          subject TEXT NOT NULL,
          seq INTEGER,
          epoch TEXT NOT NULL,
          message TEXT NOT NULL,
          submission_id INTEGER,
          received_at INTEGER NOT NULL,
          PRIMARY KEY (digest, signer)
        )
      `);
      this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS attestations_kind_subject_idx ON attestations (kind, subject)`);
      this.ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS attestations_submission_id_idx ON attestations (submission_id)`);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nonce TEXT NOT NULL,
          tx_hash TEXT NOT NULL,
          digests TEXT NOT NULL,
          max_fee_per_gas TEXT NOT NULL,
          max_priority_fee_per_gas TEXT NOT NULL,
          calls TEXT NOT NULL,
          call_kinds TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL,
          submitted_at INTEGER NOT NULL
        )
      `);
      // PRD §6.4: "The aggregator submits at most one heartbeat per domain per 60 s." Tracks the
      // last time a heartbeat was actually SUBMITTED (not just attested) for each domain.
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS heartbeat_submissions (
          domain TEXT PRIMARY KEY,
          last_submitted_at INTEGER NOT NULL
        )
      `);
      return Promise.resolve();
    });
  }

  /** Called by worker.ts once it has verified the signature and confirmed the signer is active.
   * Dedup on (digest, signer) is enforced by the primary key. */
  async ingest(params: IngestParams): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO attestations (digest, signer, signature, kind, subject, seq, epoch, message, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.digest.toLowerCase(),
      params.signer.toLowerCase(),
      params.signature,
      params.kind,
      params.subject,
      params.seq,
      params.epoch,
      JSON.stringify(params.message),
      Date.now(),
    );

    const alarm = await this.ctx.storage.getAlarm();
    if (alarm === null) {
      await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    }
  }

  async alarm(): Promise<void> {
    // Reschedule first so a tick that throws never stops the cadence (PRD: "each 1 s alarm tick").
    await this.ctx.storage.setAlarm(Date.now() + TICK_MS);
    try {
      await this.tick();
    } catch (err) {
      console.error("AttestationStore tick failed", err);
    }
  }

  private async tick(): Promise<void> {
    const env = this.env;
    const client = publicClientFor(env);
    const hubAddress = requireHubAddress(env);

    const pending = this.pendingSubmission();
    if (pending) {
      await this.resolvePending(pending, client, hubAddress, env);
      return;
    }

    await this.submitNewBatch(client, hubAddress, env);
    await this.checkFunding(client, env);
  }

  private pendingSubmission(): PendingSubmissionRow | null {
    const rows = this.ctx.storage.sql
      .exec<PendingSubmissionRow>(`SELECT * FROM submissions WHERE status = 'pending' ORDER BY id DESC LIMIT 1`)
      .toArray();
    return rows[0] ?? null;
  }

  private async resolvePending(
    pending: PendingSubmissionRow,
    client: XLayerPublicClient,
    hubAddress: `0x${string}`,
    env: Env,
  ): Promise<void> {
    const txHash = pending.tx_hash as `0x${string}`;
    const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);

    if (receipt) {
      const status = receipt.status === "success" ? "included" : "failed";
      this.ctx.storage.sql.exec(`UPDATE submissions SET status = ? WHERE id = ?`, status, pending.id);

      if (status === "included") {
        await this.reconcileIncludedBatch(pending, receipt, txHash, env);
      } else {
        // Whole-transaction revert (rare — this is the outer submitBatch call itself failing,
        // e.g. out of gas or frozen hub — distinct from an individual facet call inside it
        // failing, which reconcileIncludedBatch handles). Free every row for retry.
        this.ctx.storage.sql.exec(`UPDATE attestations SET submission_id = NULL WHERE submission_id = ?`, pending.id);
        const supabase = createSupabaseClient(env);
        await updateSubmissionStatus(supabase, txHash, {
          status,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.effectiveGasPrice,
        });
      }
      return;
    }

    if (Date.now() - pending.submitted_at < REPLACE_AFTER_MS) return;

    // PRD §6.5: "Not included within 10 s -> replace with +20% fees," same nonce and calldata.
    const newMaxFeePerGas = (BigInt(pending.max_fee_per_gas) * FEE_BUMP_NUMERATOR) / FEE_BUMP_DENOMINATOR;
    const newPriorityFeePerGas = (BigInt(pending.max_priority_fee_per_gas) * FEE_BUMP_NUMERATOR) / FEE_BUMP_DENOMINATOR;
    const calls = JSON.parse(pending.calls) as `0x${string}`[];

    const walletClient = walletClientFor(env);
    const newTxHash = await walletClient.sendTransaction({
      chain: xLayer,
      account: submitterAccount(env),
      to: hubAddress,
      data: encodeFunctionData({ abi: hubAbi, functionName: "submitBatch", args: [calls] }),
      nonce: Number(pending.nonce),
      maxFeePerGas: newMaxFeePerGas,
      maxPriorityFeePerGas: newPriorityFeePerGas,
    });

    this.ctx.storage.sql.exec(`UPDATE submissions SET status = 'replaced' WHERE id = ?`, pending.id);
    const inserted = this.ctx.storage.sql
      .exec<{ id: number }>(
        `INSERT INTO submissions (nonce, tx_hash, digests, max_fee_per_gas, max_priority_fee_per_gas, calls, call_kinds, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`,
        pending.nonce,
        newTxHash,
        pending.digests,
        newMaxFeePerGas.toString(),
        newPriorityFeePerGas.toString(),
        pending.calls,
        pending.call_kinds,
        Date.now(),
      )
      .one();
    this.ctx.storage.sql.exec(`UPDATE attestations SET submission_id = ? WHERE submission_id = ?`, inserted.id, pending.id);

    const supabase = createSupabaseClient(env);
    await updateSubmissionStatus(supabase, txHash, { status: "replaced" });
    await recordSubmission(supabase, {
      txHash: newTxHash,
      nonce: BigInt(pending.nonce),
      digests: JSON.parse(pending.digests) as `0x${string}`[],
      status: "pending",
    });
  }

  /**
   * A successful `submitBatch` transaction receipt does NOT mean every facet call inside it
   * succeeded — BellstateHub.sol's submitBatch wraps each call in a low-level `call()` and emits
   * `SubmissionFailed(index, reason)` per failure instead of reverting the outer tx (§6.5: "A
   * reverted call inside the batch doesn't sink the others"). Decode those events, map each
   * failed index back to its facet kind via the call_kinds recorded at submission time, and only
   * delete attestation rows for kinds that actually succeeded — rows for a failed kind are freed
   * (submission_id = NULL) so the next tick picks them up again, exactly like a whole-tx revert.
   */
  private async reconcileIncludedBatch(
    pending: PendingSubmissionRow,
    receipt: { logs: readonly Log[]; blockNumber: bigint; gasUsed: bigint; effectiveGasPrice: bigint },
    txHash: `0x${string}`,
    env: Env,
  ): Promise<void> {
    const callKinds = JSON.parse(pending.call_kinds) as AttestationKind[];
    const submittedRows = this.ctx.storage.sql
      .exec<{ kind: string; subject: string; seq: number | null }>(
        `SELECT DISTINCT kind, subject, seq FROM attestations WHERE submission_id = ?`, pending.id,
      ).toArray();

    const failures = parseEventLogs({
      abi: hubAbi,
      eventName: "SubmissionFailed",
      logs: [...receipt.logs],
      strict: false,
    });
    const failedKinds = new Set<AttestationKind>();
    const failureDetails: string[] = [];
    const staleFailures: { kind: AttestationKind; subject: string; lastSeq: number }[] = [];

    for (const failure of failures) {
      if (failure.args.index === undefined) continue;
      const index = Number(failure.args.index);
      const kind = callKinds[index];
      if (kind === undefined) {
        console.error(`AttestationStore: SubmissionFailed at index ${index} has no matching call_kinds entry`);
        continue;
      }
      failedKinds.add(kind);
      failureDetails.push(`${kind} (index ${index}): ${decodeFailureReason(failure.args.reason ?? "0x")}`);
      const stale = staleSeqFailure(failure.args.reason ?? "0x");
      if (stale) staleFailures.push({ kind, ...stale });
    }

    if (failedKinds.size > 0) {
      console.error(`AttestationStore: partial batch failure on tx ${txHash}: ${failureDetails.join("; ")}`);
    }

    for (const kind of ATTESTATION_KINDS) {
      if (failedKinds.has(kind)) {
        this.ctx.storage.sql.exec(
          `UPDATE attestations SET submission_id = NULL WHERE submission_id = ? AND kind = ?`,
          pending.id,
          kind,
        );
      } else {
        this.ctx.storage.sql.exec(`DELETE FROM attestations WHERE submission_id = ? AND kind = ?`, pending.id, kind);
      }
    }

    // A successful facet call commits its selected seq. Old unsubmitted digests must go too;
    // otherwise the next alarm can resend them forever as costly StaleSeq failures.
    for (const row of submittedRows) {
      if (row.seq === null || failedKinds.has(row.kind as AttestationKind)) continue;
      this.ctx.storage.sql.exec(
        `DELETE FROM attestations WHERE kind = ? AND subject = ? AND seq <= ? AND submission_id IS NULL`,
        row.kind, row.subject, row.seq,
      );
    }
    for (const failure of staleFailures) {
      this.ctx.storage.sql.exec(
        `DELETE FROM attestations WHERE kind = ? AND subject = ? AND seq <= ? AND submission_id IS NULL`,
        failure.kind, failure.subject, failure.lastSeq,
      );
    }

    const supabase = createSupabaseClient(env);
    await updateSubmissionStatus(supabase, txHash, {
      status: "included",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
      error: failedKinds.size > 0 ? `partial failure: ${failureDetails.join("; ")}` : undefined,
    });
  }

  private async submitNewBatch(client: XLayerPublicClient, hubAddress: `0x${string}`, env: Env): Promise<void> {
    const fetched = this.ctx.storage.sql
      .exec<AttestationSqlRow>(
        `SELECT digest, signer, signature, kind, subject, seq, epoch, message FROM attestations WHERE submission_id IS NULL`,
      )
      .toArray();
    if (fetched.length === 0) return;

    const messageByDigest = new Map<string, string>();
    const attestationRows: AttestationRow[] = [];
    for (const row of fetched) {
      const kind = asAttestationKind(row.kind);
      if (kind === null) {
        console.error(`AttestationStore: dropping row with unknown kind "${row.kind}" for digest ${row.digest}`);
        continue;
      }
      messageByDigest.set(row.digest, row.message);
      attestationRows.push({
        digest: row.digest as `0x${string}`,
        signer: row.signer as `0x${string}`,
        signature: row.signature as `0x${string}`,
        kind,
        subject: row.subject,
        seq: row.seq,
        epoch: BigInt(row.epoch),
      });
    }

    const lastHeartbeatByDomain = new Map<string, number>(
      this.ctx.storage.sql
        .exec<{ domain: string; last_submitted_at: number }>(`SELECT domain, last_submitted_at FROM heartbeat_submissions`)
        .toArray()
        .map((r) => [r.domain, r.last_submitted_at]),
    );
    const { eligible, supersededDigests } = throttleHeartbeats(attestationRows, lastHeartbeatByDomain, Date.now());
    for (const digest of supersededDigests) {
      this.ctx.storage.sql.exec(`DELETE FROM attestations WHERE digest = ? AND submission_id IS NULL`, digest);
    }

    const quorum = await quorumCached(client, hubAddress);
    const selected = selectQuorumBatch(eligible, quorum);
    if (selected.length === 0) return;

    const resolved: ResolvedBatchItem[] = [];
    for (const item of selected) {
      const rawMessage = messageByDigest.get(item.digest);
      const parsed = resolveBatchItem(item, rawMessage === undefined ? null : JSON.parse(rawMessage));
      if (parsed === null) {
        console.error(`AttestationStore: dropping unparseable stored message for digest ${item.digest}`);
        continue;
      }
      resolved.push(parsed);
    }
    if (resolved.length === 0) return;

    const marketItems = resolved.filter((item) => item.kind === "MarketUpdate");
    const marketSeqs = await Promise.all(marketItems.map(async (item) => ({
      subject: item.subject.toLowerCase(),
      seq: (await client.readContract({
        address: hubAddress, abi: hubAbi, functionName: "marketView",
        args: [item.subject as `0x${string}`],
      })).seq,
    })));
    const currentMarketSeq = new Map(marketSeqs.map((item) => [item.subject, item.seq]));
    for (const item of marketItems) {
      const onchainSeq = currentMarketSeq.get(item.subject.toLowerCase());
      if (onchainSeq !== undefined && item.seq !== null && item.seq <= onchainSeq) {
        this.ctx.storage.sql.exec(
          `DELETE FROM attestations WHERE kind = 'MarketUpdate' AND subject = ? AND seq <= ? AND submission_id IS NULL`,
          item.subject, onchainSeq,
        );
      }
    }
    const ready = resolved.filter((item) => item.kind !== "MarketUpdate" || item.seq === null ||
      item.seq > (currentMarketSeq.get(item.subject.toLowerCase()) ?? -1));
    if (ready.length === 0) return;

    const { calls, callKinds } = this.buildCalls(ready);
    if (calls.length === 0) return;

    const block = await client.getBlock();
    if (block.baseFeePerGas === null) {
      throw new Error("chain block has no baseFeePerGas; X Layer is expected to support EIP-1559");
    }
    const maxFeePerGas = block.baseFeePerGas * 2n + PRIORITY_FEE_PER_GAS;

    const account = submitterAccount(env);
    const data = encodeFunctionData({ abi: hubAbi, functionName: "submitBatch", args: [calls] });
    const balance = await client.getBalance({ address: account.address });
    if (balance < MIN_SUBMITTER_BALANCE) {
      await this.checkFunding(client, env);
      return;
    }
    const estimatedGas = await client.estimateGas({ account: account.address, to: hubAddress, data });
    if (balance < estimatedGas * maxFeePerGas) {
      await this.checkFunding(client, env);
      return;
    }

    const nonce = await this.nextNonce(client, env);
    const digests = ready.map((item) => item.digest);

    const walletClient = walletClientFor(env);
    const txHash = await walletClient.sendTransaction({
      chain: xLayer,
      account,
      to: hubAddress,
      data,
      nonce,
      maxFeePerGas,
      maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
    });

    const inserted = this.ctx.storage.sql
      .exec<{ id: number }>(
        `INSERT INTO submissions (nonce, tx_hash, digests, max_fee_per_gas, max_priority_fee_per_gas, calls, call_kinds, status, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`,
        nonce.toString(),
        txHash,
        JSON.stringify(digests),
        maxFeePerGas.toString(),
        PRIORITY_FEE_PER_GAS.toString(),
        JSON.stringify(calls),
        JSON.stringify(callKinds),
        Date.now(),
      )
      .one();

    for (const digest of digests) {
      this.ctx.storage.sql.exec(`UPDATE attestations SET submission_id = ? WHERE digest = ?`, inserted.id, digest);
    }

    const submittedHeartbeatDomains = new Set(ready.filter((i) => i.kind === "Heartbeat").map((i) => i.subject));
    for (const domain of submittedHeartbeatDomains) {
      this.ctx.storage.sql.exec(
        `INSERT INTO heartbeat_submissions (domain, last_submitted_at) VALUES (?, ?)
         ON CONFLICT (domain) DO UPDATE SET last_submitted_at = excluded.last_submitted_at`,
        domain,
        Date.now(),
      );
    }

    const supabase = createSupabaseClient(env);
    await recordSubmission(supabase, { txHash, nonce: BigInt(nonce), digests, status: "pending" });
  }

  /** PRD §6.5: "batch by facet type into one submitBatch(bytes[] calls) transaction" — each facet
   * with at least one qualifying update contributes exactly one encoded call. */
  /** Returns `calls` alongside a parallel `callKinds` array recording which facet kind each call
   * index is — needed later in reconcileIncludedBatch to map a SubmissionFailed(index, reason)
   * event back to which attestation rows actually failed, since submitBatch's per-call try/catch
   * means the outer tx can succeed while one specific facet call inside it reverted. */
  private buildCalls(items: ResolvedBatchItem[]): { calls: `0x${string}`[]; callKinds: AttestationKind[] } {
    const calls: `0x${string}`[] = [];
    const callKinds: AttestationKind[] = [];

    const market = items.filter((i): i is Extract<ResolvedBatchItem, { kind: "MarketUpdate" }> => i.kind === "MarketUpdate");
    if (market.length > 0) {
      calls.push(
        encodeFunctionData({
          abi: hubAbi,
          functionName: "submitMarketUpdates",
          args: [market.map((i) => toMarketUpdateMessage(i.message)), market.map((i) => i.signatures)],
        }),
      );
      callKinds.push("MarketUpdate");
    }

    const program = items.filter((i): i is Extract<ResolvedBatchItem, { kind: "ProgramUpdate" }> => i.kind === "ProgramUpdate");
    if (program.length > 0) {
      calls.push(
        encodeFunctionData({
          abi: hubAbi,
          functionName: "submitProgramUpdates",
          args: [program.map((i) => toProgramUpdateMessage(i.message)), program.map((i) => i.signatures)],
        }),
      );
      callKinds.push("ProgramUpdate");
    }

    const primary = items.filter((i): i is Extract<ResolvedBatchItem, { kind: "PrimaryUpdate" }> => i.kind === "PrimaryUpdate");
    if (primary.length > 0) {
      calls.push(
        encodeFunctionData({
          abi: hubAbi,
          functionName: "submitPrimaryUpdates",
          args: [primary.map((i) => toPrimaryUpdateMessage(i.message)), primary.map((i) => i.signatures)],
        }),
      );
      callKinds.push("PrimaryUpdate");
    }

    const valuation = items.filter(
      (i): i is Extract<ResolvedBatchItem, { kind: "ValuationUpdate" }> => i.kind === "ValuationUpdate",
    );
    if (valuation.length > 0) {
      calls.push(
        encodeFunctionData({
          abi: hubAbi,
          functionName: "submitValuationUpdates",
          args: [valuation.map((i) => toValuationUpdateMessage(i.message)), valuation.map((i) => i.signatures)],
        }),
      );
      callKinds.push("ValuationUpdate");
    }

    const heartbeats = items.filter((i): i is Extract<ResolvedBatchItem, { kind: "Heartbeat" }> => i.kind === "Heartbeat");
    if (heartbeats.length > 0) {
      calls.push(
        encodeFunctionData({
          abi: hubAbi,
          functionName: "submitHeartbeats",
          args: [heartbeats.map((i) => toHeartbeatMessage(i.message)), heartbeats.map((i) => i.signatures)],
        }),
      );
      callKinds.push("Heartbeat");
    }

    return { calls, callKinds };
  }

  /** The DO serializes submissions. Read the pending nonce each time so a failed broadcast
   * cannot reserve a nonce forever while the submitter is out of gas. */
  private async nextNonce(client: XLayerPublicClient, env: Env): Promise<number> {
    const account = submitterAccount(env);
    return client.getTransactionCount({ address: account.address, blockTag: "pending" });
  }

  /**
   * PRD §6.5 "Funding": checks the submitter EOA's real OKB balance against the two thresholds.
   *
   * TODO(deferred): the PRD's ops-alert and `/network` banner are delivered by apps/notifier and
   * rendered by apps/web; reaching either from here needs a queue producer binding this app's
   * wrangler.jsonc doesn't declare, and adding one is an infrastructure/binding-surface change
   * outside this pass's "work only inside apps/aggregator, code only" scope. Until that binding
   * exists, this records the real, live-checked balance into Supabase's ops_audit table (see
   * supabaseRecords.recordFundingAlert) and logs it, which is enough for anyone to alert on by
   * querying Supabase directly.
   */
  private async checkFunding(client: XLayerPublicClient, env: Env): Promise<void> {
    const lastChecked = await this.ctx.storage.get<number>("lastFundingCheckAt");
    const now = Date.now();
    if (lastChecked !== undefined && now - lastChecked < FUNDING_CHECK_INTERVAL_MS) return;
    await this.ctx.storage.put("lastFundingCheckAt", now);

    const account = submitterAccount(env);
    const balance = await client.getBalance({ address: account.address });
    if (balance >= FUNDING_LOW_THRESHOLD) return;

    const level = balance < FUNDING_CRITICAL_THRESHOLD ? "critical" : "low";
    console.error(`aggregator submitter funding ${level}: ${formatEther(balance)} OKB (${account.address})`);
    const supabase = createSupabaseClient(env);
    await recordFundingAlert(supabase, { submitter: account.address, balanceWei: balance, level });
  }
}
