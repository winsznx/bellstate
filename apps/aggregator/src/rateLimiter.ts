const WINDOW_MS = 1_000;

interface Window {
  windowStart: number;
  count: number;
}

/**
 * PRD §8.2: "Rate limit: 50 req/s per source IP." Fixed 1-second window counter, kept in module
 * scope so it survives across requests within one warm isolate (see hubReads.ts's comment on why
 * that's the right place for this, not a Durable Object — routing every POST through a single
 * shared DO just to count requests would make that DO the whole app's throughput ceiling).
 *
 * TODO(deferred): this is per-isolate, not per-edge-global, so a client hitting multiple
 * Cloudflare PoPs/isolates can exceed 50 req/s in aggregate before any single counter trips.
 * Cloudflare's native Rate Limiting binding (`ratelimits` in wrangler.jsonc) gives exact
 * cross-edge counts, but provisioning its namespace is an infrastructure change outside this
 * pass's "code only, no deploys" scope — left as a follow-up once that binding is provisioned.
 */
const windows = new Map<string, Window>();

export function isRateLimited(ip: string, limit = 50, now: number = Date.now()): boolean {
  const windowStart = Math.floor(now / WINDOW_MS);
  const existing = windows.get(ip);

  if (!existing || existing.windowStart !== windowStart) {
    windows.set(ip, { windowStart, count: 1 });
    if (windows.size > 10_000) evictStale(windowStart);
    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

function evictStale(currentWindowStart: number): void {
  for (const [ip, w] of windows) {
    if (w.windowStart !== currentWindowStart) windows.delete(ip);
  }
}
