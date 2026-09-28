import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyReasonCode } from "../src/codes.js";
import { marketToMic } from "../src/marketMap.js";
import { parseNasdaqHaltFeed } from "../src/parse.js";
import { toHaltRecord } from "../src/toHaltRecord.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

function fixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf-8");
}

// Fixtures captured live from https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts on
// 2026-09-28 (current feed) and with &haltdate=09252026 (historical, letter-coded Mkt field).

describe("parseNasdaqHaltFeed — current feed (2026-09-28)", () => {
  const items = parseNasdaqHaltFeed(fixture("2026-09-28-current.xml"));

  it("parses all 20 items from the captured feed", () => {
    expect(items).toHaveLength(20);
  });

  it("parses LFCR's T3 halt with both resumption times in ET", () => {
    const lfcr = items.find((i) => i.symbol === "LFCR");
    expect(lfcr).toBeDefined();
    expect(lfcr!.reasonCode).toBe("T3");
    expect(lfcr!.market).toBe("NASDAQ");
    // 09/28/2026 08:40:00 ET = 12:40:00Z (EDT, UTC-4)
    expect(lfcr!.haltAt).toBe(Date.parse("2026-09-28T12:40:00Z") / 1000);
    // Resumption trade time 09:50:00 ET = 13:50:00Z
    expect(lfcr!.resumeTradeAt).toBe(Date.parse("2026-09-28T13:50:00Z") / 1000);
  });

  it("converts a Market name to its MIC and the reason code to a category", () => {
    const lfcr = items.find((i) => i.symbol === "LFCR")!;
    expect(marketToMic(lfcr.market)).toBe("XNAS");
    expect(classifyReasonCode(lfcr.reasonCode).category).toBe("NEWS");
  });

  it("toHaltRecord produces the engine's HaltRecord shape", () => {
    const lfcr = items.find((i) => i.symbol === "LFCR")!;
    const record = toHaltRecord(lfcr);
    expect(record).toMatchObject({
      symbol: "LFCR",
      market: "XNAS",
      scope: "ASSET",
      reasonCategory: "NEWS",
      reasonCode: "T3",
    });
  });
});

describe("parseNasdaqHaltFeed — historical feed quirks (2026-09-25, letter Mkt codes)", () => {
  const items = parseNasdaqHaltFeed(fixture("2026-09-25-historical.xml"));

  it("parses all 64 items despite the padded HaltTime quirk", () => {
    expect(items).toHaveLength(64);
  });

  it("strips internal whitespace from a padded HaltTime (§4.1 quirk)", () => {
    // Raw XML has <ndaq:HaltTime>09:32:12                      .540</ndaq:HaltTime>
    const jagx = items.find((i) => i.symbol === "JAGX");
    expect(jagx).toBeDefined();
    // 09/25/2026 09:32:12 ET = 13:32:12Z (EDT, UTC-4)
    expect(jagx!.haltAt).toBe(Date.parse("2026-09-25T13:32:12Z") / 1000);
  });

  it("maps a letter Mkt code to its MIC", () => {
    const jagx = items.find((i) => i.symbol === "JAGX")!;
    expect(jagx.market).toBe("Q");
    expect(marketToMic(jagx.market)).toBe("XNAS");
  });
});

describe("classifyReasonCode", () => {
  it("classifies a market-wide circuit breaker as VENUE-scoped", () => {
    expect(classifyReasonCode("MWC1")).toMatchObject({ category: "MARKET_WIDE", scope: "VENUE" });
  });

  it("falls back to OTHER for an unrecognized code rather than dropping it (§4.1)", () => {
    expect(classifyReasonCode("ZZZ_UNKNOWN")).toMatchObject({ category: "OTHER", scope: "ASSET" });
  });
});

describe("parseNasdaqHaltFeed — still-open halt with no resumption yet (synthetic, not captured)", () => {
  // The live captures above happened to only catch halts with resumption times already posted.
  // This block is a minimal synthetic snippet (not a real capture) covering the still-open case
  // the PRD's <ndaq:ResumptionDate /> empty-tag quirk implies.
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:ndaq="http://www.nasdaqtrader.com/">
  <channel>
    <item>
      <ndaq:IssueSymbol>TEST</ndaq:IssueSymbol>
      <ndaq:Market>NASDAQ</ndaq:Market>
      <ndaq:ReasonCode>T1</ndaq:ReasonCode>
      <ndaq:HaltDate>09/28/2026</ndaq:HaltDate>
      <ndaq:HaltTime>10:00:00.000</ndaq:HaltTime>
      <ndaq:ResumptionDate></ndaq:ResumptionDate>
      <ndaq:ResumptionQuoteTime></ndaq:ResumptionQuoteTime>
      <ndaq:ResumptionTradeTime></ndaq:ResumptionTradeTime>
    </item>
  </channel>
</rss>`;

  it("leaves resumeTradeAt null when no resumption has posted", () => {
    const [item] = parseNasdaqHaltFeed(xml);
    expect(item!.resumeTradeAt).toBeNull();
    expect(item!.resumeQuoteAt).toBeNull();
  });
});
