/**
 * PRD §4.1's signer slotting: within each `periodSeconds` window, a signer polls exactly once, at
 * second `slotSeconds`. Pure so the staggering math (and its boundary cases) can be unit tested
 * without touching a Durable Object's alarm.
 */
export function nextSlotAlarmMs(nowMs: number, slotSeconds: number, periodSeconds: number): number {
  if (!Number.isInteger(slotSeconds) || slotSeconds < 0 || slotSeconds >= periodSeconds) {
    throw new Error(`slotSeconds must be an integer in [0, ${periodSeconds}); got ${slotSeconds}`);
  }

  const periodMs = periodSeconds * 1000;
  const slotMs = slotSeconds * 1000;
  const periodStart = Math.floor(nowMs / periodMs) * periodMs;
  const candidate = periodStart + slotMs;

  return candidate > nowMs ? candidate : candidate + periodMs;
}

/** SIGNER_SLOT is deployed as a plain env string (0/20/40 per §4.1). Parsed once at the call site
 * rather than trusted as already-numeric, since Worker env vars are always strings. */
export function parseSignerSlot(raw: string | undefined, periodSeconds: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= periodSeconds) {
    throw new Error(`SIGNER_SLOT must be an integer in [0, ${periodSeconds}); got ${JSON.stringify(raw)}`);
  }
  return n;
}
