/** PRD §11.5 S07. Needs live Hyperliquid metaAndAssetCtxs polling (§4.9) and stored
 * oraclePx/markPx snapshots (§9.1 perp_snapshots) — neither exists yet, fixture-backed. */
export interface WatchRow {
  dex: string;
  market: string;
  underlyingListing: string;
  oraclePx: number;
  markPx: number;
  change5m: number;
  referenceStatus: string;
  flagState: "NONE" | "THIN_OPEN_MOVE" | "CLOSED_MOVE";
  lastFlagAt: number | null;
}

const NOW = Math.floor(Date.now() / 1000);

export const WATCH_ROWS: WatchRow[] = [
  {
    dex: "xyz:NVDA",
    underlyingListing: "XNAS:NVDA",
    market: "NVDA",
    oraclePx: 187.42,
    markPx: 187.4,
    change5m: 0.12,
    referenceStatus: "Regular",
    flagState: "NONE",
    lastFlagAt: null,
  },
  {
    dex: "xyz:SKHX",
    underlyingListing: "XKRX:000660 / NXTE:000660",
    market: "SKHYNIX",
    oraclePx: 342_000,
    markPx: 339_500,
    change5m: -3.4,
    referenceStatus: "NXTE Extended, XKRX Closed",
    flagState: "THIN_OPEN_MOVE",
    lastFlagAt: NOW - 3600,
  },
];
