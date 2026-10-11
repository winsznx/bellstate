import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { matchesFilters, type NotifierEventContext, type NotifierFilters } from "./filters.js";
import {
  buildGenericEventMessage,
  buildHaltOpenedMessage,
  buildHaltResumedMessage,
  sendTelegramMessage,
} from "./telegram.js";
import { deliverWebhook } from "./webhookDelivery.js";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WEBHOOK_ENCRYPTION_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  /** Verifies Telegram's incoming webhook calls — consumed by apps/api's Telegram webhook
   * receiver (PRD §8.4: "the Telegram webhook (§10)"), not by this Worker, which only ever
   * calls OUT to Telegram's sendMessage. Declared here because it's already in .env.example. */
  TELEGRAM_WEBHOOK_SECRET: string;
  /** PRD §8.8's ops-alert chat. Ops alerting (DLQ-non-empty, source-unhealthy, etc.) is a
   * separate cross-cutting concern from §8.5's routing/delivery job this Worker implements, so
   * it isn't wired up here. Declared for the same reason as TELEGRAM_WEBHOOK_SECRET above. */
  OPS_TELEGRAM_CHAT_ID: string;
}

const DISABLE_AFTER_CONSECUTIVE_FAILURES = 50; // PRD §8.5: "After 50 consecutive failures, disable the subscription."

export type BellstateEventType =
  | "halt.opened"
  | "halt.resumed"
  | "status.market.changed"
  | "status.program.changed"
  | "status.primary.changed"
  | "status.valuation.changed"
  | "oraclewatch.flagged"
  | "network.degraded"
  | "network.recovered";

const EVENT_TYPES: readonly BellstateEventType[] = [
  "halt.opened",
  "halt.resumed",
  "status.market.changed",
  "status.program.changed",
  "status.primary.changed",
  "status.valuation.changed",
  "oraclewatch.flagged",
  "network.degraded",
  "network.recovered",
];

/**
 * PRD §10.5's payload example: `{"id":"evt_...","type":"halt.opened","createdAt":"...",
 * "data":{"listing":"XNAS:NVDA","programs":["NVDAx"],"market":{...},"reason":{...},"tx":"0x...",
 * "block":...,"latency":{...},"eventUrl":"..."}}`. The PRD leaves `market`, `reason` and
 * `latency`'s internal fields as `{...}` — there's no producer yet to pin them down for the halt/
 * status event types (apps/indexer's domainEvents.ts only derives *which* event names fire off a
 * contract log; nothing publishes the full envelope onto `bellstate-events` for those yet).
 * apps/watch DOES have a real producer for `oraclewatch.flagged` (src/watcher.ts's
 * `EVENTS_QUEUE.send`), but with its own data shape ({name, dex, flag, movePct, windowStart,
 * windowEnd}) rather than this one — every field below is optional specifically so that envelope
 * still parses and falls back to a plain, linkless message (see buildGenericEventMessage) instead
 * of being dropped. The shape below is this Worker's documented assumption for the halt/status
 * event types, sized to exactly what §10.6's two illustrative Telegram templates need.
 *
 * TODO(deferred): reconcile BellstateEventData against apps/watch's real oraclewatch.flagged
 * shape (a dedicated variant, not these optional fields) once a halt/status producer exists to
 * pin down the rest. Until then this is the notifier's contract, not a fully verified one.
 */
export interface BellstateEventData {
  listing?: string;
  programs?: string[];
  market?: {
    poolsBlocked?: boolean;
    surgeFeePercent?: number;
    surgeDecayAt?: string;
  };
  reason?: {
    code?: string;
    text?: string;
  };
  tx?: string;
  block?: number;
  latency?: {
    haltAt?: string;
    onchainAt?: string;
  };
  eventUrl?: string;
}

export interface BellstateEvent {
  id: string;
  type: BellstateEventType;
  createdAt: string;
  data: BellstateEventData;
}

export function isBellstateEvent(value: unknown): value is BellstateEvent {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.type === "string" &&
    (EVENT_TYPES as readonly string[]).includes(record.type) &&
    typeof record.createdAt === "string" &&
    typeof record.data === "object" &&
    record.data !== null
  );
}

function parseMessageBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

export function eventToContext(event: BellstateEvent): NotifierEventContext {
  const listing = event.data.listing;
  const [mic, symbol] = listing ? listing.split(":") : [undefined, undefined];
  return {
    type: event.type,
    mic: mic || undefined,
    symbol: symbol || undefined,
    families: event.data.programs,
  };
}

function formatEt(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} ET`;
}

interface SubscriptionRow {
  id: string;
  channel: "telegram" | "webhook";
  owner: string;
  target: string;
  filters: NotifierFilters;
  status: string;
  consecutive_failures: number;
  secret_ciphertext: string | null;
}

async function fetchActiveSubscriptions(supabase: SupabaseClient): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, channel, owner, target, filters, status, consecutive_failures, secret_ciphertext")
    .eq("status", "active")
    .returns<SubscriptionRow[]>();

  if (error || !data) return [];
  return data;
}

async function hasSuccessfulDelivery(supabase: SupabaseClient, subscriptionId: string, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from("deliveries")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("event_id", eventId)
    .eq("status", "success")
    .limit(1)
    .maybeSingle();
  return data != null;
}

async function venueNameFor(supabase: SupabaseClient, mic: string | undefined, cache: Map<string, string>): Promise<string> {
  if (!mic) return "the venue";
  const cached = cache.get(mic);
  if (cached) return cached;

  const { data } = await supabase.from("venues").select("name").eq("mic", mic).maybeSingle();
  const name = (data?.name as string | undefined) ?? mic;
  cache.set(mic, name);
  return name;
}

async function buildTelegramText(
  supabase: SupabaseClient,
  event: BellstateEvent,
  venueNameCache: Map<string, string>,
): Promise<string> {
  const context = eventToContext(event);
  const eventUrl = event.data.eventUrl;
  const symbol = context.symbol ?? event.data.listing ?? "unknown";

  if (event.type === "halt.opened") {
    const venueName = await venueNameFor(supabase, context.mic, venueNameCache);
    const haltAtIso = event.data.latency?.haltAt ?? event.createdAt;
    const onchainAtIso = event.data.latency?.onchainAt ?? event.createdAt;
    const latencySeconds = Math.max(
      0,
      Math.round((new Date(onchainAtIso).getTime() - new Date(haltAtIso).getTime()) / 1000),
    );
    const reasonCode = event.data.reason?.code ?? "UNKNOWN";
    const reasonText = event.data.reason?.text ?? reasonCode;
    const poolsText = event.data.market?.poolsBlocked === false ? "pools open" : "pools blocked";

    return buildHaltOpenedMessage({
      symbol,
      venueName,
      reasonText,
      reasonCode,
      haltAtEt: formatEt(haltAtIso),
      onchainAtEt: formatEt(onchainAtIso),
      latencySeconds,
      poolsText,
      eventUrl: eventUrl ?? "",
    });
  }

  if (event.type === "halt.resumed") {
    const venueName = await venueNameFor(supabase, context.mic, venueNameCache);
    const resumedAtIso = event.data.latency?.onchainAt ?? event.createdAt;
    return buildHaltResumedMessage({
      symbol,
      venueName,
      resumedAtEt: formatEt(resumedAtIso),
      surgeFeePercent: event.data.market?.surgeFeePercent ?? 0,
      surgeDecayByEt: event.data.market?.surgeDecayAt ? formatEt(event.data.market.surgeDecayAt) : "unknown",
    });
  }

  return buildGenericEventMessage({ type: event.type, listing: event.data.listing, eventUrl });
}

async function handleDeliveryFailure(env: Env, supabase: SupabaseClient, sub: SubscriptionRow): Promise<void> {
  const consecutiveFailures = sub.consecutive_failures + 1;

  if (consecutiveFailures < DISABLE_AFTER_CONSECUTIVE_FAILURES) {
    await supabase.from("subscriptions").update({ consecutive_failures: consecutiveFailures }).eq("id", sub.id);
    return;
  }

  await supabase
    .from("subscriptions")
    .update({ consecutive_failures: consecutiveFailures, status: "disabled" })
    .eq("id", sub.id);

  if (sub.channel === "telegram") {
    const chatId = sub.owner.startsWith("tg:") ? sub.owner.slice(3) : sub.owner;
    await sendTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      `Your Bellstate subscription has been disabled after ${consecutiveFailures} consecutive failed deliveries. Re-enable it from the app once the target is reachable again.`,
    );
  }
  // A webhook subscription's owner is a wallet address (packages/db/supabase/migrations/
  // 20260927150000_schema.sql: `owner text not null, -- wallet address or "tg:<chatId>"`). PRD
  // §8.5 says to "tell the owner (Telegram if linked; always shown on S13)" on disable, but the
  // current schema has no wallet-address -> Telegram-chat link column, so there's no chat this
  // Worker can message for a webhook-channel subscription. `status = 'disabled'` is written
  // either way, which is what S13 (a web screen, out of scope here) reads to show it.
}

interface DeliveryOutcome {
  ok: boolean;
  retryAfterSeconds?: number;
}

async function deliverToSubscription(
  env: Env,
  supabase: SupabaseClient,
  sub: SubscriptionRow,
  event: BellstateEvent,
  venueNameCache: Map<string, string>,
  attempt: number,
): Promise<DeliveryOutcome> {
  // Cloudflare's queue-level retry (wrangler.jsonc: max_retries 3, DLQ bellstate-events-dlq)
  // reprocesses the whole message, including subscriptions this event already delivered to
  // successfully on an earlier attempt. Checking `deliveries` first makes redelivery idempotent
  // without needing per-subscription queue state.
  if (await hasSuccessfulDelivery(supabase, sub.id, event.id)) {
    return { ok: true };
  }

  const start = Date.now();
  const outcome =
    sub.channel === "telegram"
      ? await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          sub.owner.startsWith("tg:") ? sub.owner.slice(3) : sub.owner,
          await buildTelegramText(supabase, event, venueNameCache),
        )
      : sub.secret_ciphertext
        ? await deliverWebhook(sub.target, event, event.id, sub.secret_ciphertext, sub.id, env.WEBHOOK_ENCRYPTION_KEY)
        : { ok: false, error: "webhook secret unavailable; recreate subscription" };
  const latencyMs = Date.now() - start;

  const retryAfterSeconds = outcome.retryAfterSeconds;

  await supabase.from("deliveries").insert({
    subscription_id: sub.id,
    event_id: event.id,
    attempt,
    status: outcome.ok ? "success" : "failed",
    http_status: outcome.httpStatus ?? null,
    latency_ms: latencyMs,
    error: outcome.ok ? null : (outcome.error ?? "unknown error"),
    next_attempt_at: retryAfterSeconds != null ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString() : null,
  });

  if (outcome.ok) {
    if (sub.consecutive_failures !== 0) {
      await supabase.from("subscriptions").update({ consecutive_failures: 0 }).eq("id", sub.id);
    }
  } else {
    await handleDeliveryFailure(env, supabase, sub);
  }

  return { ok: outcome.ok, retryAfterSeconds };
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("subscriptions").select("id", { count: "exact", head: true });

  if (error) {
    return c.json({ ok: false, supabase: "unreachable", error: error.message }, 503);
  }
  return c.json({ ok: true, supabase: "reachable" });
});

export default {
  fetch: app.fetch,

  /**
   * PRD §8.5: consumes `bellstate-events`, matches subscriptions by filter, delivers, records
   * every attempt to `deliveries`. Retry ladder: this pass uses Cloudflare's own queue-level
   * retry (`message.retry()`, configured in wrangler.jsonc as max_retries 3 with DLQ
   * `bellstate-events-dlq`) rather than hand-building the PRD's full 30s/2m/10m/30m/1h/hourly-to-
   * 24h ladder, which would need a Durable Object alarm to re-enqueue a single message on a
   * custom delay — no DO is provisioned in wrangler.jsonc for this pass, so that ladder is
   * deferred. Telegram's 429 `retry_after` is honored via `message.retry({ delaySeconds })`,
   * which *is* a real, precise per-message delay, just bounded by max_retries 3 before the DLQ
   * takes over rather than the PRD's longer hourly-for-24h tail.
   *
   * TODO(deferred): PRD §10.6's "at most 20 messages per minute per chat, excess into one digest
   * message" needs a per-chat rolling counter and a digest buffer that survives across separate
   * queue invocations — that's Durable Object state, not provisioned here either. Every matching
   * event currently sends its own Telegram message (still correctly at most once per event per
   * chat, via the `deliveries` idempotency check above).
   */
  async queue(batch, env, _ctx) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const venueNameCache = new Map<string, string>();

    for (const message of batch.messages) {
      try {
        const parsed = parseMessageBody(message.body);
        if (!isBellstateEvent(parsed)) {
          console.error("notifier: dropping malformed queue message", { messageId: message.id });
          message.retry();
          continue;
        }

        const context = eventToContext(parsed);
        const subscriptions = await fetchActiveSubscriptions(supabase);
        const matching = subscriptions.filter((sub) => matchesFilters(sub.filters ?? {}, context));

        let anyFailed = false;
        let maxRetryAfterSeconds: number | undefined;

        for (const sub of matching) {
          const result = await deliverToSubscription(env, supabase, sub, parsed, venueNameCache, message.attempts);
          if (!result.ok) {
            anyFailed = true;
            if (result.retryAfterSeconds != null) {
              maxRetryAfterSeconds = Math.max(maxRetryAfterSeconds ?? 0, result.retryAfterSeconds);
            }
          }
        }

        if (anyFailed) {
          message.retry(maxRetryAfterSeconds != null ? { delaySeconds: maxRetryAfterSeconds } : undefined);
        } else {
          message.ack();
        }
      } catch (error) {
        console.error("notifier: unexpected error processing queue message", {
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, unknown>;
