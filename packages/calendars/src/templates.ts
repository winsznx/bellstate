import type { Mic, Session } from "./types.js";

export interface RawWindow {
  startSec: number;
  endSec: number;
  session: Session;
}

function hms(h: number, m: number, s = 0): number {
  return h * 3600 + m * 60 + s;
}

const w = (start: [number, number, number?], end: [number, number, number?], session: Session): RawWindow => ({
  startSec: hms(...start),
  endSec: hms(...end),
  session,
});

// PRD Appendix C. Windows are [start, end) in venue local time. Anything not listed is CLOSED —
// callers fill gaps via fillGaps() in resolveSession.ts.

export const REGULAR_TEMPLATES: Record<Mic, RawWindow[]> = {
  XNAS: [
    w([4, 0], [9, 30], "EXTENDED"),
    w([9, 30], [16, 0], "REGULAR"),
    w([16, 0], [20, 0], "EXTENDED"),
  ],
  XNYS: [w([6, 30], [9, 30], "AUCTION"), w([9, 30], [16, 0], "REGULAR")],
  ARCX: [
    w([4, 0], [9, 30], "EXTENDED"),
    w([9, 30], [16, 0], "REGULAR"),
    w([16, 0], [20, 0], "EXTENDED"),
  ],
  XASE: [
    w([7, 0], [9, 30], "EXTENDED"),
    w([9, 30], [16, 0], "REGULAR"),
    w([16, 0], [20, 0], "EXTENDED"),
  ],
  XHKG: [
    w([9, 0], [9, 30], "AUCTION"),
    w([9, 30], [12, 0], "REGULAR"),
    w([12, 0], [13, 0], "CLOSED"),
    w([13, 0], [16, 0], "REGULAR"),
    w([16, 0], [16, 8], "AUCTION"),
    w([16, 8], [16, 10], "UNKNOWN"),
  ],
  // v1 template (before 2026-09-14). v2 (from 2026-09-14: 16:00-20:00 EXTENDED replaces the
  // single-price after-hours session) is not yet implemented — see README.md.
  XKRX: [
    w([8, 30], [9, 0, 0], "AUCTION"),
    w([9, 0, 0], [9, 0, 30], "UNKNOWN"),
    w([9, 0, 30], [15, 20], "REGULAR"),
    w([15, 20], [15, 30, 0], "AUCTION"),
    w([15, 30, 0], [15, 30, 30], "UNKNOWN"),
    w([15, 40], [16, 0], "EXTENDED"),
    w([16, 0], [18, 0], "AUCTION"),
  ],
  // Jan 2 / CSAT day shifts (§Appendix C.7) are not yet implemented — see README.md.
  NXTE: [
    w([8, 0], [8, 50], "EXTENDED"),
    w([9, 0, 30], [15, 20], "REGULAR"),
    w([15, 40], [20, 0], "EXTENDED"),
  ],
};

export const HALF_DAY_TEMPLATES: Partial<Record<Mic, RawWindow[]>> = {
  XNAS: [
    w([4, 0], [9, 30], "EXTENDED"),
    w([9, 30], [13, 0], "REGULAR"),
    w([13, 0], [17, 0], "EXTENDED"),
  ],
  XNYS: [w([6, 30], [9, 30], "AUCTION"), w([9, 30], [13, 0], "REGULAR")],
  ARCX: [
    w([4, 0], [9, 30], "EXTENDED"),
    w([9, 30], [13, 0], "REGULAR"),
    w([13, 0], [17, 0], "EXTENDED"),
  ],
  XASE: [
    w([7, 0], [9, 30], "EXTENDED"),
    w([9, 30], [13, 0], "REGULAR"),
    w([13, 0], [17, 0], "EXTENDED"),
  ],
  XHKG: [
    w([9, 0], [9, 30], "AUCTION"),
    w([9, 30], [12, 0], "REGULAR"),
    w([12, 0], [12, 8], "AUCTION"),
    w([12, 8], [12, 10], "UNKNOWN"),
  ],
};
