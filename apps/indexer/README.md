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

## Not yet built

The Durable Object's alarm-driven poll loop (`eth_getLogs` every 2s, §8.3), reorg safety (keep
the last 20 block hashes, rewind on a parent-hash mismatch), the Supabase writes themselves, and
the actual `bellstate-events` Queue publish. All of that needs either a real deployed
`BellstateHub` on X Layer mainnet or Cloudflare Queue bindings — blocked the same way
`apps/signer`'s remaining pieces are (see its README).
