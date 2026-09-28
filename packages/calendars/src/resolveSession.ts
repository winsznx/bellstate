import { CLOSED_DAYS, FAMILY_BY_MIC, HALF_DAYS } from "./holidays.js";
import { HALF_DAY_TEMPLATES, REGULAR_TEMPLATES, type RawWindow } from "./templates.js";
import { TIMEZONE_BY_MIC, addCalendarDays, dateKey, localDateTime, zonedTimeToUnix } from "./timezone.js";
import type { Mic, Session, SessionWindow } from "./types.js";

const DAY_SECONDS = 86_400;

type DayType = "CLOSED_FULL" | "HALF" | "REGULAR";

function classifyDay(mic: Mic, year: number, month: number, day: number, weekday: number): DayType {
  const family = FAMILY_BY_MIC[mic];
  if (weekday === 0 || weekday === 6) return "CLOSED_FULL";
  const key = dateKey(year, month, day);
  if (CLOSED_DAYS[family].has(key)) return "CLOSED_FULL";
  if (HALF_DAYS[family].has(key)) return "HALF";
  return "REGULAR";
}

function fillGaps(windows: RawWindow[]): RawWindow[] {
  const sorted = [...windows].sort((a, b) => a.startSec - b.startSec);
  const filled: RawWindow[] = [];
  let cursor = 0;
  for (const win of sorted) {
    if (win.startSec > cursor) {
      filled.push({ startSec: cursor, endSec: win.startSec, session: "CLOSED" });
    }
    filled.push(win);
    cursor = win.endSec;
  }
  if (cursor < DAY_SECONDS) {
    filled.push({ startSec: cursor, endSec: DAY_SECONDS, session: "CLOSED" });
  }
  return filled;
}

function windowsForDay(mic: Mic, dayType: DayType): RawWindow[] {
  if (dayType === "CLOSED_FULL") return [{ startSec: 0, endSec: DAY_SECONDS, session: "CLOSED" }];
  const template = dayType === "HALF" ? (HALF_DAY_TEMPLATES[mic] ?? REGULAR_TEMPLATES[mic]) : REGULAR_TEMPLATES[mic];
  return fillGaps(template);
}

/**
 * PRD §3.3 / Appendix C-D. Pure function of (mic, t) via calendar tables pinned to
 * CALENDAR_VERSION — no wall-clock reads beyond `t` itself.
 */
export function resolveSessionWindow(mic: Mic, unixSeconds: number): SessionWindow {
  const timeZone = TIMEZONE_BY_MIC[mic];
  const local = localDateTime(unixSeconds, timeZone);
  const dayType = classifyDay(mic, local.year, local.month, local.day, local.weekday);
  const windows = windowsForDay(mic, dayType);

  const secOfDay = local.hour * 3600 + local.minute * 60 + local.second;
  const current = windows.find((win) => secOfDay >= win.startSec && secOfDay < win.endSec) ?? windows[windows.length - 1]!;

  let sessionSince = zonedTimeToUnix(local.year, local.month, local.day, 0, 0, 0, timeZone) + current.startSec;
  let nextScheduledTransition = zonedTimeToUnix(local.year, local.month, local.day, 0, 0, 0, timeZone) + current.endSec;

  if (dayType === "CLOSED_FULL") {
    const start = walkFullyClosedBoundary(mic, local.year, local.month, local.day, -1);
    sessionSince = zonedTimeToUnix(start.year, start.month, start.day, 0, 0, 0, timeZone);

    const nextTradingDay = walkToFirstNonFullyClosedDay(mic, local.year, local.month, local.day);
    const nextDayWindows = windowsForDay(
      mic,
      classifyDay(mic, nextTradingDay.year, nextTradingDay.month, nextTradingDay.day, weekdayOf(nextTradingDay)),
    );
    const firstNonClosed = nextDayWindows.find((win) => win.session !== "CLOSED") ?? nextDayWindows[0]!;
    nextScheduledTransition =
      zonedTimeToUnix(nextTradingDay.year, nextTradingDay.month, nextTradingDay.day, 0, 0, 0, timeZone) +
      firstNonClosed.startSec;
  }

  return { session: current.session as Session, sessionSince, nextScheduledTransition };
}

/** All of one calendar day's windows in unix seconds, for a session bar / today view. Unlike
 * resolveSessionWindow, this doesn't walk across day boundaries for CLOSED_FULL days — it
 * describes exactly the requested calendar date, closed or not. */
export function dayWindows(mic: Mic, unixSeconds: number): SessionWindow[] {
  const timeZone = TIMEZONE_BY_MIC[mic];
  const local = localDateTime(unixSeconds, timeZone);
  const dayType = classifyDay(mic, local.year, local.month, local.day, local.weekday);
  const dayStart = zonedTimeToUnix(local.year, local.month, local.day, 0, 0, 0, timeZone);
  return windowsForDay(mic, dayType).map((w) => ({
    session: w.session as Session,
    sessionSince: dayStart + w.startSec,
    nextScheduledTransition: dayStart + w.endSec,
  }));
}

export interface SpecialDay {
  dateKey: string;
  type: "closed" | "half";
}

/** PRD §11.5 S03 region 3: "Special days in the next N days: holidays, half-days and delayed
 * opens." Delayed-open detection isn't implemented (packages/calendars doesn't yet model
 * KRX/NXTE special-day shifts — see packages/calendars/README.md), so this covers full closures
 * and half-days only. */
export function upcomingSpecialDays(mic: Mic, fromUnixSeconds: number, days = 60): SpecialDay[] {
  const timeZone = TIMEZONE_BY_MIC[mic];
  const local = localDateTime(fromUnixSeconds, timeZone);
  const results: SpecialDay[] = [];
  let cur = { year: local.year, month: local.month, day: local.day };
  for (let i = 0; i < days; i++) {
    const weekday = weekdayOf(cur);
    if (weekday !== 0 && weekday !== 6) {
      const family = FAMILY_BY_MIC[mic];
      const key = dateKey(cur.year, cur.month, cur.day);
      if (CLOSED_DAYS[family].has(key)) results.push({ dateKey: key, type: "closed" });
      else if (HALF_DAYS[family].has(key)) results.push({ dateKey: key, type: "half" });
    }
    cur = addCalendarDays(cur.year, cur.month, cur.day, 1);
  }
  return results;
}

function weekdayOf(date: { year: number; month: number; day: number }): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12)).getUTCDay();
}

/** Earliest date, walking backward from (year, month, day), of a run of CLOSED_FULL days that
 * includes (year, month, day). */
function walkFullyClosedBoundary(
  mic: Mic,
  year: number,
  month: number,
  day: number,
  direction: -1,
  maxDays = 14,
): { year: number; month: number; day: number } {
  let cur = { year, month, day };
  for (let i = 0; i < maxDays; i++) {
    const prev = addCalendarDays(cur.year, cur.month, cur.day, direction);
    if (classifyDay(mic, prev.year, prev.month, prev.day, weekdayOf(prev)) !== "CLOSED_FULL") break;
    cur = prev;
  }
  return cur;
}

function walkToFirstNonFullyClosedDay(
  mic: Mic,
  year: number,
  month: number,
  day: number,
  maxDays = 14,
): { year: number; month: number; day: number } {
  let cur = { year, month, day };
  for (let i = 0; i < maxDays; i++) {
    cur = addCalendarDays(cur.year, cur.month, cur.day, 1);
    if (classifyDay(mic, cur.year, cur.month, cur.day, weekdayOf(cur)) !== "CLOSED_FULL") return cur;
  }
  return cur;
}
