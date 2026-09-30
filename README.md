# Bellstate

**An onchain market-status oracle for tokenized US, HK and KR equities.**

Onchain stocks trade around the clock. The real markets behind them do not. Bellstate reads
the venues' own published halt feeds and session calendars directly, has three independent
signers attest the result with a 2-of-3 EIP-712 quorum, and writes it to a hub contract on X
Layer that any token, pool hook, or lending market can read through a standard interface
(ERC-8392). It never predicts a status. It only observes and signs one.

Built for SIMAN LABS SuperStar 2026 — RWA track, X Layer mainnet (chain 196).

| | |
|---|---|
| **Live app** | https://bellstate.timjosh507.workers.dev |
| **Live API** | https://bellstate-api.timjosh507.workers.dev |
| **Network** | X Layer mainnet, chain 196 |
| **BellstateHub** | [`0x714bF088…95c1B1B`](https://www.oklink.com/xlayer/address/0x714bF088613729949A2dA92709e25c1Af95c1B1B) |
| **HaltGateHook** | [`0x6947A925…9aF3EE080`](https://www.oklink.com/xlayer/address/0x6947A925F77A8D343626830567195429aF3EE080) |
| **First registered asset** | NVDAx, reference listing XNAS:NVDA — full address list in [`deployments/xlayer-mainnet.json`](deployments/xlayer-mainnet.json) |

### Try it

1. Open the app — the Board (`/board`) lists every tracked venue and asset, reading real
   session data live from Supabase.
2. `/watch`, `/network`, `/developers` and the rest of the 18 PRD screens are reachable from
   the sidebar; most are still fixture-backed pending a live signer/aggregator (see below).
3. The landing page at `/` explains the model; it isn't part of the oracle itself.

### What is live, and what is not

**Live.** All eight core contracts (`BellstateHub`, `AdapterFactory`, `StatusAdapter`,
`HookDeployer`, `HaltGateHook`, `LendingGuard`, `PrintGuard`, `PolicyLens`) deployed and
verified on X Layer mainnet by reading real bytecode back from the chain, not just trusting
a deploy log. One real asset (NVDAx) registered end to end, with a real quorum-signed status
already attested onchain: `apps/signer`'s real halt-merge logic read the live Nasdaq and NYSE
feeds (0 open halts) and the real session calendar, two of three signers signed a real
EIP-712 `MarketUpdate`, a submitter wallet wrote it to the hub
([`0x6706693c…f018a274b`](https://www.oklink.com/xlayer/tx/0x6706693c27e828824dd05f612242c22dad6e5f2b437270f9394c3f8f018a274b)),
and the NVDAx adapter's `referenceMarketStatus()` reads it back correctly (`CLOSED`, `NONE`,
not stale) — see `deployments/xlayer-mainnet.json`'s `firstAttestation` for the full trail.
A real Supabase project (27 tables, RLS verified against the live REST API) with the real 7
venues seeded. A real Next.js frontend and Hono API, both deployed to Cloudflare Workers,
both curl-verified against their live URLs. 241 tests passing (192 TypeScript, 49 Solidity),
including a 10,000-input fork test proving the TypeScript policy mirror matches the deployed
`PolicyLens` contract exactly.

**Not yet live.** That first attestation was a one-shot proof, not a running service —
`apps/signer` and `apps/aggregator` aren't deployed as continuously-running Workers yet, so
the status above will go stale until they are. `apps/notifier` and `apps/watch` have no
source yet. The owner role is a single EOA rather
than the PRD's 2-of-3 Safe (a deliberate hackathon-stage choice — upgrading later needs a
role grant, not a redeploy; see `deployments/xlayer-mainnet.json`). The valuation facet
(Chainlink Data Streams equity feed) is deliberately off: real API credentials were issued,
but equities access is enterprise/sales-gated, not self-serve — see `internal/NEEDS.md` item
1. This is the ERC-8392 spec's own designed-for-graceful-degradation path, not a bug: no
program has a valuation stream designated, so the interface simply isn't advertised.

### Repo layout

```
apps/
  web        Next.js 15 frontend (deployed)
  api        Hono backend on Cloudflare Workers (deployed)
  signer     Halt/session state machines, EIP-712 signing (built, not yet deployed)
  indexer    Hub event decoding (built, not yet deployed)
  aggregator Fan-in for signer submissions (not yet built)
  notifier   Alert delivery — Telegram, webhooks (not yet built)
  watch      Oracle Watch monitoring surface (not yet built)
packages/
  contracts  Solidity — hub, adapters, hooks, guards, policy libs (Foundry)
  engine     Pure status-derivation functions
  calendars  Venue session/holiday calendars
  protocol   EIP-712 signing (viem)
  policy     TypeScript mirror of the Solidity policy libraries
  sources    Per-venue halt feed parsers (Nasdaq, NYSE, HKEX, xStocks)
  db         Supabase migrations + RLS
  ui         Status labels, severity, formatting, copy deck
```

Each package and app has its own README with more detail. `BUILDLOG.md` at the repo root has
a dated entry for every merged change set, including contract addresses, tx hashes, and gate
results — the project's own running record of what was verified and how.

### Building and testing

```bash
pnpm install
pnpm -r test          # 192 TS tests across every package/app
cd packages/contracts && forge test   # 49 Solidity tests
```

Full env var reference is in each app's `.env.example`. Real, gitignored credentials and
access-tracking live under `internal/`, never committed.
