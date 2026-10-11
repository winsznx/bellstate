Indexer Worker (PRD §8.3) — event decoding and domain-event derivation.

## What's here

- `src/abi.ts` — the hub's event ABI fragments, extracted verbatim from
  `packages/contracts/out/BellstateHub.sol/BellstateHub.json` (regenerate the same way if the
  contract's events change: `forge build` in `packages/contracts`, re-extract the `event`-typed
  entries). Committed statically rather than read at runtime, since a Worker can't read the
  contracts package's build output at deploy time.
- `src/decodeHubLog.ts` — decodes a raw log into a typed event, `null` for anything this indexer
  doesn't act on yet (registration/admin events).
- `src/domainEvents.ts` — §8.3's "Publishes domain events to Queue bellstate-events":
  `status.{market,program,primary,valuation}.changed` plus `halt.opened`/`halt.resumed`, derived
  from a `MarketUpdated` event's interruption value against the prior one.
- `src/rows.ts` — maps a decoded event + its log into `packages/db`'s `status_history`/
  `status_current` row shapes.

## Tested against a real deployed contract, not synthetic logs

`tests/decode.fork.test.ts` deploys the actual compiled `BellstateHub` to a local anvil, submits
a genuinely quorum-signed `MarketUpdate` through it using `packages/protocol`'s real EIP-712
signing (exactly what the signer would produce), and decodes the log the contract actually
emitted — including a real ASSET_HALTED transition to prove `halt.opened`/`halt.resumed`
derivation against real event data, not hand-constructed viem `Log` objects. Skipped by default
(needs `anvil` on `PATH`):

```bash
RUN_FORK_TESTS=1 pnpm --filter @winsznx/bellstate-indexer test:fork
```

`tests/domainEvents.test.ts` covers the same derivation logic with fast, anvil-free synthetic
inputs for the edge cases (first-ever update already halted, staying halted across two halt
codes, no prior state at all).

## Live mainnet recovery

`scripts/seed-nvda-registry.ts` checks the deployed BellstateHub registry, token adapters and
decimals against the issuer's current X Layer catalog entry. It prints the four proposed
`listings`, `programs`, and `tokens` rows by default. With `--apply`, it inserts only missing
rows into Supabase; it never overwrites an existing registry record. The verified NVDAx rows
were inserted on 2026-10-11.

`scripts/scan-hub-history.ts` scans finalized BellstateHub logs in 100-block windows and saves
an atomic, resumable checkpoint at `internal/hub-history-scan.json`. It is read-only. Both
official public X Layer RPCs enforce a 100-block `eth_getLogs` range and may rate-limit bursts,
so scanning the full deployment history can take a long time. Set `XLAYER_RPC_URL` to a
compatible provider if one is available. The checkpoint contains raw onchain logs and stays
local; no status rows are published until the scan and a separate database writer are verified.

`scripts/scan-hub-history-okx.ts` uses the existing OKX X Layer Data API credentials to list
transactions sent to the hub, then independently verifies every transaction receipt against
X Layer RPC and decodes its actual hub logs. It recovered 770 finalized inbound transactions:
246 contiguous `MarketUpdated` events (seq 1–246) and 524 `SubmissionFailed` events, all
decoded as `StaleSeq`. The credential and raw receipt checkpoint remain local. This route
avoids the public RPC's 100-block range limit.

`scripts/publish-hub-history.ts` requires the recovered market sequence to be contiguous and
equal to the onchain seq before writing. It prints a dry-run summary by default. With
`--apply`, it inserts only missing `(tx_hash, log_index)` rows into `status_history` and upserts
`status_current` with the contract's digest, written time and effective time. On 2026-10-11,
all 246 verified history rows and current seq 246 were published. The effective market state
is still stale and appears as UNKNOWN; this backfill does not create a live attestation.

From the repository root:

```bash
pnpm --filter @winsznx/bellstate-indexer scan:history
pnpm --filter @winsznx/bellstate-indexer scan:history:okx
pnpm --filter @winsznx/bellstate-indexer publish:history
pnpm --filter @winsznx/bellstate-indexer seed:nvda
```

## Not yet built

The Durable Object's alarm-driven poll loop (`eth_getLogs` every 2s, §8.3), reorg safety (keep
the last 20 block hashes, rewind on a parent-hash mismatch), the Supabase writes themselves, and
the actual `bellstate-events` Queue publish. BellstateHub is deployed on X Layer mainnet;
the missing pieces are the polling, storage, reorg and queue implementation, not deployment.
