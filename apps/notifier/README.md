Notifier Worker (PRD §8.5) — a Cloudflare Queue consumer that routes `bellstate-events` to
Telegram and webhook subscriptions, with a `GET /health` liveness check.

## What's here

- `src/worker.ts` — default export with `fetch` (`GET /health`, checks Supabase reachability) and
  `queue(batch, env)`, the real consumer for the `bellstate-events` queue configured in
  `wrangler.jsonc`. For each message: validates the event envelope, fetches `active` subscriptions
  from Supabase, matches them by filter (`src/filters.ts`), delivers to each match (Telegram or
  webhook), records every attempt to `deliveries`, bumps or resets `consecutive_failures`, and
  disables a subscription at 50 consecutive failures (PRD §8.5).
- `src/telegram.ts` — `sendTelegramMessage` (real `POST .../sendMessage`, MarkdownV2, escapes the
  text, surfaces a 429's `retry_after`), `escapeMarkdownV2`, and the two PRD §10.6 illustrative
  message templates (`buildHaltOpenedMessage`, `buildHaltResumedMessage`) plus a generic fallback
  (`buildGenericEventMessage`) for the event types the PRD gives no bespoke Telegram copy for.
- `src/webhookDelivery.ts` — `deliverWebhook`: real `fetch` POST, 10s timeout via
  `AbortController`, `redirect: "manual"`, only a 2xx response counts as success. See the
  signature gap below.
- `src/filters.ts` — `matchesFilters`: `{types, symbols, mics, families}`, AND across groups,
  empty group means all (PRD §10.5), mirroring `apps/api/src/filters.ts` adapted for an event
  belonging to more than one program/family at once.
- `tests/*.test.ts` — 27 real vitest tests for every pure piece (MarkdownV2 escaping, both
  illustrative message templates, filter matching, the event-envelope guard) plus
  `sendTelegramMessage`/`deliverWebhook` exercised against an injected fake `fetch` (success, 429,
  non-2xx, network error, and a real 10s-timeout abort using fake timers) — no real network calls.

## The webhook signature gap (real, not papered over)

PRD §10.5 requires a `Bellstate-Signature: t=<unix>,v1=<hex(hmac_sha256(secret, ...))>` header.
Computing that HMAC needs the subscription's **plaintext** secret. `apps/api`'s `createWebhook`
(`apps/api/src/webhooksService.ts`) only ever stores `secret_hash = sha256(secret)` — a one-way
hash, exactly per §10.5's own "Secret. Returned once, then stored as a SHA-256 hash." A one-way
hash cannot produce an HMAC any real subscriber could verify. Signing with the hash as if it were
the secret would produce a signature that looks well-formed and is silently wrong for every
subscriber — worse than no signature at all. This was already found and documented in a previous
session (`BUILDLOG.md`, "apps/api webhooks logic, verified against real Supabase").

`deliverWebhook` sends `Bellstate-Event-Id` (needs no secret) but **omits**
`Bellstate-Signature`, with a comment on that exact line in `src/webhookDelivery.ts`. The real
fix is on the storage side — an encrypted, recoverable secret column instead of a one-way hash —
and is out of scope for this Worker (`apps/api` was off-limits for this task).

## Deferred (PRD is bigger than one pass; here's exactly what's left and why)

- **Full retry ladder.** PRD §8.5 specifies 30s/2m/10m/30m/1h, then hourly up to 24h. This Worker
  uses Cloudflare's own queue-level retry instead (`message.retry()`; `wrangler.jsonc` sets
  `max_retries: 3` with DLQ `bellstate-events-dlq`). Building the full ladder needs a Durable
  Object alarm to re-enqueue a single message on a custom delay — no DO is provisioned in
  `wrangler.jsonc` for this pass. Telegram's 429 `retry_after` *is* honored precisely via
  `message.retry({ delaySeconds })`, just bounded by `max_retries: 3` before the DLQ takes over
  rather than the PRD's full hourly-for-24h tail.
- **Telegram's 20-messages-per-minute-per-chat digest.** PRD §10.6: excess events beyond 20/min
  per chat should collapse into one digest message. That needs a per-chat rolling counter and a
  digest buffer that survives across separate queue invocations — Durable Object state, not
  provisioned here. Every matching event currently sends its own Telegram message. The "at most 1
  message per event per chat" half of that same rule **is** implemented, via the `deliveries`
  idempotency check described below.
- **Notifying a webhook subscription's owner on disable.** PRD §8.5: "tell the owner (Telegram if
  linked...)" when a subscription is auto-disabled. A webhook subscription's `owner` is a wallet
  address (`packages/db/supabase/migrations/20260927150000_schema.sql`), and the schema has no
  wallet→Telegram-chat link column, so there's no chat this Worker can message for that case.
  `status = 'disabled'` is still written correctly either way — S13 (a web screen, out of scope
  here) reads that to show it.
- **The real event envelope's `market`/`reason`/`latency` shape.** PRD §10.5 gives the payload's
  top-level shape but leaves these three nested objects as `{...}`. No producer exists yet to pin
  them down for the halt/status event types (`apps/indexer/src/domainEvents.ts` only derives
  *which* event names fire off a contract log; nothing publishes the full envelope onto
  `bellstate-events` for those yet). `apps/watch` does have a real producer for
  `oraclewatch.flagged` (its `EVENTS_QUEUE.send`), but with its own shape
  (`{name, dex, flag, movePct, windowStart, windowEnd}`), not this one — every `BellstateEventData`
  field is optional specifically so that envelope still parses and degrades to a plain, linkless
  message instead of being dropped. `src/worker.ts` documents this right above
  `BellstateEventData`, sized to exactly what the two illustrative Telegram templates need, with a
  TODO to reconcile it against `apps/watch`'s real shape and against a future halt/status producer.

## A correctness note: idempotent redelivery

Cloudflare's queue-level retry reprocesses the *whole* message, including subscriptions an event
already delivered to successfully on an earlier attempt. Before delivering to a subscription,
`deliverToSubscription` checks `deliveries` for an existing `status = 'success'` row for that
`(subscription_id, event_id)` pair and skips if found — so a retried message never double-sends.

## Environment variables

Cross-checked against `.env.example` (all five already present; none added by this pass):

| Variable | Used by this Worker? |
|---|---|
| `SUPABASE_URL` | Yes — reads `subscriptions`/`venues`, writes `deliveries`/`subscriptions`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes — same as above. |
| `TELEGRAM_BOT_TOKEN` | Yes — `sendTelegramMessage`'s outbound `sendMessage` calls. |
| `TELEGRAM_WEBHOOK_SECRET` | No — verifies Telegram's *incoming* webhook, owned by `apps/api`'s Telegram webhook receiver (PRD §8.4), not this outbound-only Worker. Kept in `Env` for documentation. |
| `OPS_TELEGRAM_CHAT_ID` | No — PRD §8.8's cross-cutting ops-alert chat (DLQ non-empty, source unhealthy, etc.), a separate concern from §8.5's routing/delivery job this Worker implements. Kept in `Env` for documentation. |

## Running

```bash
cd apps/notifier
npx tsc --noEmit   # type-check
npx vitest run     # 27 tests, no network calls
```
