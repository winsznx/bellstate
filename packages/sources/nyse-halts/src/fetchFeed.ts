const BASE_URL = "https://www.nyse.com/api/trade-halts/historical/filter";

export interface FetchNysePageOptions {
  haltDateFrom: string; // YYYY-MM-DD
  haltDateTo: string; // YYYY-MM-DD
  pageNumber: number;
  symbol?: string;
  reason?: string;
  sourceExchange?: string;
  appUrl: string;
  fetchFn?: typeof fetch;
}

/** PRD §4.2: never /api/trade-halts/current — it has been observed to omit halts that
 * historical/filter shows as still open. */
export async function fetchNysePage(options: FetchNysePageOptions): Promise<string> {
  const {
    haltDateFrom,
    haltDateTo,
    pageNumber,
    symbol = "",
    reason = "",
    sourceExchange = "",
    appUrl,
    fetchFn = fetch,
  } = options;

  const params = new URLSearchParams({
    symbol,
    reason,
    sourceExchange,
    haltDateFrom,
    haltDateTo,
    pageNumber: String(pageNumber),
  });

  const response = await fetchFn(`${BASE_URL}?${params.toString()}`, {
    headers: { "User-Agent": `Bellstate/1.0 (+${appUrl}/method)` },
  });
  if (!response.ok) {
    throw new Error(`NYSE halt feed returned ${response.status}`);
  }
  return response.text();
}
