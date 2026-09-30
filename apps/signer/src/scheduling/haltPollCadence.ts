import type { Session } from "@winsznx/bellstate-engine";
import {
  NASDAQ_POLL_PERIOD_OFF_HOURS_SECONDS,
  NASDAQ_POLL_PERIOD_TRADING_SECONDS,
  NYSE_POLL_PERIOD_OFF_HOURS_SECONDS,
  NYSE_POLL_PERIOD_TRADING_SECONDS,
} from "../constants.js";

/**
 * PRD §4.1/§4.2: both feeds back off outside "04:00–20:00 ET on US trading days." XNAS's own
 * session template (packages/calendars/src/templates.ts) spans exactly that window — EXTENDED
 * 04:00-09:30, REGULAR 09:30-16:00, EXTENDED 16:00-20:00 on a regular day, narrower on a half
 * day — so "session !== CLOSED" for XNAS is precisely that window, including correctly backing
 * off early on a half day rather than polling fast until a hardcoded 20:00.
 */
export function isUsTradingWindow(session: Session): boolean {
  return session !== "CLOSED";
}

export function nasdaqPollPeriodSeconds(session: Session): number {
  return isUsTradingWindow(session) ? NASDAQ_POLL_PERIOD_TRADING_SECONDS : NASDAQ_POLL_PERIOD_OFF_HOURS_SECONDS;
}

export function nysePollPeriodSeconds(session: Session): number {
  return isUsTradingWindow(session) ? NYSE_POLL_PERIOD_TRADING_SECONDS : NYSE_POLL_PERIOD_OFF_HOURS_SECONDS;
}
