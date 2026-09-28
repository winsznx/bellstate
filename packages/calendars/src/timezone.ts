import type { Mic } from "./types.js";

export const TIMEZONE_BY_MIC: Record<Mic, string> = {
  XNAS: "America/New_York",
  XNYS: "America/New_York",
  ARCX: "America/New_York",
  XASE: "America/New_York",
  XHKG: "Asia/Hong_Kong",
  XKRX: "Asia/Seoul",
  NXTE: "Asia/Seoul",
};

export interface LocalDateTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 Sun .. 6 Sat, per the venue's local calendar date
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

function partsToLocal(parts: Intl.DateTimeFormatPart[]): Omit<LocalDateTime, "weekday"> {
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

/** Local wall-clock date/time in `timeZone` for a given unix-seconds instant. */
export function localDateTime(unixSeconds: number, timeZone: string): LocalDateTime {
  const parts = formatter(timeZone).formatToParts(new Date(unixSeconds * 1000));
  const local = partsToLocal(parts);
  const weekday = calendarDateToUtcNoon(local.year, local.month, local.day).getUTCDay();
  return { ...local, weekday };
}

/** A UTC instant at 12:00 on the given calendar date — used only for calendar-date arithmetic
 * (weekday, +/- N days), never converted back to venue local time. */
export function calendarDateToUtcNoon(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(calendarDateToUtcNoon(year, month, day).getTime() + delta * 86_400_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Unix seconds for the given local wall-clock date/time in `timeZone`. Resolves the UTC offset
 * by round-tripping through Intl.DateTimeFormat twice, which converges for all offsets that don't
 * change within the ~1 day window between guesses — true for every venue here.
 */
export function zonedTimeToUnix(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
  const offset1 = offsetSeconds(naiveUtc, timeZone);
  const guess2 = naiveUtc - offset1;
  const offset2 = offsetSeconds(guess2, timeZone);
  return naiveUtc - offset2;
}

function offsetSeconds(unixSeconds: number, timeZone: string): number {
  const local = localDateTime(unixSeconds, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) / 1000;
  return asUtc - unixSeconds;
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
