/**
 * PRD §8.6: "Detection uses Bellstate's attested status from status_history at each instant,
 * never raw source data." This module reads `status_current` instead of `status_history` — the
 * table that mirrors the *current* effective status per (facet, subject_id) (packages/db's own
 * schema comment calls it "Effective status (mirrors onchain state)"), which is what "at each
 * instant" means for a live 5s poller. `status_history` is the append-only per-change log (it
 * carries indexing metadata — log_index, block_number, t_indexed — that only matters for
 * audit/replay, e.g. apps/watch's own S09 Replay player, not for "what is true right now").
 * Reading `status_current` was also this build task's own explicit data-source instruction.
 *
 * The enum orderings below mirror packages/engine/src/types.ts's SESSIONS/INTERRUPTIONS exactly
 * (that file's own comment: matches ERC-8392 Appendix A, stable onchain numeric values). They are
 * duplicated here — not imported — because apps/watch/package.json does not declare
 * @winsznx/bellstate-engine as a workspace dependency, and this build task's constraints forbid
 * both `pnpm add` and editing package.json. See README.md's "Deferred" section.
 */

export const SESSIONS = ["UNKNOWN", "REGULAR", "EXTENDED", "AUCTION", "CLOSED"] as const;
export type Session = (typeof SESSIONS)[number];

export const INTERRUPTIONS = ["UNKNOWN", "NONE", "PRICE_CONSTRAINED", "ASSET_HALTED", "VENUE_HALTED"] as const;
export type Interruption = (typeof INTERRUPTIONS)[number];

export interface ListingStatus {
  listingId: string;
  session: Session;
  interruption: Interruption;
  /** Unix seconds the current `session` value began (record.sessionSince). 0 when unknown. */
  sessionSince: number;
}

export interface StatusCurrentRecord {
  record: Record<string, unknown>;
}

const UNKNOWN_SESSION_SINCE = 0;

/**
 * apps/indexer's toStatusCurrentRow (the real, tested writer for this column) stores `session`
 * and `interruption` as the raw onchain uint8 values, and stringifies uint64 fields such as
 * `sessionSince` before writing (its own doc comment: JSON.stringify throws on bigint). This
 * reads both a JSON number and a stringified number for every numeric field defensively.
 */
function toFiniteInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Decodes one status_current row (facet='market') into a named session/interruption pair. A
 * missing row (no attestation yet for this listing) or a malformed one decodes to UNKNOWN/
 * UNKNOWN with sessionSince 0 — a status that never satisfies any of §8.6's three flag rules, so
 * absent data can only suppress a flag, never fabricate one.
 */
export function decodeMarketStatus(row: StatusCurrentRecord | undefined, listingId: string): ListingStatus {
  if (!row) {
    return { listingId, session: "UNKNOWN", interruption: "UNKNOWN", sessionSince: UNKNOWN_SESSION_SINCE };
  }

  const sessionIndex = toFiniteInt(row.record.session);
  const interruptionIndex = toFiniteInt(row.record.interruption);
  const sessionSince = toFiniteInt(row.record.sessionSince);
  const nextScheduledTransition = toFiniteInt(row.record.nextScheduledTransition);

  // A signed observation does not establish the session after its next scheduled transition.
  // Suppress flags until a fresh attestation arrives, as the Board does for stale status.
  if (nextScheduledTransition !== null && nextScheduledTransition > 0 && nextScheduledTransition <= Date.now() / 1000) {
    return { listingId, session: "UNKNOWN", interruption: "UNKNOWN", sessionSince: UNKNOWN_SESSION_SINCE };
  }

  const session = sessionIndex !== null ? SESSIONS[sessionIndex] : undefined;
  const interruption = interruptionIndex !== null ? INTERRUPTIONS[interruptionIndex] : undefined;

  return {
    listingId,
    session: session ?? "UNKNOWN",
    interruption: interruption ?? "UNKNOWN",
    sessionSince: sessionSince ?? UNKNOWN_SESSION_SINCE,
  };
}
