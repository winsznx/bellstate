const TELEGRAM_API_BASE = "https://api.telegram.org";

/** PRD §10.6's own list of MarkdownV2 special characters. Telegram's rule (outside `pre`/`code`
 * entities, which this bot never sends): each of these must be preceded by a literal backslash. */
const MARKDOWN_V2_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!]/g;

/** Escapes plain text for Telegram's MarkdownV2 parse mode. Message builders below return plain,
 * human-authored copy; `sendTelegramMessage` is the single place that escapes it, so callers
 * never have to reason about escaping order relative to template punctuation. */
export function escapeMarkdownV2(text: string): string {
  return text.replace(MARKDOWN_V2_SPECIAL_CHARS, (char) => `\\${char}`);
}

export interface TelegramSendResult {
  ok: boolean;
  httpStatus?: number;
  retryAfterSeconds?: number;
  error?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  parameters?: { retry_after?: number };
}

/**
 * PRD §8.5: "Sends through `sendMessage` (MarkdownV2, escaped) and respects Telegram's 429
 * `retry_after`." `text` is plain text; this escapes it before sending. On a 429, the caller gets
 * back `retryAfterSeconds` straight from Telegram's own response body so it can requeue instead
 * of guessing a backoff.
 */
export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<TelegramSendResult> {
  const response = await fetchFn(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: escapeMarkdownV2(text),
      parse_mode: "MarkdownV2",
    }),
  });

  let body: TelegramApiResponse;
  try {
    body = (await response.json()) as TelegramApiResponse;
  } catch (error) {
    return {
      ok: false,
      httpStatus: response.status,
      error: `telegram response was not JSON (http ${response.status}): ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      httpStatus: response.status,
      retryAfterSeconds: body.parameters?.retry_after ?? 1,
      error: body.description ?? "telegram rate limited",
    };
  }

  if (!response.ok || body.ok !== true) {
    return { ok: false, httpStatus: response.status, error: body.description ?? `telegram http ${response.status}` };
  }

  return { ok: true, httpStatus: response.status };
}

export interface HaltOpenedMessageParams {
  symbol: string;
  venueName: string;
  reasonText: string;
  reasonCode: string;
  haltAtEt: string;
  onchainAtEt: string;
  latencySeconds: number;
  poolsText: string;
  eventUrl: string;
}

/**
 * PRD §10.6 illustrative template:
 * "⛔ NVDA halted on Nasdaq — news pending (T1) · 11:02:07 ET · onchain 11:02:31 ET (24 s) ·
 * pools blocked · <event link>". Returns plain text; `sendTelegramMessage` escapes it.
 */
export function buildHaltOpenedMessage(p: HaltOpenedMessageParams): string {
  return `⛔ ${p.symbol} halted on ${p.venueName} — ${p.reasonText} (${p.reasonCode}) · ${p.haltAtEt} · onchain ${p.onchainAtEt} (${p.latencySeconds} s) · ${p.poolsText} · ${p.eventUrl}`;
}

export interface HaltResumedMessageParams {
  symbol: string;
  venueName: string;
  resumedAtEt: string;
  surgeFeePercent: number;
  surgeDecayByEt: string;
}

/**
 * PRD §10.6 illustrative template:
 * "✅ NVDA resumed on Nasdaq · 11:48:00 ET · surge fee 3.00% decaying to 0 by 12:03 ET".
 */
export function buildHaltResumedMessage(p: HaltResumedMessageParams): string {
  return `✅ ${p.symbol} resumed on ${p.venueName} · ${p.resumedAtEt} · surge fee ${p.surgeFeePercent.toFixed(2)}% decaying to 0 by ${p.surgeDecayByEt}`;
}

export interface GenericEventMessageParams {
  type: string;
  listing?: string;
  eventUrl?: string;
}

/**
 * PRD §10.6 only spells out bespoke copy for `halt.opened` / `halt.resumed`. The other seven
 * event types (`status.*.changed`, `oraclewatch.flagged`, `network.*`) get this plain, real
 * fallback rather than invented bespoke copy the PRD never specified.
 */
export function buildGenericEventMessage(p: GenericEventMessageParams): string {
  const listingText = p.listing ? ` for ${p.listing}` : "";
  const linkText = p.eventUrl ? ` · ${p.eventUrl}` : "";
  return `Bellstate event: ${p.type}${listingText}${linkText}`;
}
