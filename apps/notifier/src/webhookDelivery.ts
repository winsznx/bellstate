import { decryptWebhookSecret, signWebhookPayload } from "@winsznx/bellstate-protocol";

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
 * The encrypted secret is decrypted only for the outgoing request and never logged.
 */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  eventId: string,
  secretCiphertext: string,
  subscriptionId: string,
  encryptionKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<WebhookDeliveryResult> {
  const rawBody = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const secret = decryptWebhookSecret(secretCiphertext, subscriptionId, encryptionKey);
    const response = await fetchFn(url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Bellstate-Event-Id": eventId,
        "Bellstate-Signature": signWebhookPayload(secret, Math.floor(Date.now() / 1000), rawBody),
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
