Signer Worker (PRD §8.1), deployed as `signer-a`/`signer-b`/`signer-c` (see `wrangler.jsonc`'s
`env.a`/`env.b`/`env.c` — this codebase deploys once per signer identity, with different secrets).

This signer only signs and POSTs to `AGGREGATOR_URLS` (§6.5). It never holds a submitter key and
never calls a BellstateHub write function.

## What's built

Three of the seven Durable Objects PRD §8.1 lists — enough to continuously attest the one real
asset currently registered onchain: **NVDAx** (reference listing `XNAS:NVDA`,
`deployments/xlayer-mainnet.json`).

- **`src/durableObjects/usHaltsDO.ts` (`US_HALTS` binding, class `UsHaltsDO`)** — wraps the
  existing, tested `UsHaltsState` reducer (`src/domains/usHalts.ts`) in a DO. Polls the real
  Nasdaq trade-halts RSS feed (unfiltered — VENUE-wide `MWC*` halts aren't symbol-specific) and
  the real NYSE trade-halts historical/filter API (filtered to `symbol=NVDA` at the source, safe
  because NYSE halts are always ASSET-scoped), exactly the same functions
  `scripts/submit-market-update.ts` already proved work on mainnet. The two feeds run on genuinely
  independent cadences (§4.1/§4.2), each tracked with its own next-due time and only fetched when
  due (`src/scheduling/haltPollCadence.ts`, tested): Nasdaq polls once per 60s, staggered by
  `SIGNER_SLOT` so signer-a/b/c collectively hit it every 20s; NYSE polls once per 30s, flat, no
  slot stagger. Both back off to once per 300s outside XNAS's 04:00–20:00 ET session window
  (`session !== "CLOSED"` on the real calendar, which is exactly that window and correctly
  narrows on a half day too). An earlier version of this file polled both feeds on one flat 60s
  cadence regardless of session — a real, disclosed-late bug, fixed here, not a stub. State is
  in-memory only; see the file's header comment for why that's the correct call here, not a
  shortcut.
- **`src/durableObjects/chainDO.ts` (`CHAIN` binding, class `ChainDO`)** — every 5s, reads
  `BellstateHub`'s real `calendarVersion()`, `frozenUntil()`, `marketView(NVDA listingId)`,
  `domainDigests(US_MARKETS)` (for the domain's heartbeat version) and `signerSet()`, plus the
  latest block's timestamp, over the real X Layer RPC (`XLAYER_RPC_URLS`, with automatic fallback
  across multiple URLs). View is cached in memory; a cold instance is self-armed to read
  immediately rather than waiting for the next scheduled tick.
- **`src/durableObjects/coreDO.ts` (`CORE` binding, class `CoreDO`)** — every 5s: pulls both DOs'
  snapshots, checks the three §8.1 refusal conditions (`src/core/refusal.ts`), resolves the real
  session window (`@winsznx/bellstate-calendars`), runs the existing tested `tick()`
  (`src/core/tick.ts`) — which itself calls `deriveMarket` — diffs against the onchain view
  (`src/chain/marketViewToState.ts` converts the hub's numeric `MarketView` back into the engine's
  string-enum `MarketState`), signs each resulting `MarketUpdate`/`Heartbeat` with
  `SIGNER_PRIVATE_KEY` via `packages/protocol`'s `signMessage`/`privateKeyToAccount`, and POSTs the
  batch to every URL in `AGGREGATOR_URLS`.
- **`src/worker.ts`** — Hono app exporting `UsHaltsDO`/`ChainDO`/`CoreDO` (names match
  `wrangler.jsonc`'s bindings exactly), `GET /health` (signer address, last tick, refusal reasons,
  per-source health, calendar version, epoch, build SHA), and a `scheduled()` cron handler
  (`* * * * *`, already configured in `wrangler.jsonc`) that re-arms any DO whose alarm was ever
  dropped — each DO also self-arms in its own constructor, so this is a safety net, not the only
  thing keeping the loops alive.

Pure logic added for this build, each with real vitest coverage in `tests/`:
`src/scheduling/nextSlotAlarm.ts` (slot math), `src/domains/sourceHealth.ts` (§3.3's health-age
rule), `src/core/refusal.ts` (§8.1's three refusal conditions), `src/chain/marketViewToState.ts`
(onchain → engine state), `src/core/attestation.ts` (bigint-safe message serialization), and
`src/core/postToAggregators.ts` (fan-out POST with per-URL failure isolation).

## Deferred — explicitly, not silently

PRD §8.1's table lists seven DOs: `UsHalts`, `HkHalts`, `KrHalts`, `Issuer`, `Valuation`, `Chain`,
`Core`. This build only implements three.

- **`HkHaltsDO` / `KrHaltsDO`** — not built. `src/domains/hkHalts.ts`'s pure reducer already exists
  and is tested, but there's no DO wrapping it yet, and KRX has no real halt source wired up at all
  (`internal/NEEDS.md` gate G2 — KIND access). Wiring `HkHaltsDO` the same way as `UsHaltsDO` is
  straightforward once that's prioritized; `KrHaltsDO` needs the source package built first.
- **`IssuerDO` / `ValuationDO`** — not built. Both need a live xstocks catalog sync
  (`packages/sources/xstocks`) tracked with a freshness clock, and `ValuationDO` additionally needs
  Chainlink Data Streams access, which is blocked (`internal/NEEDS.md` item 1: real feed ID exists
  and is live, but the self-serve plan only covers crypto pairs — equities need an enterprise
  conversation that hasn't happened).
- **`deriveProgram`/`derivePrimary`/`deriveValuation` for `xstocks:NVDAx`** (the one registered
  program, `programId` in `deployments/xlayer-mainnet.json`) — not wired into `CoreDO`, even though
  `deriveMarket` for the one registered listing is. `tick()` is called with `programs: []`,
  `primaries: []`, `valuations: []`, which is the correct "no subjects registered for this facet"
  input, not a placeholder. Reason for deferring: unlike `deriveMarket`, which only needed the
  halt feeds and the calendar (both already real and tested), these three each need a
  `ProgramSnapshot`/`PrimaryCatalogView`/`ValuationReport` built from onchain token-pause reads
  (`paused()` on the raw and wrapped token, `programInfo()` on the hub), a live xstocks catalog
  fetch with its own age-tracking, and (for valuation) the blocked Chainlink feed. That's a second,
  separately-real integration this pass didn't have room to build and verify carefully — not
  something to wire up quickly and hope the pause-detection or catalog-freshness logic is right.
- **Multicall batching in `ChainDO`** — each hub view is read with its own `readContract` call.
  PRD §8.1 describes Multicall for reading "all subjects"; with exactly one subject registered,
  batching saves nothing yet. Worth adding once more listings/programs are registered and the
  per-tick call count actually grows.
- **`UsHaltsDO`/`ChainDO` state across Durable Object eviction** — kept in memory only, not
  persisted to `ctx.storage`. See each file's header comment for why that's a deliberate,
  documented call (both feeds/reads are re-fetched as full current snapshots on a short cadence,
  not deltas) rather than a gap.

## Env vars

Cross-checked against `.env.example`:

| Var | Used by | Notes |
|---|---|---|
| `SIGNER_PRIVATE_KEY` | `CoreDO` | Only ever passed to `packages/protocol`'s `privateKeyToAccount`; never logged or returned by `/health` (only the derived address is). |
| `SIGNER_SLOT` | `UsHaltsDO` | `0`/`20`/`40`. Parsed by `src/scheduling/nextSlotAlarm.ts`; throws on an invalid value rather than silently defaulting. |
| `AGGREGATOR_URLS` | `CoreDO` | Comma-separated. Posted to in parallel every tick; one URL's failure doesn't affect the others. |
| `XLAYER_RPC_URLS` | `ChainDO` | Comma-separated. A 2nd+ URL becomes a viem `fallback` transport. |
| `HUB_ADDRESS` | `ChainDO`, `CoreDO` | `BellstateHub` on X Layer mainnet. |
| `CHAINLINK_DS_API_KEY` / `CHAINLINK_DS_API_SECRET` | not yet | Reserved for the deferred `ValuationDO`; unused by this build (see Deferred, above). |
| `BUILD_SHA` | `worker.ts` `/health` | Optional. Not a real build pipeline output yet — set via `wrangler deploy --var BUILD_SHA:$(git rev-parse HEAD)` in CI if wanted; `/health` reports `null` when unset. |

## Testing

`npx tsc --noEmit` and `pnpm test` (`vitest run`) both from this directory. DO wrapper files
(`src/durableObjects/*.ts`) import `cloudflare:workers` and aren't unit-testable under this
package's plain-Node vitest setup (no `@cloudflare/vitest-pool-workers` config exists in this repo
yet) — consistent with the rest of this app, only the pure logic they wrap is tested directly.
