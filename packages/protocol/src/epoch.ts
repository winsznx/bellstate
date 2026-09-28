const EPOCH_SECONDS = 15;
const SUBMISSION_LEAD_SECONDS = 15;
const SUBMISSION_TRAIL_SECONDS = 60;

/** PRD §6.3: epoch = floor(unix / 15). */
export function epochOf(unixSeconds: number): bigint {
  return BigInt(Math.floor(unixSeconds / EPOCH_SECONDS));
}

export function epochStart(epoch: bigint): bigint {
  return epoch * BigInt(EPOCH_SECONDS);
}

/** PRD §6.3: the hub accepts a message only if epoch*15 <= blockTimestamp+15 and
 * blockTimestamp <= epoch*15+60. */
export function isFresh(epoch: bigint, blockTimestamp: bigint): boolean {
  const start = epochStart(epoch);
  return start <= blockTimestamp + BigInt(SUBMISSION_LEAD_SECONDS) && blockTimestamp <= start + BigInt(SUBMISSION_TRAIL_SECONDS);
}
