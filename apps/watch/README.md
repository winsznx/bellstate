# `@winsznx/bellstate-watch`

Oracle Watch — PRD §8.6. A Cloudflare Worker with one Durable Object (`Watcher`) that polls
Hyperliquid's real `xyz` dex (trade.xyz's HIP-3 equity-perp market) every 5 seconds, stores
`oraclePx`/`markPx` history, and flags three known bad-price-reaction patterns against Bellstate's
own attested venue status — never against raw source data.

## What's live

- **Polling.** `Watcher.alarm()` fires every 5s, calls the real
  `POST https://api.hyperliquid.xyz/info` with `{"type":"metaAndAssetCtxs","dex":"xyz"}` (verified
  against the live endpoint while building this — the dex slug really is the literal string
  `"xyz"`, and its universe entries are named `xyz:<SYMBOL>`), for every market currently seeded in
  `perp_markets`.
- **Storage.** Every polled market's `oraclePx`/`markPx` is written to `perp_snapshots` each tick.
  The 48h retention window is an existing daily `pg_cron` job
  (`packages/db/supabase/migrations/20260927150300_retention.sql`) — this worker only inserts.
- **Detection.** `src/flags.ts` implements the three §8.6 rules as pure functions over a price
  sample series and decoded listing statuses — no network/DO/Supabase in that file, so a rule
  evaluated live can be re-run byte-for-byte against stored `perp_snapshots` rows later (S07's
  own "done when" condition):
  - `THIN_OPEN_MOVE` — |Δ oraclePx| ≥ 3% in 60s, starting inside the first 60s of a mapped
    secondary venue's `EXTENDED` session while the primary listing isn't `REGULAR`.
  - `CLOSED_MOVE` — |Δ| ≥ 3% in 60s while every listing mapped to the market is `CLOSED`.
  - `HALTED_MOVE` — |Δ| ≥ 1% in 60s while the primary listing is `ASSET_HALTED` or
    `VENUE_HALTED`.
  - All three thresholds are inclusive (`>=`), covered by boundary tests in `tests/flags.test.ts`.
- **Rolling window.** The Durable Object keeps its own short rolling price history (180s, well
  over the 60s the rules need) in its SQLite storage (`oracle_samples`), used only to compute the
  60s delta — unrelated to `perp_snapshots`' 48h retention.
- **On a flag.** Writes a row to `oracle_watch_events` and publishes an `oraclewatch.flagged`
  message (PRD §10.5's event envelope: `{id, type, createdAt, data}`) to the real
  `bellstate-events` queue via the `EVENTS_QUEUE` binding.
- **Self-arming.** A Durable Object only starts once something accesses it. `GET /health` gets the
  `Watcher` stub and calls its `ping()` RPC method, which arms the first alarm if none is set;
  every `alarm()` tick after that re-arms its own successor via `ctx.storage.setAlarm`, so the poll
  loop is self-sustaining once started (no cron trigger is declared in `wrangler.jsonc` — see
  Deferred).
- **Resilience.** A failed tick (Supabase or Hyperliquid unreachable) is caught, logged via
  `console.error` (picked up by `observability`), and the loop still re-arms on schedule — one bad
  tick just means a missing 5s slice, not a stalled worker.

## Data source: `status_current`, not `status_history`

PRD §8.6 reads: *"Detection uses Bellstate's attested status from `status_history` at each
instant, never raw source data."* This build reads `status_current` instead, per this task's own
explicit data-source instruction, and because it's the semantically correct table for "the status
right now": `status_current` is (`facet`, `subject_id`)-keyed, one row per listing, and is the
table `packages/db`'s own schema comments call "Effective status (mirrors onchain state)".
`status_history` is the append-only per-change log (`log_index`, `block_number`, `t_indexed`) built
for audit/replay — reconstructing status *as of an arbitrary past instant* (e.g. for `/replay`),
not for a live 5s poller asking "what is true right now." `status_current`'s content is a subset
of `status_history`'s latest row per subject either way, so detection accuracy is identical; this
is a data-access-path choice, not a behavior difference. See `src/status.ts`'s top comment.

## Deferred

- **No Cron Trigger in `wrangler.jsonc`.** The file was provided fixed for this task (DO + queue
  bindings only), so the alarm loop's first arm depends on an external hit to `GET /health` (a
  deploy-time smoke test, an uptime monitor, or the Board linking here would all do it in
  practice). Production should add `"triggers": { "crons": [...] }` calling `/health` as a
  belt-and-suspenders bootstrap — a one-line config addition once this file's ownership is picked
  up outside this task's directory-scoped constraints.
- **Session/interruption enums are duplicated, not imported.** `src/status.ts` hand-copies
  `packages/engine/src/types.ts`'s `SESSIONS`/`INTERRUPTIONS` arrays (with a comment pointing back
  at the source). `apps/watch/package.json` doesn't declare `@winsznx/bellstate-engine` as a
  workspace dependency, and this task's constraints forbid both `pnpm add` and editing
  `package.json`. Adding that dependency and switching the import is a one-line follow-up.
- **`candleSnapshot` (PRD §4.9) is unused.** It backs the Gate G9 backtest/replay tooling
  (resolving a market's historical name, e.g. `xyz:SKHYNIX` → `xyz:SKHX`) and the `/replay` player
  (S09), not the live 5s poller — out of this task's four-file scope.
- **No `/watch` UI or `GET /watch` API route.** Those are `apps/web` (S07) and `apps/api` (§10.2)
  surfaces respectively; this task is the Worker + DO only.
- **Unmapped markets are silently skipped, not surfaced.** PRD's S07 lists an "unmapped market" UI
  state (S16); this worker just skips a `perp_markets` row it can't find in the current Hyperliquid
  universe response rather than writing a row anywhere — there's no table in scope here to record
  that state in.

## Env vars

Cross-checked against `.env.example`:

| Var | Used for |
|---|---|
| `SUPABASE_URL` | Reading `perp_markets`/`status_current`, writing `perp_snapshots`/`oracle_watch_events`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Same client, service-role (bypasses RLS for both reads and writes). |
| `XLAYER_RPC_URLS` | Not used by this worker — Oracle Watch never reads X Layer. Left as-is (not introduced by this task; likely copied from a shared template). |

No new vars were introduced.

## Files

- `src/worker.ts` — Hono app, `GET /health`, exports `Watcher`.
- `src/watcher.ts` — the `Watcher` Durable Object: alarm loop, Supabase reads/writes, Hyperliquid
  poll, flag evaluation wiring, queue publish.
- `src/flags.ts` — the three pure flag rules + the price-delta calculation.
- `src/status.ts` — decodes a `status_current` row into a named `{session, interruption,
  sessionSince}`.
- `src/hyperliquid.ts` — the real `metaAndAssetCtxs` client and its response indexing.
- `src/db.ts` — typed Supabase query/insert helpers for the four tables this worker touches.
- `tests/flags.test.ts` — vitest coverage for all three rules (fires / doesn't fire / boundary).

## Commands

```bash
pnpm --filter @winsznx/bellstate-watch test   # vitest
cd apps/watch && npx tsc --noEmit             # typecheck
```
