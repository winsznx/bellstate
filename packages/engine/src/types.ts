// Enum orderings match ERC-8392 (Appendix A) and the Bellstate extension (Appendix B.4) exactly,
// including UNKNOWN = 0, so numeric values written onchain by the signer line up 1:1.

export const SESSIONS = ["UNKNOWN", "REGULAR", "EXTENDED", "AUCTION", "CLOSED"] as const;
export type Session = (typeof SESSIONS)[number];

export const INTERRUPTIONS = [
  "UNKNOWN",
  "NONE",
  "PRICE_CONSTRAINED",
  "ASSET_HALTED",
  "VENUE_HALTED",
] as const;
export type Interruption = (typeof INTERRUPTIONS)[number];

export const LIFECYCLES = [
  "UNKNOWN",
  "PRE_ACTIVE",
  "ACTIVE",
  "SETTLEMENT_PENDING",
  "TERMINATED",
] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

export const PROGRAM_STATUSES = ["UNKNOWN", "NORMAL", "SUSPENDED"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const VALUATION_CONDITIONS = [
  "UNKNOWN",
  "UPDATING",
  "EXPECTED_NO_UPDATE",
  "DELAYED",
  "DEGRADED",
  "SUSPENDED",
  "DISPUTED",
] as const;
export type ValuationCondition = (typeof VALUATION_CONDITIONS)[number];

export const REQUEST_STATES = [
  "UNKNOWN",
  "NOT_APPLICABLE",
  "ACCEPTING",
  "RESTRICTED",
  "CLOSED",
  "SUSPENDED",
] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export const REASON_CATEGORIES = [
  "NONE",
  "NEWS",
  "VOLATILITY",
  "REGULATORY",
  "MARKET_WIDE",
  "OPERATIONAL",
  "CORPORATE",
  "IPO",
  "ETF",
  "OTHER",
  "SOURCE_STALE",
] as const;
export type ReasonCategory = (typeof REASON_CATEGORIES)[number];

export const PROGRAM_REASONS = [
  "NONE",
  "ISSUER_PAUSED",
  "CATALOG_MISSING",
  "TOKEN_READ_FAILED",
  "OVERRIDE",
] as const;
export type ProgramReason = (typeof PROGRAM_REASONS)[number];

export const PRIMARY_REASONS = [
  "NONE",
  "NO_TRADING_OBJECT",
  "ISSUER_TRADING_HALTED",
  "XLAYER_LEG_DISABLED",
  "PERIOD_CLOSED",
  "PERIOD_LIMITED",
  "CATALOG_STALE",
] as const;
export type PrimaryReason = (typeof PRIMARY_REASONS)[number];

/** Unix seconds, floored per §3.9's "normalize to whole seconds" determinism rule. */
export type UnixSeconds = number;

// ---- §3.3 Market facet ----

export interface Listing {
  listingId: `0x${string}`;
  mic: string;
  symbol: string;
  /** Alternate symbols the halt source may report this listing under. */
  aliases: string[];
}

/**
 * One halt or resumption record as reported by a venue's halt source (Nasdaq RSS, NYSE JSON,
 * HKEXnews, KIND — §4.1-4.4). `resumeTradeAt` is always the *trade* resumption time: for US
 * quote-only periods (Nasdaq T3 with a later trade time, T7) the source parser is responsible
 * for carrying `ResumptionTradeTime` here, not the earlier quote-only resumption, so the engine
 * never needs to special-case those codes (§3.3).
 */
export interface HaltRecord {
  scope: "VENUE" | "ASSET";
  haltAt: UnixSeconds;
  /** null = still open with no attested resumption estimate. */
  resumeTradeAt: UnixSeconds | null;
  reasonCategory: ReasonCategory;
  /** Up to 8 ASCII bytes, e.g. "T1", "MWC1", "N:LULD". "NONE" is reserved and never emitted here. */
  reasonCode: string;
}

export interface SessionWindow {
  session: Session;
  sessionSince: UnixSeconds;
  nextScheduledTransition: UnixSeconds;
}

export interface MarketSnapshot {
  /**
   * Whether this listing's venue-family halt source is healthy at `t` (§3.3 rule 1: last
   * successful parse ≤ 180s old while any listing in the family is in a non-CLOSED session, else
   * ≤ 1800s). Cross-listing family health is computed by the caller (a signer DO), since a single
   * listing's derivation can't see the rest of its family.
   */
  sourceHealthy: boolean;
  sessionWindow: SessionWindow;
  /**
   * Every venue-wide and asset-specific halt/resumption record present in the source's current
   * window for this listing (open or not) — the engine does all open/governing selection.
   */
  halts: HaltRecord[];
}

export interface MarketState {
  session: Session;
  interruption: Interruption;
  reasonCategory: ReasonCategory;
  /** "NONE" sentinel when interruption is NONE or UNKNOWN. */
  reasonCode: string;
  sessionSince: UnixSeconds;
  nextScheduledTransition: UnixSeconds;
  interruptionSince: UnixSeconds;
  expectedResumption: UnixSeconds;
}

// ---- §3.4 Program facet ----

export interface LifecycleOverride {
  lifecycle: "SETTLEMENT_PENDING" | "TERMINATED";
  evidenceHash: `0x${string}`;
}

export interface ProgramCatalogView {
  /** Age of the catalog snapshot backing this view, in seconds. */
  ageSeconds: number;
  hasXLayerDeployment: boolean;
}

export interface TokenPauseView {
  /** null = the read failed (call reverted, wrong return type, or timed out). */
  rawPaused: boolean | null;
  wrappedPaused: boolean | null;
}

export interface ProgramSnapshot {
  override: LifecycleOverride | null;
  catalog: ProgramCatalogView;
  bothTokensHaveCode: boolean;
  registeredInHub: boolean;
  pause: TokenPauseView;
}

export interface ProgramState {
  lifecycle: Lifecycle;
  lifecycleOverride: LifecycleOverride | null;
  programStatus: ProgramStatus;
  programReason: ProgramReason;
}

// ---- §3.5 Primary facet ----

export interface XLayerLegAvailability {
  issuanceEnabledByAnyStablecoin: boolean;
  redemptionEnabledByAnyStablecoin: boolean;
}

export interface PeriodLimit {
  max: number;
}

export interface PrimaryCatalogView {
  /** Age of the catalog snapshot backing this view, in seconds. Must be ≤ 180s (§3.5). */
  ageSeconds: number;
  trading: {
    isTradingHalted: boolean;
    nextChangeAt: UnixSeconds | null;
    limitsPerPeriod: Record<string, PeriodLimit> & { market: PeriodLimit };
    currentPeriod: string;
  } | null;
  xlayer: XLayerLegAvailability;
}

export interface PrimaryLegState {
  state: RequestState;
  reason: PrimaryReason;
}

export interface PrimaryState {
  issuance: PrimaryLegState;
  redemption: PrimaryLegState;
  nextScheduledChange: UnixSeconds;
  nextCutoff: UnixSeconds;
}

// ---- §3.6 Valuation facet ----

export type SourceMarketStatus = "OPEN" | "CLOSED" | "UNKNOWN";

export interface ValuationReport {
  /** How many seconds ago this report was fetched, relative to `t`. Must be ≤ 60s to use it. */
  fetchedSecondsAgo: number;
  lastUpdateTimestamp: UnixSeconds;
  marketStatus: SourceMarketStatus;
}

export interface ValuationMarketView {
  interruption: Interruption;
  expectedResumption: UnixSeconds;
}

export interface ValuationState {
  condition: ValuationCondition;
  valueAsOf: UnixSeconds;
  nextExpectedUpdate: UnixSeconds;
  conditionSince: UnixSeconds;
  sourceMarketStatus: SourceMarketStatus;
}
