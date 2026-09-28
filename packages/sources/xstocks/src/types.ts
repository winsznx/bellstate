/** PRD §4.5. Field names and nesting verified against real captures (fixtures/), not just the
 * PRD's field list — e.g. limitsPerPeriod entries use minOrderFiatValue/maxOrderFiatValue, not
 * the min/max shorthand the PRD's prose implies. */

export interface XstocksPeriodLimit {
  minOrderFiatValue: number;
  maxOrderFiatValue: number;
}

export interface XstocksTrading {
  currency: string;
  tradingHoursMode: string;
  isTradingHalted: boolean;
  currentPeriod: string;
  openNow: boolean;
  nextChangeAt: string | null;
  exchange: {
    mic: string | null;
    abbreviation: string;
    name: string;
    timezone: string;
  } | null;
  limitsPerPeriod: Record<string, XstocksPeriodLimit>;
}

export interface XstocksStablecoin {
  symbol: string;
  currency: string;
  network: string;
  address: string;
  decimals: number;
  issuance: boolean;
  redemption: boolean;
  supportsAtomicSwaps: boolean;
}

export interface XstocksDeployment {
  address: string;
  network: string;
  wrapperAddress?: string;
  wrapperAddressV2?: string;
  supportsAtomicSwaps: boolean;
  stablecoins: XstocksStablecoin[];
}

export interface XstocksAsset {
  id: string;
  name: string;
  symbol: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  underlying: {
    symbol: string;
    isin: string;
    currency: string;
    listingCountry: string;
  };
  isTradingHalted: boolean;
  trading: XstocksTrading | null;
  deployments: XstocksDeployment[];
}

export interface XstocksPage<T> {
  nodes: T[];
  page: { currentPage: number; hasNextPage: boolean };
}

export interface XstocksOracleMetadata {
  name: string;
  asset: string;
  feedId?: string;
  decimals?: number;
  quoteAsset: string;
  reportSchema?: string;
  verifierContract: string;
  exponent?: number;
  hermesId?: string;
}

export interface XstocksOracle {
  id: string;
  createdAt: string;
  network: string;
  symbol: string;
  managedBy: string;
  metadata: XstocksOracleMetadata;
}
