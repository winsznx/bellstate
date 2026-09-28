import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseHkexAnnouncements } from "@winsznx/bellstate-source-hkex-halts";
import { describe, expect, it } from "vitest";
import { HkHaltsState } from "../src/domains/hkHalts.js";

const FIXTURE = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "sources",
  "hkex-halts",
  "fixtures",
  "2026-09-28-predefineddoc.html",
);

describe("HkHaltsState — real integration against a captured HKEXnews page", () => {
  it("processes the real page without throwing and tracks at least one halt", () => {
    const state = new HkHaltsState();
    state.applyAnnouncements(parseHkexAnnouncements(readFileSync(FIXTURE, "utf-8")));
    expect(state.size()).toBeGreaterThan(0);
  });

  it("08103 (HMVOD) is tracked as an open halt (HALT classification, no matching RESUME row)", () => {
    const state = new HkHaltsState();
    state.applyAnnouncements(parseHkexAnnouncements(readFileSync(FIXTURE, "utf-8")));
    const [record] = state.haltsForListing("08103");
    expect(record).toBeDefined();
    expect(record!.resumeTradeAt).toBeNull();
    expect(record!.reasonCode).toBe("HK:SUSP");
  });
});

describe("HkHaltsState — synthetic ordering scenarios", () => {
  const HALT_AT = 1_700_000_000;

  it("a later RESUME announcement closes an earlier HALT for the same stock code", () => {
    const state = new HkHaltsState();
    state.applyAnnouncements([
      {
        releaseAt: HALT_AT,
        stockCodes: ["00700"],
        stockShortName: "TEST",
        documentTitle: "SUSPENSION OF TRADING",
        classification: "HALT",
      },
    ]);
    expect(state.haltsForListing("00700")[0]!.resumeTradeAt).toBeNull();

    state.applyAnnouncements([
      {
        releaseAt: HALT_AT + 1000,
        stockCodes: ["00700"],
        stockShortName: "TEST",
        documentTitle: "RESUMPTION OF TRADING",
        classification: "RESUME",
      },
    ]);
    expect(state.haltsForListing("00700")[0]!.resumeTradeAt).not.toBeNull();
  });

  it("a resumption with no matching open halt is simply dropped (nothing to close)", () => {
    const state = new HkHaltsState();
    state.applyAnnouncements([
      {
        releaseAt: HALT_AT,
        stockCodes: ["09999"],
        stockShortName: "NOPE",
        documentTitle: "RESUMPTION OF TRADING",
        classification: "RESUME",
      },
    ]);
    expect(state.haltsForListing("09999")).toHaveLength(0);
  });

  it("prune drops resumed halts older than maxAgeSeconds but keeps open halts forever", () => {
    const state = new HkHaltsState();
    state.applyAnnouncements([
      {
        releaseAt: HALT_AT,
        stockCodes: ["00700"],
        stockShortName: "TEST",
        documentTitle: "SUSPENSION OF TRADING",
        classification: "HALT",
      },
      {
        releaseAt: HALT_AT,
        stockCodes: ["00701"],
        stockShortName: "OPEN",
        documentTitle: "TRADING HALT",
        classification: "HALT",
      },
    ]);
    state.applyAnnouncements([
      {
        releaseAt: HALT_AT + 100,
        stockCodes: ["00700"],
        stockShortName: "TEST",
        documentTitle: "RESUMPTION OF TRADING",
        classification: "RESUME",
      },
    ]);

    state.prune(HALT_AT + 200_000, 3600);
    expect(state.haltsForListing("00700")).toHaveLength(0);
    expect(state.haltsForListing("00701")).toHaveLength(1);
  });
});
