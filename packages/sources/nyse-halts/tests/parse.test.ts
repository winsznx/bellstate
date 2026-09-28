import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyNyseReason } from "../src/codes.js";
import { parseNyseHaltFeed, parsedTotalCount } from "../src/parse.js";
import { toHaltRecord } from "../src/toHaltRecord.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

// Captured live from
// https://www.nyse.com/api/trade-halts/historical/filter?haltDateFrom=2026-09-01&haltDateTo=2026-09-28&pageNumber=1
// on 2026-09-28.

describe("parseNyseHaltFeed", () => {
  const json = fixture("2026-09-28-historical-filter.json");
  const rows = parseNyseHaltFeed(json);

  it("reports the API's totalCount separately from this page's row count", () => {
    expect(parsedTotalCount(json)).toBe(1030);
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("parses a row with a real resumption date/time", () => {
    const wzrd = rows.find((r) => r.symbol === "WZRD");
    expect(wzrd).toBeDefined();
    expect(wzrd!.reason).toBe("LULD Pause");
    expect(wzrd!.resumeTradeAt).not.toBeNull();
  });

  it('treats the "See Subsequent Halt" sentinel as no known resumption, not a crash (real quirk)', () => {
    const sbxd = rows.find((r) => r.symbol === "SBXD");
    expect(sbxd).toBeDefined();
    expect(sbxd!.resumeTradeAt).toBeNull();
  });

  it("leaves resumeTradeAt null for a still-open halt (formatedResumptionDate: null)", () => {
    const mtnb = rows.find((r) => r.symbol === "MTNB");
    expect(mtnb).toBeDefined();
    expect(mtnb!.resumeTradeAt).toBeNull();
  });

  it("toHaltRecord classifies a known reason and stays ASSET-scoped", () => {
    const wzrd = rows.find((r) => r.symbol === "WZRD")!;
    const record = toHaltRecord(wzrd);
    expect(record).toMatchObject({ scope: "ASSET", reasonCategory: "VOLATILITY", reasonCode: "N:LULD" });
  });
});

describe("classifyNyseReason", () => {
  it("classifies every known Appendix B.2 reason", () => {
    expect(classifyNyseReason("News Pending")).toEqual({ category: "NEWS", reasonCode: "N:NEWSP" });
    expect(classifyNyseReason("News Dissemination")).toEqual({ category: "NEWS", reasonCode: "N:NEWSD" });
    expect(classifyNyseReason("LULD Pause")).toEqual({ category: "VOLATILITY", reasonCode: "N:LULD" });
    expect(classifyNyseReason("Corporate Action")).toEqual({ category: "CORPORATE", reasonCode: "N:CORP" });
    expect(classifyNyseReason("Regulatory Concern")).toEqual({ category: "REGULATORY", reasonCode: "N:REG" });
  });

  it("falls back to OTHER/N:OTHER for anything else, never dropping the row", () => {
    expect(classifyNyseReason("Some New Reason NYSE Adds Later")).toEqual({
      category: "OTHER",
      reasonCode: "N:OTHER",
    });
  });
});
