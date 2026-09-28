import { describe, expect, it } from "vitest";
import { dayWindows, upcomingSpecialDays } from "../src/resolveSession.js";

function utc(iso: string): number {
  return Date.parse(iso) / 1000;
}

describe("dayWindows", () => {
  it("returns all of XNAS's regular-day windows in order, covering the full 24h", () => {
    // 2026-06-15 is a Monday, a normal trading day.
    const windows = dayWindows("XNAS", utc("2026-06-15T14:00:00Z"));
    expect(windows.map((w) => w.session)).toEqual(["CLOSED", "EXTENDED", "REGULAR", "EXTENDED", "CLOSED"]);
    expect(windows[0]!.sessionSince).toBe(utc("2026-06-15T04:00:00Z")); // local midnight ET (EDT)
    expect(windows[windows.length - 1]!.nextScheduledTransition).toBe(utc("2026-06-16T04:00:00Z"));
    // Adjacent windows must be contiguous.
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.sessionSince).toBe(windows[i - 1]!.nextScheduledTransition);
    }
  });

  it("returns a single CLOSED window spanning the full day for a weekend", () => {
    const windows = dayWindows("XNAS", utc("2026-06-13T16:00:00Z")); // Saturday
    expect(windows).toHaveLength(1);
    expect(windows[0]!.session).toBe("CLOSED");
  });

  it("returns the half-day-shortened windows on an early-close date", () => {
    const windows = dayWindows("XNAS", utc("2026-11-27T16:00:00Z")); // early close
    expect(windows.map((w) => w.session)).toEqual(["CLOSED", "EXTENDED", "REGULAR", "EXTENDED", "CLOSED"]);
    const regular = windows.find((w) => w.session === "REGULAR")!;
    expect(regular.nextScheduledTransition).toBe(utc("2026-11-27T18:00:00Z")); // 13:00 EST
  });
});

describe("upcomingSpecialDays", () => {
  it("finds Jan 19, 2026 (a real US holiday) within a 60-day window from Jan 1", () => {
    const days = upcomingSpecialDays("XNAS", utc("2026-01-01T12:00:00Z"), 60);
    expect(days).toContainEqual({ dateKey: "2026-01-19", type: "closed" });
  });

  it("finds a half-day (Nov 27, 2026 early close) in range", () => {
    const days = upcomingSpecialDays("XNAS", utc("2026-11-01T12:00:00Z"), 60);
    expect(days).toContainEqual({ dateKey: "2026-11-27", type: "half" });
  });

  it("never includes a weekend date even though CLOSED_DAYS wouldn't itself exclude it", () => {
    const days = upcomingSpecialDays("XNAS", utc("2026-06-01T12:00:00Z"), 30);
    for (const d of days) {
      const [y, m, dd] = d.dateKey.split("-").map(Number);
      const weekday = new Date(Date.UTC(y!, m! - 1, dd!, 12)).getUTCDay();
      expect(weekday).not.toBe(0);
      expect(weekday).not.toBe(6);
    }
  });
});
