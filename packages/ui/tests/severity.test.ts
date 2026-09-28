import { describe, expect, it } from "vitest";
import { compareBySeverity, marketSeverityRank } from "../src/severity.js";

describe("marketSeverityRank — PRD §11.3 order", () => {
  it("ranks VENUE_HALTED as most severe", () => {
    expect(marketSeverityRank({ session: "REGULAR", interruption: "VENUE_HALTED" })).toBe(0);
  });

  it("ranks the full order exactly as the PRD lists it", () => {
    const ranks = [
      marketSeverityRank({ session: "REGULAR", interruption: "VENUE_HALTED" }),
      marketSeverityRank({ session: "REGULAR", interruption: "ASSET_HALTED" }),
      marketSeverityRank({ session: "UNKNOWN", interruption: "NONE" }),
      marketSeverityRank({ session: "REGULAR", interruption: "PRICE_CONSTRAINED" }),
      marketSeverityRank({ session: "AUCTION", interruption: "NONE" }),
      marketSeverityRank({ session: "REGULAR", interruption: "NONE" }),
      marketSeverityRank({ session: "EXTENDED", interruption: "NONE" }),
      marketSeverityRank({ session: "CLOSED", interruption: "NONE" }),
    ];
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(8);
  });

  it("compareBySeverity sorts a mixed list correctly", () => {
    const items = [
      { session: "CLOSED", interruption: "NONE" },
      { session: "REGULAR", interruption: "VENUE_HALTED" },
      { session: "REGULAR", interruption: "NONE" },
    ] as const;
    const sorted = [...items].sort(compareBySeverity);
    expect(sorted[0]!.interruption).toBe("VENUE_HALTED");
    expect(sorted[2]!.session).toBe("CLOSED");
  });
});
