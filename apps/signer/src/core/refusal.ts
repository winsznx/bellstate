/**
 * PRD §8.1: "A signer refuses to sign, and reports why on /health, when: its calendar version !=
 * the hub's; the hub is frozen; its clock is > 5s off the latest block timestamp." Pure so every
 * refusal condition (and their combinations) is unit tested without a live RPC connection.
 */
export interface RefusalCheckInput {
  localCalendarVersion: number;
  hubCalendarVersion: number;
  nowSeconds: number;
  /** Hub's `frozenUntil()` — a unix timestamp the hub rejects submissions until. */
  frozenUntil: number;
  latestBlockTimestamp: number;
  maxClockSkewSeconds: number;
}

export function computeRefusalReasons(input: RefusalCheckInput): string[] {
  const { localCalendarVersion, hubCalendarVersion, nowSeconds, frozenUntil, latestBlockTimestamp, maxClockSkewSeconds } =
    input;
  const reasons: string[] = [];

  if (localCalendarVersion !== hubCalendarVersion) {
    reasons.push(`calendar_version_mismatch: local=${localCalendarVersion} hub=${hubCalendarVersion}`);
  }

  if (nowSeconds < frozenUntil) {
    reasons.push(`hub_frozen_until=${frozenUntil}`);
  }

  const skewSeconds = Math.abs(nowSeconds - latestBlockTimestamp);
  if (skewSeconds > maxClockSkewSeconds) {
    reasons.push(`clock_skew_${skewSeconds}s_exceeds_${maxClockSkewSeconds}s`);
  }

  return reasons;
}
