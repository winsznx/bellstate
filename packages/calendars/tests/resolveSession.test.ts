import { describe, expect, it } from "vitest";
import { resolveSessionWindow } from "../src/resolveSession.js";

function utc(iso: string): number {
  return Date.parse(iso) / 1000;
}

describe("resolveSessionWindow — Appendix C templates", () => {
  it("XNAS regular session at 10:00 ET on a normal Monday", () => {
    // 2026-06-15 is a Monday; EDT is UTC-4, so 14:00Z = 10:00 ET.
    const result = resolveSessionWindow("XNAS", utc("2026-06-15T14:00:00Z"));
    expect(result.session).toBe("REGULAR");
    expect(result.sessionSince).toBe(utc("2026-06-15T13:30:00Z")); // 9:30 ET
    expect(result.nextScheduledTransition).toBe(utc("2026-06-15T20:00:00Z")); // 16:00 ET
  });

  it("XNAS pre-market EXTENDED at 07:00 ET", () => {
    const result = resolveSessionWindow("XNAS", utc("2026-06-15T11:00:00Z"));
    expect(result.session).toBe("EXTENDED");
    expect(result.sessionSince).toBe(utc("2026-06-15T08:00:00Z")); // 4:00 ET
    expect(result.nextScheduledTransition).toBe(utc("2026-06-15T13:30:00Z")); // 9:30 ET
  });

  it("XNYS pre-opening AUCTION at 07:00 ET (NYSE runs no early session)", () => {
    const result = resolveSessionWindow("XNYS", utc("2026-06-15T11:00:00Z"));
    expect(result.session).toBe("AUCTION");
  });

  it("US holiday (Jan 19, 2026, a Monday): CLOSED all day", () => {
    const result = resolveSessionWindow("XNAS", utc("2026-01-19T16:00:00Z"));
    expect(result.session).toBe("CLOSED");
  });

  it("US stock, Saturday: CLOSED, spans the full weekend", () => {
    const result = resolveSessionWindow("XNAS", utc("2026-06-13T16:00:00Z"));
    expect(result.session).toBe("CLOSED");
    // Friday still trades (EXTENDED to 20:00 ET), so the CLOSED run starts at Saturday
    // midnight ET, not Friday's close, and ends Monday's pre-market open (4:00 ET -> 08:00Z).
    expect(result.sessionSince).toBe(utc("2026-06-13T04:00:00Z"));
    expect(result.nextScheduledTransition).toBe(utc("2026-06-15T08:00:00Z"));
  });

  it("US early close (Nov 27, 2026): REGULAR ends at 13:00 ET", () => {
    const result = resolveSessionWindow("XNAS", utc("2026-11-27T16:00:00Z")); // 11:00 ET, EST -5
    expect(result.session).toBe("REGULAR");
    expect(result.nextScheduledTransition).toBe(utc("2026-11-27T18:00:00Z")); // 13:00 EST
  });

  it("HKEX lunch break 12:00-13:00: CLOSED, next transition 13:00", () => {
    const result = resolveSessionWindow("XHKG", utc("2026-06-15T04:30:00Z")); // 12:30 HKT
    expect(result.session).toBe("CLOSED");
    expect(result.nextScheduledTransition).toBe(utc("2026-06-15T05:00:00Z")); // 13:00 HKT
  });

  it("HKEX 16:09 random close window: UNKNOWN, next transition 16:10", () => {
    const result = resolveSessionWindow("XHKG", utc("2026-06-15T08:09:00Z")); // 16:09 HKT
    expect(result.session).toBe("UNKNOWN");
    expect(result.sessionSince).toBe(utc("2026-06-15T08:08:00Z"));
    expect(result.nextScheduledTransition).toBe(utc("2026-06-15T08:10:00Z"));
  });

  it("KRX opening call AUCTION at 08:45 KST", () => {
    const result = resolveSessionWindow("XKRX", utc("2026-06-14T23:45:00Z")); // 08:45 KST Jun 15
    expect(result.session).toBe("AUCTION");
  });

  it("KRX opening random-end window: UNKNOWN for up to 30s", () => {
    const result = resolveSessionWindow("XKRX", utc("2026-06-15T00:00:10Z")); // 09:00:10 KST
    expect(result.session).toBe("UNKNOWN");
  });

  it("NXTE 08:00:02 while KRX is not trading (the Jul 28 case, §3.8): NXTE EXTENDED, XKRX CLOSED", () => {
    const nxte = resolveSessionWindow("NXTE", utc("2026-06-14T23:00:02Z")); // 08:00:02 KST
    const xkrx = resolveSessionWindow("XKRX", utc("2026-06-14T23:00:02Z"));
    expect(nxte.session).toBe("EXTENDED");
    expect(xkrx.session).toBe("CLOSED");
  });
});
