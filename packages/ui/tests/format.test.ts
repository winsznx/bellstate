import { describe, expect, it } from "vitest";
import { formatAddress, formatDuration, formatFeeBps, formatPrice, formatVenueTime } from "../src/format.js";

describe("formatAddress", () => {
  it("shortens to 0x1234…abcd (§11.3)", () => {
    expect(formatAddress("0xc845b2894dbddd03858fd2d643b4ef725fe0849d")).toBe("0xc845…849d");
  });
});

describe("formatFeeBps", () => {
  it("renders 50 bps as 0.50% (§11.3 example)", () => {
    expect(formatFeeBps(50)).toBe("0.50%");
  });
  it("renders 1000 bps as 10.00%", () => {
    expect(formatFeeBps(1000)).toBe("10.00%");
  });
});

describe("formatPrice", () => {
  it("matches the PRD's own examples", () => {
    expect(formatPrice(1_272_000, "KRW")).toBe("₩1,272,000");
    expect(formatPrice(917.25, "USD")).toBe("$917.25");
    expect(formatPrice(100, "HKD")).toBe("HK$100.00");
  });

  it("falls back to a code prefix for an unmapped currency rather than guessing a symbol", () => {
    expect(formatPrice(10, "XYZ")).toBe("XYZ 10.00");
  });
});

describe("formatDuration", () => {
  it("renders 1h 04m format (§11.3 example)", () => {
    expect(formatDuration(64 * 60)).toBe("1h 04m");
  });
  it("omits the hour segment under 60 minutes", () => {
    expect(formatDuration(5 * 60)).toBe("5m");
  });
});

describe("formatVenueTime", () => {
  it("matches the PRD's own examples for each venue's zone abbreviation", () => {
    // 2026-06-15T14:00:00Z = 10:00:00 ET (EDT)
    expect(formatVenueTime(Date.parse("2026-06-15T14:00:00Z") / 1000, "XNAS")).toBe("10:00:00 ET");
    // 2026-06-15T02:00:00Z = 10:00:00 HKT
    expect(formatVenueTime(Date.parse("2026-06-15T02:00:00Z") / 1000, "XHKG", false)).toBe("10:00 HKT");
    // 2026-06-15T01:00:00Z = 10:00:00 KST
    expect(formatVenueTime(Date.parse("2026-06-15T01:00:00Z") / 1000, "XKRX")).toBe("10:00:00 KST");
  });
});
