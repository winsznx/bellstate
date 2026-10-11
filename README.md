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

1. Open the [Board](https://bellstate.timjosh507.workers.dev/board) to search the live xStocks issuer catalog for X Layer tokens. Issuer listings and calendar sessions are labeled separately from Bellstate status.
2. Open [NVDAx](https://bellstate.timjosh507.workers.dev/asset/NVDAx) for the deployed adapter's direct X Layer reading and indexed attestation history, or call [`GET /v1/status/NVDAx`](https://bellstate-api.timjosh507.workers.dev/v1/status/NVDAx). An `UNKNOWN` or stale response is the correct result when attestations have not been refreshed.
3. Open [Watch](https://bellstate.timjosh507.workers.dev/watch) for live public Hyperliquid xyz perp quotes. `xyz:NVDA` is mapped to the verified XNAS:NVDA listing and sampled by Bellstate Watch; flags appear only when its attested status and price rules match.
4. Try the [free Print Check preview](https://bellstate.timjosh507.workers.dev/developers/print-check) with the historical SK hynix examples, and read the [source-linked replay case study](https://bellstate.timjosh507.workers.dev/replay/jul-28-2026-sk-hynix). Both explain the evidence they do and do not use.
5. Use [Venue](https://bellstate.timjosh507.workers.dev/venue/XNAS) for live calendar calculations and the NYSE public halt feed. Public reports are labeled separately from Bellstate attestations.
6. Use [Network](https://bellstate.timjosh507.workers.dev/network) for live service reachability, onchain status freshness and submitter balance, and [Developers](https://bellstate.timjosh507.workers.dev/developers) for deployed addresses and contract reads.

### Current state

Eight core contracts are deployed on X Layer mainnet. NVDAx is registered and has 246 historical quorum-signed market updates, recovered from transaction receipts and indexed in the public database. The database also has its verified listing, program, two token records and seven venues. The API, aggregator, notifier, watch, and three signer Workers are deployed. The frontend and API are deployed on Cloudflare Workers. Replay-frame and watch-event tables are not yet populated.

The submitter wallet currently lacks enough OKB to keep publishing onchain updates. Existing signed status therefore ages into `UNKNOWN`. A receipt audit also found 524 failed submissions caused by stale sequence retries; the aggregator now prunes stale attestations and checks the chain sequence before sending. The issuer catalog, calendar calculations, public halt feed, public perp quotes, guard reads, and offchain Print Check preview remain usable without new onchain transactions. These sources do not substitute for signed attestation.

Chainlink Data Streams valuation is disabled. Both the original and regenerated local credential pairs failed the mainnet API with HTTP 401 (the latest response was `user does not exist`); account activation and feed entitlement remain unverified. Chainlink's documented feed subscriptions are paid. No valuation stream is designated, so no valuation status is advertised.

The owner role is still a single EOA rather than the PRD's 2-of-3 Safe. Paid x402 settlement, live Bellstate Watch flags, alerts backed by actual status events, and a frame-by-frame signed replay remain unfinished. The historical replay page is a sourced case study, not an attested replay. Watch samples NVDA but will not raise a flag from an expired market attestation.

### Repo layout

```
apps/
  web        Next.js 15 frontend (deployed)
  api        Hono backend on Cloudflare Workers (deployed)
  signer     Halt/session state machines, EIP-712 signing (three Workers deployed)
  indexer    Hub event decoding and verified recovery scripts (continuous worker not yet deployed)
  aggregator Fan-in for signer submissions (deployed)
  notifier   Alert delivery — Telegram, webhooks (deployed)
  watch      Oracle Watch monitoring Worker (deployed)
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
pnpm -r test
cd packages/contracts && forge test
```

Full env var reference is in each app's `.env.example`. Real, gitignored credentials and
access-tracking live under `internal/`, never committed.
