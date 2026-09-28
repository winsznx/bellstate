import type { Log } from "viem";
import type { StatusUpdateEvent } from "./decodeHubLog.js";

/**
 * Matches packages/db's status_history/status_current column shapes (§9.1). Timestamps are left
 * as unix seconds / bigint here — the DO wrapper that actually writes to Supabase converts to
 * `timestamptz`, since that conversion needs the DO's own clock for t_indexed/t_included.
 *
 * `record` can contain bigint values (uint64 event args) — `JSON.stringify` throws on those, so
 * the Supabase client call must serialize with a bigint-aware replacer (e.g. `String(v)`) before
 * writing to the jsonb column. Not this module's job since it doesn't touch the DB client.
 */

function subjectId(event: StatusUpdateEvent): `0x${string}` {
  return event.eventName === "MarketUpdated" ? event.args.listingId : event.args.programId;
}

function record(event: StatusUpdateEvent): Record<string, unknown> {
  // Everything except the columns that get their own row fields (subjectId, seq).
  const { ...args } = event.args as Record<string, unknown>;
  const { listingId: _l, programId: _p, seq: _s, ...rest } = args;
  return rest;
}

export interface StatusHistoryRow {
  facet: StatusUpdateEvent["facet"];
  subject_id: `0x${string}`;
  record: Record<string, unknown>;
  seq: number;
  tx_hash: `0x${string}` | null;
  log_index: number | null;
  block_number: bigint | null;
}

export function toStatusHistoryRow(event: StatusUpdateEvent, log: Log): StatusHistoryRow {
  return {
    facet: event.facet,
    subject_id: subjectId(event),
    record: record(event),
    seq: event.args.seq,
    tx_hash: log.transactionHash,
    log_index: log.logIndex,
    block_number: log.blockNumber,
  };
}

export interface StatusCurrentRow {
  facet: StatusUpdateEvent["facet"];
  subject_id: `0x${string}`;
  record: Record<string, unknown>;
  seq: number;
  tx_hash: `0x${string}` | null;
}

/** §8.3: "Upserts are idempotent on (facet, subject_id)." Caller only applies this when
 * `event.args.seq` is greater than the currently stored seq — reorg/out-of-order safety is the
 * DO's responsibility (it tracks the last 20 block hashes), not this pure mapping. */
export function toStatusCurrentRow(event: StatusUpdateEvent, log: Log): StatusCurrentRow {
  return {
    facet: event.facet,
    subject_id: subjectId(event),
    record: record(event),
    seq: event.args.seq,
    tx_hash: log.transactionHash,
  };
}
