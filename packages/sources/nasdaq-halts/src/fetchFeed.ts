const BASE_URL = "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";

export interface FetchNasdaqHaltFeedOptions {
  /** MMDDYYYY. Omit for the current (live) feed. */
  haltDate?: string;
  resumeDate?: string;
  appUrl: string;
  fetchFn?: typeof fetch;
}

/** PRD §4.1: "Every request sends User-Agent: Bellstate/1.0 (+<APP_URL>/method)." */
export async function fetchNasdaqHaltFeed(options: FetchNasdaqHaltFeedOptions): Promise<string> {
  const { haltDate, resumeDate, appUrl, fetchFn = fetch } = options;
  let url = BASE_URL;
  if (haltDate) url += `&haltdate=${haltDate}`;
  if (resumeDate) url += `&resumedate=${resumeDate}`;

  const response = await fetchFn(url, {
    headers: { "User-Agent": `Bellstate/1.0 (+${appUrl}/method)` },
  });
  if (!response.ok) {
    throw new Error(`Nasdaq halt feed returned ${response.status}`);
  }
  return response.text();
}
