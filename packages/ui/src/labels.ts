import type { Interruption, Lifecycle, RequestState, Session, ValuationCondition } from "@winsznx/bellstate-engine";

/** PRD §11.3's field label table, verbatim. */

export const SESSION_LABELS: Record<Session, string> = {
  REGULAR: "Regular",
  EXTENDED: "Extended",
  AUCTION: "Auction",
  CLOSED: "Closed",
  UNKNOWN: "Unknown",
};

export const INTERRUPTION_LABELS: Record<Interruption, string> = {
  NONE: "None",
  PRICE_CONSTRAINED: "Price-limited",
  ASSET_HALTED: "Halted",
  VENUE_HALTED: "Venue halted",
  UNKNOWN: "Unknown",
};

export const VALUATION_LABELS: Record<ValuationCondition, string> = {
  UPDATING: "Updating",
  EXPECTED_NO_UPDATE: "No update due",
  DELAYED: "Delayed",
  DEGRADED: "Degraded",
  SUSPENDED: "Suspended",
  DISPUTED: "Disputed",
  UNKNOWN: "Unknown",
};
/** A program with no designated valuation stream advertises no IReferenceValuationStatus facet
 * at all (§3.2) — the UI's own sentinel for "there's no valuation row to show," not an engine
 * ValuationCondition value. */
export const VALUATION_NOT_PROVIDED_LABEL = "Not provided";

export const PRIMARY_LEG_LABELS: Record<RequestState, string> = {
  ACCEPTING: "Accepting",
  RESTRICTED: "Restricted",
  CLOSED: "Closed",
  SUSPENDED: "Suspended",
  NOT_APPLICABLE: "N/A",
  UNKNOWN: "Unknown",
};

export const PROGRAM_LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  ACTIVE: "Active",
  SETTLEMENT_PENDING: "Settlement pending",
  TERMINATED: "Terminated",
  PRE_ACTIVE: "Pre-active",
  UNKNOWN: "Unknown",
};
