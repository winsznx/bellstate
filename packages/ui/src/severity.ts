import type { MarketState } from "@winsznx/bellstate-engine";

/** PRD §11.3: "Severity order (sorting and emphasis): Venue halted > Halted > Unknown >
 * Price-limited > Auction > Regular > Extended > Closed." A single combined rank across both
 * the interruption and session axes — interruption dominates except where either is UNKNOWN. */
export function marketSeverityRank(state: Pick<MarketState, "session" | "interruption">): number {
  if (state.interruption === "VENUE_HALTED") return 0;
  if (state.interruption === "ASSET_HALTED") return 1;
  if (state.session === "UNKNOWN" || state.interruption === "UNKNOWN") return 2;
  if (state.interruption === "PRICE_CONSTRAINED") return 3;
  switch (state.session) {
    case "AUCTION":
      return 4;
    case "REGULAR":
      return 5;
    case "EXTENDED":
      return 6;
    case "CLOSED":
      return 7;
  }
}

export function compareBySeverity(
  a: Pick<MarketState, "session" | "interruption">,
  b: Pick<MarketState, "session" | "interruption">,
): number {
  return marketSeverityRank(a) - marketSeverityRank(b);
}
