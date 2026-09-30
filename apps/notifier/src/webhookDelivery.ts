export interface WebhookDeliveryResult {
  ok: boolean;
  httpStatus?: number;
  error?: string;
  /** Never set by a webhook delivery — present only so callers can treat this and
   * `TelegramSendResult` (which uses it for Telegram's 429 `retry_after`) uniformly. */
  retryAfterSeconds?: undefined;
}

/** PRD §8.5: "POSTs with an HMAC signature and a 10 s timeout. Only 2xx counts as success." */
const WEBHOOK_TIMEOUT_MS = 10_000;

/**
 * Delivers one event to one webhook subscription's target URL.
 *
 * ARCHITECTURE GAP (documented, not worked around): PRD §10.5 requires a
 * `Bellstate-Signature: t=<unix>,v1=<hex(hmac_sha256(secret, t + "." + rawBody))>` header. Computing
 * that HMAC needs the subscription's *plaintext* secret. But apps/api's `createWebhook` (see
 * apps/api/src/webhooksService.ts) only ever stores `secret_hash = sha256(secret)` — a one-way
 * hash, per PRD §10.5's own "Secret. Returned once, then stored as a SHA-256 hash." A one-way
 * hash cannot produce an HMAC any real subscriber could verify; signing with the hash *as if* it
 * were the secret would produce a signature that looks well-formed and is silently wrong for
 * every subscriber, which is worse than sending no signature at all. This is a real,
 * previously-documented gap (BUILDLOG.md, "apps/api webhooks logic, verified against real
 * Supabase"), not something this pass invents or should paper over. The fix is on the storage
 * side (an encrypted, recoverable secret column instead of a one-way hash) and is out of scope
 * here — apps/api is off-limits for this task. Until then, `Bellstate-Signature` is omitted
 * below; `Bellstate-Event-Id` is still sent since it needs no secret.
 */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  eventId: string,
  fetchFn: typeof fetch = fetch,
): Promise<WebhookDeliveryResult> {
  const rawBody = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetchFn(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Bellstate-Event-Id": eventId,
        // Bellstate-Signature intentionally omitted — see the gap documented above this function.
      },
      body: rawBody,
    });
    const ok = response.status >= 200 && response.status < 300;
    return { ok, httpStatus: response.status };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false,
      error: timedOut ? `timed out after ${WEBHOOK_TIMEOUT_MS}ms` : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
