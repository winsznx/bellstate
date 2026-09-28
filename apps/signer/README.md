Signer Worker (PRD §8.1), deployed as `signer-a`/`signer-b`/`signer-c`.

## What's here

- `src/domains/usHalts.ts` — the `UsHalts` Durable Object's cross-poll merge logic (§4.1/§4.2):
  Nasdaq's reasonCode always wins, NYSE fills a missing resumption or can trigger a halt Nasdaq
  hasn't posted yet, `MWCQ` closes every open market-wide halt across all US MICs. Pure and
  DO-runtime-independent — integration-tested against the real captured fixtures in
  `packages/sources/{nasdaq,nyse}-halts`.
- `src/core/tick.ts` — the `Core` Durable Object's tick logic (§8.1 steps 2-5): runs the four
  `derive*` functions for every subject, diffs against the onchain view, builds a signed-update
  message for each differing subject (`seq = onchain + 1`), and a heartbeat for every domain with
  no diffs. Pure — pulling snapshots from other DOs and POSTing to `AGGREGATOR_URLS` (steps 1 and
  6) are the DO wrapper's job, not implemented here.

## Not yet implemented

The actual Durable Object classes, `HkHalts`/`KrHalts`/`Issuer`/`Valuation`/`Chain` domain logic,
signing (needs a per-signer secret key — Worker secrets, never committed), and `wrangler.jsonc`
are not built yet. Blocked, per `internal/NEEDS.md`:

- **Cloudflare login** — no Worker can be deployed or `wrangler dev`-tested without it.
- **Chainlink Data Streams credentials** (gate G1) — blocks `Valuation` DO and anything touching
  the valuation facet.
- **KIND access** (gate G2) — `KrHalts` can't be built correctly yet; see
  `packages/sources/kind-halts/GATE_G2.md`.
- **`BellstateHub` mainnet deployment** — `Chain` DO reads live onchain state that doesn't exist
  until the hub is actually deployed (itself blocked on funded wallets, per §1).

What *is* buildable without any of the above — the pure business logic above, plus `HkHalts`
(HKEXnews needs no credentials) — is what's here.
