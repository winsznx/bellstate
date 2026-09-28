import {
  INTERRUPTIONS,
  LIFECYCLES,
  PRIMARY_REASONS,
  PROGRAM_REASONS,
  PROGRAM_STATUSES,
  REASON_CATEGORIES,
  REQUEST_STATES,
  SESSIONS,
  VALUATION_CONDITIONS,
  type Interruption,
  type Lifecycle,
  type PrimaryReason,
  type ProgramReason,
  type ProgramStatus,
  type ReasonCategory,
  type RequestState,
  type Session,
  type SourceMarketStatus,
  type ValuationCondition,
} from "@winsznx/bellstate-engine";

function indexOf<T extends string>(values: readonly T[], value: T): number {
  const i = values.indexOf(value);
  if (i < 0) throw new Error(`unknown enum value: ${value}`);
  return i;
}

export const sessionIndex = (v: Session): number => indexOf(SESSIONS, v);
export const interruptionIndex = (v: Interruption): number => indexOf(INTERRUPTIONS, v);
export const lifecycleIndex = (v: Lifecycle): number => indexOf(LIFECYCLES, v);
export const programStatusIndex = (v: ProgramStatus): number => indexOf(PROGRAM_STATUSES, v);
export const valuationConditionIndex = (v: ValuationCondition): number => indexOf(VALUATION_CONDITIONS, v);
export const requestStateIndex = (v: RequestState): number => indexOf(REQUEST_STATES, v);
export const reasonCategoryIndex = (v: ReasonCategory): number => indexOf(REASON_CATEGORIES, v);
export const programReasonIndex = (v: ProgramReason): number => indexOf(PROGRAM_REASONS, v);
export const primaryReasonIndex = (v: PrimaryReason): number => indexOf(PRIMARY_REASONS, v);

/** PRD §6.4 / Appendix B.4 — 1-indexed, unlike the ERC-8392 UNKNOWN=0 enums above. */
export const DOMAIN_IDS = {
  US_MARKETS: 1,
  HK_MARKETS: 2,
  KR_MARKETS: 3,
  PROGRAMS: 4,
  PRIMARY: 5,
  VALUATION: 6,
} as const;

/**
 * Not enumerated in the PRD's appendices (sourceMarketStatus is a Bellstate extension field,
 * §3.7). UNKNOWN = 0 follows the convention used by every other Bellstate enum.
 */
const SOURCE_MARKET_STATUSES: readonly SourceMarketStatus[] = ["UNKNOWN", "OPEN", "CLOSED"];
export const sourceMarketStatusIndex = (v: SourceMarketStatus): number => indexOf(SOURCE_MARKET_STATUSES, v);
