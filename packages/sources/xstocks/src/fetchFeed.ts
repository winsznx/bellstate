const BASE_URL = "https://api.xstocks.fi/api/v2";

interface CommonOptions {
  appUrl: string;
  fetchFn?: typeof fetch;
}

async function get(path: string, { appUrl, fetchFn = fetch }: CommonOptions): Promise<string> {
  const response = await fetchFn(`${BASE_URL}${path}`, {
    headers: { "User-Agent": `Bellstate/1.0 (+${appUrl}/method)` },
  });
  if (!response.ok) {
    throw new Error(`xStocks API returned ${response.status} for ${path}`);
  }
  return response.text();
}

/** PRD §4.5: GET /public/assets, catalog sync (§8.7) and primary/program facets, 60s cadence. */
export function fetchAssetsPage(page: number, options: CommonOptions): Promise<string> {
  return get(`/public/assets?page=${page}`, options);
}

export function fetchAsset(symbol: string, options: CommonOptions): Promise<string> {
  return get(`/public/assets/${symbol}`, options);
}

/** PRD §4.5: GET /public/oracles?network=XLayer, hourly. */
export function fetchOraclesPage(network: string, page: number, options: CommonOptions): Promise<string> {
  return get(`/public/oracles?network=${network}&page=${page}`, options);
}

export function fetchOracle(symbol: string, options: CommonOptions): Promise<string> {
  return get(`/public/oracles/${symbol}`, options);
}
