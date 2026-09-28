const URL = "https://www1.hkexnews.hk/search/predefineddoc.xhtml?predefineddocuments=9";

export interface FetchHkexAnnouncementsOptions {
  appUrl: string;
  fetchFn?: typeof fetch;
}

/** PRD §4.3: the "Resumption / Suspension / Trading Halt" predefined-document list, covering the
 * last 7 days. */
export async function fetchHkexAnnouncements(options: FetchHkexAnnouncementsOptions): Promise<string> {
  const { appUrl, fetchFn = fetch } = options;
  const response = await fetchFn(URL, {
    headers: { "User-Agent": `Bellstate/1.0 (+${appUrl}/method)` },
  });
  if (!response.ok) {
    throw new Error(`HKEXnews returned ${response.status}`);
  }
  return response.text();
}
