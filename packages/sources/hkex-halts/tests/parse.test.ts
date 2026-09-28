import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHkexAnnouncements } from "../src/parse.js";
import { toHaltOpens, toResumptions } from "../src/toHaltRecord.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(__dirname, "..", "fixtures", "2026-09-28-predefineddoc.html"), "utf-8");

// Captured live from
// https://www1.hkexnews.hk/search/predefineddoc.xhtml?predefineddocuments=9 on 2026-09-28.

describe("parseHkexAnnouncements", () => {
  const announcements = parseHkexAnnouncements(fixture);

  it("parses a real page of rows", () => {
    expect(announcements.length).toBeGreaterThan(10);
  });

  it("classifies RITAMIX's resumption notice as RESUME", () => {
    const row = announcements.find((a) => a.stockCodes.includes("01936") && a.classification === "RESUME");
    expect(row).toBeDefined();
    expect(row!.documentTitle).toMatch(/RESUMPTION OF TRADING/);
    // 28/09/2026 08:55 HKT = 00:55Z
    expect(row!.releaseAt).toBe(Date.parse("2026-09-28T00:55:00Z") / 1000);
  });

  it("classifies HMVOD's AGM-plus-suspension notice as HALT (title has SUSPENSION, not RESUMPTION)", () => {
    const row = announcements.find((a) => a.stockCodes.includes("08103"));
    expect(row).toBeDefined();
    expect(row!.classification).toBe("HALT");
  });

  it('RESUMPTION wins even when the title also mentions a continued SUSPENSION (real capture, China Rare Earth)', () => {
    const row = announcements.find((a) => a.stockCodes.includes("00769"));
    expect(row).toBeDefined();
    expect(row!.documentTitle).toMatch(/RESUMPTION/);
    expect(row!.documentTitle).toMatch(/SUSPENSION/);
    expect(row!.classification).toBe("RESUME");
  });
});

describe("toHaltOpens / toResumptions", () => {
  const announcements = parseHkexAnnouncements(fixture);

  it("a HALT announcement with 'SUSPENSION' in the title produces reasonCode HK:SUSP", () => {
    const row = announcements.find((a) => a.stockCodes.includes("08103"))!;
    const opens = toHaltOpens(row);
    expect(opens).toHaveLength(1);
    expect(opens[0]!.record.reasonCode).toBe("HK:SUSP");
    expect(opens[0]!.record.reasonCategory).toBe("REGULATORY");
    expect(opens[0]!.record.haltAt).toBe(row.releaseAt);
  });

  it("a RESUME announcement resolves to the next non-CLOSED XHKG session's start", () => {
    const row = announcements.find((a) => a.stockCodes.includes("01936") && a.classification === "RESUME")!;
    const resumptions = toResumptions(row);
    expect(resumptions).toHaveLength(1);
    // Release was 08:55 HKT, inside the 09:00-09:30 AUCTION pre-opening window's CLOSED gap —
    // next non-CLOSED window is that same day's 09:00 AUCTION.
    expect(resumptions[0]!.resumeTradeAt).toBe(Date.parse("2026-09-28T01:00:00Z") / 1000);
  });

  it("an OTHER-classified announcement produces neither an open nor a resumption", () => {
    const other = announcements.find((a) => a.classification === "OTHER");
    if (other) {
      expect(toHaltOpens(other)).toHaveLength(0);
      expect(toResumptions(other)).toHaveLength(0);
    }
  });
});
