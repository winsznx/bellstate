import type { Lifecycle, MarketState } from "@winsznx/bellstate-engine";

export interface BoardRow {
  symbol: string;
  underlyingSymbol: string;
  name: string;
  mic: string;
  venueName: string;
  market: MarketState;
  valuationCondition: "UPDATING" | "EXPECTED_NO_UPDATE" | "DELAYED" | "DEGRADED" | "SUSPENDED" | "DISPUTED" | "UNKNOWN" | "NOT_PROVIDED";
  primaryIssuance: "ACCEPTING" | "RESTRICTED" | "CLOSED" | "SUSPENDED" | "NOT_APPLICABLE" | "UNKNOWN";
  programLifecycle: Lifecycle;
  listingId?: string;
  programId?: string;
  isin?: string;
  tokenAddresses?: string[];
  effectiveAsOf?: string;
  homeMarkets?: { mic: string; session: MarketState["session"] }[];
}
