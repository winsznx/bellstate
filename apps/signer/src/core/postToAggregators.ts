export interface AggregatorPostResult {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * PRD §8.1: "POST everything to every URL in AGGREGATOR_URLS." One request per URL, all in
 * parallel; one aggregator being down never blocks or drops the attestation for the others
 * (§6.5: the aggregator, not this signer, is responsible for deciding whether it has quorum).
 * `fetchFn` is injectable so this is testable without a real network call.
 */
export async function postToAggregators(
  aggregatorUrlsCsv: string,
  body: unknown,
  fetchFn: typeof fetch = fetch,
): Promise<AggregatorPostResult[]> {
  const urls = aggregatorUrlsCsv
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
  const payload = JSON.stringify(body);

  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload });
      if (!res.ok) throw new Error(`http_${res.status}`);
      return res.status;
    }),
  );

  return urls.map((url, i): AggregatorPostResult => {
    const outcome = settled[i]!;
    return outcome.status === "fulfilled"
      ? { url, ok: true, status: outcome.value }
      : { url, ok: false, error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) };
  });
}
