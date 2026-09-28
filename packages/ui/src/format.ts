import { TIMEZONE_BY_MIC } from "@winsznx/bellstate-calendars";
import type { Mic } from "@winsznx/bellstate-calendars";

/** PRD §11.3: "Addresses are shortened 0x1234…abcd with copy and an explorer link." */
export function formatAddress(address: `0x${string}`): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** PRD §11.3: "Fees show as 0.50%, with pips on hover. Percentages use 2 dp." `bps` is basis
 * points (1 bps = 0.01%), matching the onchain fee unit used throughout packages/contracts. */
export function formatFeeBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

const CURRENCY_FORMAT: Record<string, { symbol: string; prefix: boolean; decimals: number }> = {
  USD: { symbol: "$", prefix: true, decimals: 2 },
  KRW: { symbol: "₩", prefix: true, decimals: 0 },
  HKD: { symbol: "HK$", prefix: true, decimals: 2 },
  EUR: { symbol: "€", prefix: true, decimals: 2 },
};

/** PRD §11.3 examples: ₩1,272,000 · $917.25 · HK$. Falls back to "<CODE> <amount>" for a
 * currency not in the table rather than guessing a symbol. */
export function formatPrice(value: number, currency: string): string {
  const fmt = CURRENCY_FORMAT[currency];
  const grouped = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fmt?.decimals ?? 2,
    maximumFractionDigits: fmt?.decimals ?? 2,
  }).format(value);
  if (!fmt) return `${currency} ${grouped}`;
  return fmt.prefix ? `${fmt.symbol}${grouped}` : `${grouped}${fmt.symbol}`;
}

/** PRD §11.3: "Durations use 1h 04m format." */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.abs(seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = seconds < 0 ? "-" : "";
  if (hours === 0) return `${sign}${minutes}m`;
  return `${sign}${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Short venue-local zone abbreviation for the sentences in §11.3 ("11:02:07 ET",
 * "08:00:00 KST", "16:08 HKT"). Not derived from Intl (whose short zone names vary by locale
 * data version); pinned to the PRD's own examples. */
const ZONE_ABBREVIATION: Record<Mic, string> = {
  XNAS: "ET",
  XNYS: "ET",
  ARCX: "ET",
  XASE: "ET",
  XHKG: "HKT",
  XKRX: "KST",
  NXTE: "KST",
};

/** PRD §11.3: "Venue events show venue local time with its zone." `withSeconds` matches the
 * PRD's own examples, which show seconds for a halt time (11:02:07 ET) but not for a session
 * boundary (16:08 HKT). */
export function formatVenueTime(unixSeconds: number, mic: Mic, withSeconds = true): string {
  const timeZone = TIMEZONE_BY_MIC[mic];
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  });
  return `${formatter.format(new Date(unixSeconds * 1000))} ${ZONE_ABBREVIATION[mic]}`;
}
