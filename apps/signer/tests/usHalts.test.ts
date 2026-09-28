import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNasdaqHaltFeed } from "@winsznx/bellstate-source-nasdaq-halts";
import { parseNyseHaltFeed } from "@winsznx/bellstate-source-nyse-halts";
import { describe, expect, it } from "vitest";
import { UsHaltsState } from "../src/domains/usHalts.js";

const NASDAQ_FIXTURE = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "sources",
  "nasdaq-halts",
  "fixtures",
  "2026-09-28-current.xml",
);
const NYSE_FIXTURE = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "sources",
  "nyse-halts",
  "fixtures",
  "2026-09-28-historical-filter.json",
);

describe("UsHaltsState — real integration against captured Nasdaq + NYSE fixtures", () => {
  it("merges both real feeds without throwing and tracks LFCR's halt", () => {
    const state = new UsHaltsState();
    state.applyNasdaqItems(parseNasdaqHaltFeed(readFileSync(NASDAQ_FIXTURE, "utf-8")));
    state.applyNyseRows(parseNyseHaltFeed(readFileSync(NYSE_FIXTURE, "utf-8")));

    expect(state.size()).toBeGreaterThan(0);
    const lfcr = state.haltsForListing("LFCR", "XNAS");
    expect(lfcr).toHaveLength(1);
    expect(lfcr[0]!.reasonCode).toBe("T3");
  });
});

describe("UsHaltsState — synthetic merge-rule scenarios (§4.1/§4.2)", () => {
  it("Nasdaq's reasonCode wins over NYSE's for the same halt key", () => {
    const state = new UsHaltsState();
    const haltAt = 1_700_000_000;
    state.applyNasdaqItems([
      { symbol: "ABCD", market: "NASDAQ", reasonCode: "T1", haltAt, resumeQuoteAt: null, resumeTradeAt: null },
    ]);
    state.applyNyseRows([
      {
        symbol: "ABCD",
        issuerName: "x",
        sourceExchange: "Nasdaq",
        reason: "LULD Pause",
        haltAt,
        resumeTradeAt: null,
      },
    ]);

    const [record] = state.haltsForListing("ABCD", "XNAS");
    expect(record!.reasonCode).toBe("T1");
    expect(record!.reasonCategory).toBe("NEWS");
  });

  it("NYSE fills a missing resumption Nasdaq hasn't posted yet", () => {
    const state = new UsHaltsState();
    const haltAt = 1_700_000_000;
    state.applyNasdaqItems([
      { symbol: "ABCD", market: "NASDAQ", reasonCode: "T1", haltAt, resumeQuoteAt: null, resumeTradeAt: null },
    ]);
    state.applyNyseRows([
      {
        symbol: "ABCD",
        issuerName: "x",
        sourceExchange: "Nasdaq",
        reason: "News Pending",
        haltAt,
        resumeTradeAt: haltAt + 600,
      },
    ]);

    const [record] = state.haltsForListing("ABCD", "XNAS");
    expect(record!.resumeTradeAt).toBe(haltAt + 600);
    expect(record!.reasonCode).toBe("T1"); // still Nasdaq's, not overwritten
  });

  it("a halt present only in NYSE data still counts (§4.2: whichever source posts first triggers it)", () => {
    const state = new UsHaltsState();
    const haltAt = 1_700_000_000;
    state.applyNyseRows([
      {
        symbol: "WXYZ",
        issuerName: "x",
        sourceExchange: "NYSE",
        reason: "Regulatory Concern",
        haltAt,
        resumeTradeAt: null,
      },
    ]);

    const [record] = state.haltsForListing("WXYZ", "XNYS");
    expect(record).toBeDefined();
    expect(record!.reasonCode).toBe("N:REG");
  });

  it("MWCQ closes every open MWC-coded venue halt, applying to every US MIC", () => {
    const state = new UsHaltsState();
    const haltAt = 1_700_000_000;
    state.applyNasdaqItems([
      { symbol: "MWCB", market: "NASDAQ", reasonCode: "MWC1", haltAt, resumeQuoteAt: null, resumeTradeAt: null },
    ]);

    // Still open before MWCQ — applies to any US-family listing, not just the reporting one.
    expect(state.haltsForListing("SOME_XNYS_LISTING", "XNYS")[0]!.resumeTradeAt).toBeNull();

    const resumeAt = haltAt + 1200;
    state.applyNasdaqItems([
      { symbol: "MWCB", market: "NASDAQ", reasonCode: "MWCQ", haltAt: resumeAt, resumeQuoteAt: null, resumeTradeAt: null },
    ]);

    const record = state.haltsForListing("SOME_XNYS_LISTING", "XNYS")[0]!;
    expect(record.resumeTradeAt).toBe(resumeAt);
  });

  it("prune drops resumed halts older than maxAgeSeconds but keeps open halts forever", () => {
    const state = new UsHaltsState();
    const haltAt = 1_700_000_000;
    state.applyNasdaqItems([
      {
        symbol: "OLD",
        market: "NASDAQ",
        reasonCode: "T3",
        haltAt,
        resumeQuoteAt: null,
        resumeTradeAt: haltAt + 100,
      },
      { symbol: "OPEN", market: "NASDAQ", reasonCode: "T1", haltAt, resumeQuoteAt: null, resumeTradeAt: null },
    ]);

    state.prune(haltAt + 100 + 100_000, 3600);
    expect(state.haltsForListing("OLD", "XNAS")).toHaveLength(0);
    expect(state.haltsForListing("OPEN", "XNAS")).toHaveLength(1);
  });
});
