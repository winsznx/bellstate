import type { Session } from "@winsznx/bellstate-calendars";

/** PRD §3.3 rule 1: "last successful parse ≤ 180s old while any listing in the family is in a
 * non-CLOSED session, else ≤ 1800s." Cross-listing family health is computed by the caller (a
 * signer DO), since a single listing's derivation can't see the rest of its family — this is that
 * caller-side computation, kept pure so the thresholds are unit tested directly. */
const HEALTHY_MAX_AGE_SECONDS_OPEN = 180;
const HEALTHY_MAX_AGE_SECONDS_CLOSED = 1800;

export function isSourceHealthy(nowSeconds: number, lastSuccessAt: number | null, session: Session): boolean {
  if (lastSuccessAt === null) return false;
  const maxAge = session === "CLOSED" ? HEALTHY_MAX_AGE_SECONDS_CLOSED : HEALTHY_MAX_AGE_SECONDS_OPEN;
  return nowSeconds - lastSuccessAt <= maxAge;
}
