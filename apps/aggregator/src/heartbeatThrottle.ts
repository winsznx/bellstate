import type { AttestationRow } from "./quorum.js";

/** PRD §6.4: "The aggregator submits at most one heartbeat per domain per 60 s." Heartbeat
 * digests change every epoch (15s) even when nothing in the domain actually changed, so without
 * this throttle the aggregator would submit a new heartbeat transaction roughly every 15s per
 * domain, forever — a real, unbounded gas cost the PRD explicitly caps. Pure and network-free,
 * like quorum.ts, so it's unit-testable without a DO.
 *
 * Note: the attestations table is keyed by (digest, signer), so a single heartbeat digest can
 * have multiple rows — one per signer who's attested it. Every row for the winning digest must be
 * kept together (selectQuorumBatch needs all of them to count quorum), so this groups by digest,
 * not just by domain. */

export const HEARTBEAT_MIN_INTERVAL_MS = 60_000;

export interface HeartbeatThrottleResult {
  /** Rows safe to pass into selectQuorumBatch this tick — every non-Heartbeat row, plus every row
   * (across all signers) for at most one Heartbeat digest per domain (the highest-epoch one),
   * only when that domain's 60s window has elapsed. */
  eligible: AttestationRow[];
  /** Digests of Heartbeat rows superseded by a higher-epoch digest for the same domain,
   * regardless of throttle state — safe to delete immediately so the table doesn't grow one row
   * per domain per epoch forever. */
  supersededDigests: `0x${string}`[];
}

export function throttleHeartbeats(
  rows: readonly AttestationRow[],
  lastSubmittedAtByDomain: ReadonlyMap<string, number>,
  nowMs: number,
): HeartbeatThrottleResult {
  const eligible: AttestationRow[] = [];
  const bestEpochByDomain = new Map<string, bigint>();
  const bestDigestByDomain = new Map<string, `0x${string}`>();

  for (const row of rows) {
    if (row.kind !== "Heartbeat") continue;
    const best = bestEpochByDomain.get(row.subject);
    if (best === undefined || row.epoch > best) {
      bestEpochByDomain.set(row.subject, row.epoch);
      bestDigestByDomain.set(row.subject, row.digest);
    }
  }

  const domainIsDue = new Map<string, boolean>();
  for (const domain of bestEpochByDomain.keys()) {
    const lastSubmittedAt = lastSubmittedAtByDomain.get(domain);
    const dueAt = lastSubmittedAt === undefined ? -Infinity : lastSubmittedAt + HEARTBEAT_MIN_INTERVAL_MS;
    domainIsDue.set(domain, nowMs >= dueAt);
  }

  const supersededDigests: `0x${string}`[] = [];
  for (const row of rows) {
    if (row.kind !== "Heartbeat") {
      eligible.push(row);
      continue;
    }
    const isWinningDigest = row.digest === bestDigestByDomain.get(row.subject);
    if (!isWinningDigest) {
      supersededDigests.push(row.digest);
      continue;
    }
    if (domainIsDue.get(row.subject)) {
      eligible.push(row);
    }
    // else: the winning digest, but this domain's 60s window hasn't elapsed yet — leave the row
    // in place, un-submitted, so it's reconsidered (and re-throttled) on a later tick.
  }

  return { eligible, supersededDigests };
}
