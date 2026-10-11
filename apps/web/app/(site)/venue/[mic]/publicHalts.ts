import type { Mic } from "@winsznx/bellstate-calendars";
import { fetchNysePage, parseNyseHaltFeed, parsedTotalCount } from "@winsznx/bellstate-source-nyse-halts";

const SOURCE_EXCHANGE: Partial<Record<Mic, string>> = {
  XNAS: "Nasdaq",
  XNYS: "NYSE",
  ARCX: "NYSE Arca",
  XASE: "NYSE American",
};

export interface PublicHalt {
  symbol: string;
  reason: string;
  haltAt: number;
  resumeTradeAt: number | null;
}

export interface PublicHaltSnapshot {
  rows: PublicHalt[];
  fetchedAt: number;
  truncated: boolean;
  sourceUrl: string;
}

export async function loadPublicHalts(mic: Mic, now: number): Promise<PublicHaltSnapshot | null> {
  const exchange = SOURCE_EXCHANGE[mic];
  if (!exchange) return null;

  // The source's current endpoint has omitted unresolved halts. Query its historical filter.
  const to = new Date(now * 1000).toISOString().slice(0, 10);
  const from = new Date((now - 7 * 86_400) * 1000).toISOString().slice(0, 10);
  const params = {
    haltDateFrom: from,
    haltDateTo: to,
    sourceExchange: exchange,
    pageNumber: 1,
    appUrl: "https://bellstate.timjosh507.workers.dev",
  };
  const rows: PublicHalt[] = [];
  const maxPages = 5;
  let totalCount = 0;
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    const response = await fetchNysePage({
      ...params,
      pageNumber,
      fetchFn: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
    });
    totalCount = parsedTotalCount(response);
    rows.push(...parseNyseHaltFeed(response)
      .filter((row) => row.sourceExchange === exchange)
      .map((row) => ({ symbol: row.symbol, reason: row.reason, haltAt: row.haltAt, resumeTradeAt: row.resumeTradeAt })));
    if (rows.length >= totalCount || rows.length === 0) break;
  }

  rows.sort((a, b) => b.haltAt - a.haltAt);
  return {
    rows,
    fetchedAt: now,
    truncated: rows.length < totalCount,
    sourceUrl: `https://www.nyse.com/trade-halt`,
  };
}
