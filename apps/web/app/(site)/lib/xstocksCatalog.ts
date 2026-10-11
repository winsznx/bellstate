const BASE = "https://api.xstocks.fi/api/v2/public/assets";

export interface CatalogAsset {
  symbol: string;
  name: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  logo: string | null;
  mic: string | null;
  venueName: string | null;
  tradingHoursMode: string | null;
  rawTokenAddress: string;
  wrapperAddress: string | null;
}

interface IssuerAsset {
  symbol: string;
  name: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  logo?: string;
  trading?: { tradingHoursMode?: string; exchange?: { mic?: string; name?: string } };
  deployments?: { network: string; address: string; wrapperAddressV2?: string; wrapperAddress?: string }[];
}

function toCatalogAsset(asset: IssuerAsset): CatalogAsset | null {
  const deployment = asset.deployments?.find((item) => item.network === "XLayer");
  if (!deployment || !asset.symbol || !asset.name) return null;
  return {
    symbol: asset.symbol,
    name: asset.name,
    isin: asset.isin,
    underlyingSymbol: asset.underlyingSymbol,
    underlyingIsin: asset.underlyingIsin,
    logo: asset.logo?.startsWith("https://xstocks-metadata.backed.fi/logos/tokens/") ? asset.logo : null,
    mic: asset.trading?.exchange?.mic ?? null,
    venueName: asset.trading?.exchange?.name ?? null,
    tradingHoursMode: asset.trading?.tradingHoursMode ?? null,
    rawTokenAddress: deployment.address,
    wrapperAddress: deployment.wrapperAddressV2 ?? deployment.wrapperAddress ?? null,
  };
}

async function get(path: string): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Issuer catalog returned HTTP ${response.status}`);
  return response;
}

export async function loadCatalogAsset(symbol: string): Promise<CatalogAsset | null> {
  if (!/^[a-z0-9]{1,20}$/i.test(symbol)) return null;
  const response = await get(`/${encodeURIComponent(symbol)}`);
  const asset = await response.json() as IssuerAsset;
  return toCatalogAsset(asset);
}

let cachedCatalog: { expiresAt: number; promise: Promise<CatalogAsset[]> } | null = null;

export function loadCatalog(): Promise<CatalogAsset[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.promise;
  const promise = fetchCatalog();
  cachedCatalog = { expiresAt: Date.now() + 3600_000, promise };
  void promise.catch(() => { if (cachedCatalog?.promise === promise) cachedCatalog = null; });
  return promise;
}

async function fetchCatalog(): Promise<CatalogAsset[]> {
  const assets: CatalogAsset[] = [];
  // Five concurrent pages balance cold-load time and issuer API load. The ceiling
  // protects Worker time if upstream pagination changes or loops unexpectedly.
  for (let start = 1; start <= 20; start += 5) {
    const pages = await Promise.all(
      Array.from({ length: 5 }, (_, index) => start + index).map(async (page) => {
        const response = await get(`?page=${page}&pageSize=100`);
        return response.json() as Promise<{ nodes: IssuerAsset[]; page: { hasNextPage: boolean } }>;
      }),
    );
    for (const page of pages) {
      for (const asset of page.nodes) {
        const catalog = toCatalogAsset(asset);
        if (catalog) assets.push(catalog);
      }
      if (!page.page.hasNextPage) return assets;
    }
  }
  throw new Error("Issuer catalog exceeded the supported pagination limit");
}
