import type { ListingStatus } from "./status.js";

/**
 * PRD §8.6's three Oracle Watch flag rules, as pure functions over plain data: a price sample
 * series and already-decoded listing statuses. No network, Durable Object or Supabase access
 * happens in this file, so every rule is directly unit-testable and — per S07's "Done when: a
 * rule evaluated on live data matches the same rule re-run offline on the stored snapshots" — can
 * be re-run byte-for-byte against `perp_snapshots` rows later.
 */

export interface OracleSample {
  /** Unix seconds. */
  t: number;
  oraclePx: number;
}

export type FlagName = "THIN_OPEN_MOVE" | "CLOSED_MOVE" | "HALTED_MOVE";

export interface FlagMatch {
  flag: FlagName;
  /** Signed fraction, e.g. 0.031 for a +3.1% move. */
  movePct: number;
  windowStart: number;
  windowEnd: number;
}

export interface PriceDelta {
  movePct: number;
  windowStart: number;
  windowEnd: number;
}

export const OPEN_MOVE_THRESHOLD = 0.03;
export const CLOSED_MOVE_THRESHOLD = 0.03;
export const HALTED_MOVE_THRESHOLD = 0.01;
export const DELTA_WINDOW_SECONDS = 60;

/**
 * |Δ oraclePx| over the trailing `windowSeconds`: the newest sample against the oldest sample
 * that still falls within the window. Returns null when there's under 2 samples, or the oldest
 * in-window sample is priced at 0 (a % move is undefined against a zero base).
 */
export function computePriceDelta(samples: OracleSample[], windowSeconds: number = DELTA_WINDOW_SECONDS): PriceDelta | null {
  if (samples.length < 2) return null;

  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;

  const inWindow = sorted.filter((s) => s.t >= latest.t - windowSeconds);
  const earliest = inWindow[0];
  if (!earliest || earliest.t === latest.t || earliest.oraclePx === 0) return null;

  return {
    movePct: (latest.oraclePx - earliest.oraclePx) / earliest.oraclePx,
    windowStart: earliest.t,
    windowEnd: latest.t,
  };
}

function isSessionFreshlyOpened(status: ListingStatus, now: number, withinSeconds: number): boolean {
  const age = now - status.sessionSince;
  return age >= 0 && age <= withinSeconds;
}

/**
 * THIN_OPEN_MOVE — |Δ| >= 3% within 60s, starting inside the first 60s of a mapped secondary
 * venue's EXTENDED session while the primary listing is not REGULAR (the Jul 28 signature).
 *
 * Interpretive call: the PRD phrase "starting inside the first 60s of ... EXTENDED session" is
 * read here as "evaluated within the first 60s of that session" (checking `now`, the tick time,
 * against `sessionSince`), not "the price-delta window's own start time falls within that first
 * 60s." Since a tick runs every 5s and the delta window is itself 60s wide, this can flag a move
 * whose window partly predates the session's open. Defensible given the PRD's ambiguity, but a
 * judgment call, not the only valid reading.
 */
export function checkThinOpenMove(
  delta: PriceDelta | null,
  primary: ListingStatus,
  secondaries: ListingStatus[],
  now: number,
): FlagMatch | null {
  if (!delta || Math.abs(delta.movePct) < OPEN_MOVE_THRESHOLD) return null;
  if (primary.session === "REGULAR") return null;

  const hasFreshlyOpenedSecondaryExtended = secondaries.some(
    (s) => s.session === "EXTENDED" && isSessionFreshlyOpened(s, now, DELTA_WINDOW_SECONDS),
  );
  if (!hasFreshlyOpenedSecondaryExtended) return null;

  return { flag: "THIN_OPEN_MOVE", movePct: delta.movePct, windowStart: delta.windowStart, windowEnd: delta.windowEnd };
}

/** CLOSED_MOVE — |Δ| >= 3% within 60s while every mapped listing is CLOSED. */
export function checkClosedMove(delta: PriceDelta | null, allListings: ListingStatus[]): FlagMatch | null {
  if (!delta || Math.abs(delta.movePct) < CLOSED_MOVE_THRESHOLD) return null;
  if (allListings.length === 0) return null;
  if (!allListings.every((l) => l.session === "CLOSED")) return null;

  return { flag: "CLOSED_MOVE", movePct: delta.movePct, windowStart: delta.windowStart, windowEnd: delta.windowEnd };
}

/** HALTED_MOVE — |Δ| >= 1% within 60s while the primary listing is ASSET_HALTED or VENUE_HALTED. */
export function checkHaltedMove(delta: PriceDelta | null, primary: ListingStatus): FlagMatch | null {
  if (!delta || Math.abs(delta.movePct) < HALTED_MOVE_THRESHOLD) return null;
  if (primary.interruption !== "ASSET_HALTED" && primary.interruption !== "VENUE_HALTED") return null;

  return { flag: "HALTED_MOVE", movePct: delta.movePct, windowStart: delta.windowStart, windowEnd: delta.windowEnd };
}

export interface EvaluateFlagsInput {
  samples: OracleSample[];
  now: number;
  primary: ListingStatus;
  secondaries: ListingStatus[];
  /** Every listing mapped to this market (primary + secondaries), for CLOSED_MOVE. */
  allListings: ListingStatus[];
}

/** Runs all three rules against one market's current tick. A tick can match more than one rule. */
export function evaluateFlags(input: EvaluateFlagsInput): FlagMatch[] {
  const delta = computePriceDelta(input.samples);
  const matches: FlagMatch[] = [];

  const thinOpen = checkThinOpenMove(delta, input.primary, input.secondaries, input.now);
  if (thinOpen) matches.push(thinOpen);

  const closed = checkClosedMove(delta, input.allListings);
  if (closed) matches.push(closed);

  const halted = checkHaltedMove(delta, input.primary);
  if (halted) matches.push(halted);

  return matches;
}
