/**
 * PRD §4.9: "POST https://api.hyperliquid.xyz/info" — the real, documented Hyperliquid info
 * endpoint. "xyz" is the literal dex slug for trade.xyz's HIP-3 dex (confirmed live against the
 * real endpoint: `{"type":"perpDexs"}` lists it, and `{"type":"meta","dex":"xyz"}` returns its
 * real universe of `xyz:<SYMBOL>`-named assets), not a placeholder.
 */

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

export interface HyperliquidUniverseAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

export interface HyperliquidMeta {
  universe: HyperliquidUniverseAsset[];
}

/**
 * Real shape observed from `{"type":"metaAndAssetCtxs","dex":"xyz"}`: prices come back as decimal
 * strings, and `assetCtxs[i]` corresponds to `meta.universe[i]` by index (Hyperliquid's info API
 * convention — there is no per-entry name/id field on the ctx itself).
 */
export interface HyperliquidAssetCtx {
  oraclePx: string;
  markPx: string;
}

export type MetaAndAssetCtxsResponse = [HyperliquidMeta, HyperliquidAssetCtx[]];

export interface FetchMetaAndAssetCtxsOptions {
  dex: string;
  fetchFn?: typeof fetch;
}

export async function fetchMetaAndAssetCtxs(options: FetchMetaAndAssetCtxsOptions): Promise<MetaAndAssetCtxsResponse> {
  const { dex, fetchFn = fetch } = options;

  const response = await fetchFn(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex }),
  });
  if (!response.ok) {
    throw new Error(`Hyperliquid metaAndAssetCtxs returned ${response.status}`);
  }

  return (await response.json()) as MetaAndAssetCtxsResponse;
}

export interface MarketPrices {
  oraclePx: number;
  markPx: number;
}

/** Builds a `<dex>:<NAME>` -> prices lookup, dropping any entry whose prices don't parse. */
export function indexAssetCtxsByCoin(response: MetaAndAssetCtxsResponse): Map<string, MarketPrices> {
  const [meta, ctxs] = response;
  const byCoin = new Map<string, MarketPrices>();

  meta.universe.forEach((asset, i) => {
    const ctx = ctxs[i];
    if (!ctx) return;

    const oraclePx = Number(ctx.oraclePx);
    const markPx = Number(ctx.markPx);
    if (Number.isFinite(oraclePx) && Number.isFinite(markPx)) {
      byCoin.set(asset.name, { oraclePx, markPx });
    }
  });

  return byCoin;
}

/** `perp_markets.name` is expected bare (e.g. "NVDA"); Hyperliquid's universe names it "xyz:NVDA". */
export function coinNameFor(dex: string, name: string): string {
  const prefix = `${dex}:`;
  return name.startsWith(prefix) ? name : `${prefix}${name}`;
}
