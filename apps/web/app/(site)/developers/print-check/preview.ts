import { CALENDAR_VERSION, resolveSessionWindow } from "@winsznx/bellstate-calendars";
import { PRINT_FLAG, PrintVerdict, verdictSecondary, type PrintVenueState } from "@winsznx/bellstate-policy";

export interface PreviewInput {
  listing: string;
  timestamp: string;
  price: string;
  size: string;
  currency: string;
  prevClose: string;
}

export const PRESETS: { label: string; input: PreviewInput }[] = [
  {
    label: "Jul 28, 2026 · SK hynix on Nextrade",
    input: { listing: "NXTE:000660", timestamp: "2026-07-28T08:00:00+09:00", price: "1272000", size: "1", currency: "KRW", prevClose: "1816000" },
  },
  {
    label: "Aug 6, 2026 · SK hynix on Nextrade",
    input: { listing: "NXTE:000660", timestamp: "2026-08-06T08:00:00+09:00", price: "1168000", size: "11", currency: "KRW", prevClose: "1668000" },
  },
];

export type PreviewResult = {
  verdict: "REJECT" | "FLAG" | "ACCEPT" | "UNKNOWN";
  flags: string[];
  venueSession: string;
  primarySession: string;
  sessionStart: string;
  lower: number;
  upper: number;
  tick: number;
  deviationPct: number;
  policyVerdict: string;
  policyFlags: string[];
  calendarVersion: number;
};

function tickFor(price: number): number {
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

const sessionNumber = { UNKNOWN: 0, REGULAR: 1, EXTENDED: 2, AUCTION: 3, CLOSED: 4 } as const;
const policyFlagNames = Object.entries(PRINT_FLAG);

export function evaluatePreview(input: PreviewInput, now = Date.now()): PreviewResult {
  if (input.listing.trim().toUpperCase() !== "NXTE:000660") {
    throw new Error("This preview currently supports NXTE:000660 only.");
  }
  if (input.currency.trim().toUpperCase() !== "KRW") {
    throw new Error("NXTE:000660 must use KRW.");
  }
  if (!/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(input.timestamp)) {
    throw new Error("Use a 2026 timestamp with an explicit offset, such as 2026-07-28T08:00:00+09:00.");
  }
  const parsed = Date.parse(input.timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 4) !== "2026") {
    throw new Error("Enter a valid timestamp in 2026.");
  }
  const price = Number(input.price);
  const size = Number(input.size);
  const prevClose = Number(input.prevClose);
  if (![price, size, prevClose].every(Number.isSafeInteger) || price <= 0 || size <= 0 || prevClose <= 0) {
    throw new Error("Price, size, and previous close must be positive whole numbers.");
  }

  const printTs = Math.floor(parsed / 1_000);
  const venue = resolveSessionWindow("NXTE", printTs);
  const primary = resolveSessionWindow("XKRX", printTs);
  const firstMinute = venue.session !== "CLOSED" && printTs - venue.sessionSince < 60;
  const primaryNotTrading = primary.session !== "REGULAR";
  const move = Math.floor(prevClose * 0.3 / tickFor(prevClose)) * tickFor(prevClose);
  const lower = prevClose - move;
  const upper = prevClose + move;
  const tick = tickFor(prevClose);
  const deviationPct = (price / prevClose - 1) * 100;
  const atLimit = price === lower || price === upper;
  const future = parsed > now + 5_000;
  const flags: string[] = [];
  if (venue.session === "CLOSED") flags.push("VENUE_CLOSED");
  if (venue.session === "EXTENDED") flags.push("VENUE_EXTENDED");
  if (venue.session === "AUCTION") flags.push("VENUE_AUCTION");
  if (firstMinute) flags.push("FIRST_MINUTE");
  if (primaryNotTrading) flags.push("PRIMARY_NOT_TRADING");
  if (atLimit) flags.push("AT_LIMIT");
  if (Math.abs(deviationPct) >= 10) flags.push("DEVIATION");
  if (future) flags.push("FUTURE_TS");

  const unknown = venue.session === "UNKNOWN" || primary.session === "UNKNOWN";
  const verdict = future || venue.session === "CLOSED" || (atLimit && (firstMinute || primaryNotTrading))
    ? "REJECT"
    : unknown ? "UNKNOWN" : flags.length ? "FLAG" : "ACCEPT";

  // Calendar-only comparison to the shared contract policy. No onchain call or historical
  // interruption evidence is available here; NONE is explicitly an assumption.
  const state = (session: typeof venue, startedAt: number): PrintVenueState => ({
    found: true, outOfHistory: false, session: sessionNumber[session.session],
    interruption: 1, sessionStartedAt: BigInt(startedAt),
  });
  const policy = verdictSecondary(
    state(venue, venue.sessionSince),
    state(primary, primary.sessionSince),
    BigInt(printTs),
    BigInt(Math.floor(now / 1_000)),
  );
  return {
    verdict,
    flags,
    venueSession: venue.session,
    primarySession: primary.session,
    sessionStart: new Date(venue.sessionSince * 1_000).toISOString(),
    lower, upper, tick, deviationPct,
    policyVerdict: PrintVerdict[policy.verdict].toUpperCase(),
    policyFlags: policyFlagNames.filter(([, bit]) => Boolean(policy.flags & bit)).map(([name]) => name),
    calendarVersion: CALENDAR_VERSION,
  };
}
