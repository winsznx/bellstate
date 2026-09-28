API Worker (PRD §10) — webhooks logic built and verified against the real production Supabase
project.

## What's here

- `src/webhookUrl.ts` — §10.5's URL rules: https-only, port 443, hostname must resolve to public
  IPs (rejects RFC 1918, loopback, link-local/metadata, CGNAT, for both IPv4 and IPv6). Fails
  closed on an unrecognized address family or a DNS lookup failure.
- `src/webhookSignature.ts` — secret generation/hashing (SHA-256, never stores the raw secret)
  and the `Bellstate-Signature: t=<unix>,v1=<hex hmac>` scheme, both signing and the Node
  reference verification the docs (S10) are supposed to ship.
- `src/filters.ts` — `{types, symbols, mics, families}` matching: AND across groups, empty group
  means all (§10.5).
- `src/webhooksService.ts` — real Supabase-backed CRUD: create (re-validates the URL, generates
  and hashes the secret), list (never returns the secret or its hash), delete, and test delivery
  (real HTTP POST with `redirect: "manual"`, records every attempt to `deliveries`).

## Verified against the real thing, not a mock

`tests/webhooks.live.test.ts` runs against the actual production Supabase project — not a local
reproduction. Confirmed: a private-IP target is rejected before ever touching the database; a
real webhook row is created, listed back with the secret/hash correctly absent, then deleted; a
test delivery makes a genuine HTTP round trip (to `httpbin.org`) and the result — including the
real HTTP status — lands in `deliveries`. Cleaned up after itself; verified the database was
back to zero rows for the test owner afterward. Gated behind `RUN_LIVE_TESTS=1` since it's not
something a normal `pnpm test` run should touch a shared database for:

```bash
RUN_LIVE_TESTS=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @winsznx/bellstate-api test:live
```

## A real gap, documented rather than worked around

`testWebhook` can't currently sign a real test delivery correctly: the secret is stored only as
a SHA-256 hash (by design, per §10.5 — "returned once, then stored as a hash"), so there's
nothing to recover and sign with at test-delivery time. A real deployment needs a deliberate
answer to this (e.g., a short-lived KV entry holding the secret right after creation, expiring
before the "returned once" guarantee is meaningfully broken) — not implemented here, and not
faked by weakening the hash-only storage rule to make the test conveniently pass.

## Not yet built

SIWE auth (§10.1's session cookie, gating webhook ownership for real instead of a hardcoded test
owner), the actual Hono HTTP routing/handlers, x402 middleware (gate G11 credentials are ready —
see `internal/secrets/okx.env` — but no route wires them up yet), Telegram bot handling, print
check (§10.3), and the SDK (§10.7). This package is the webhooks logic only.
