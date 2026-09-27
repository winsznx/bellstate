# Bellstate build log

## 2026-09-27 — repo bootstrap

- `git init -b main`, PRD moved to `internal/bellstate-prd.md` (gitignored, confirmed with `git check-ignore -v`).
- `.gitignore` covers `internal/`, `.env*` (except `.env.example`), build artifacts, key material.
- `.githooks/pre-commit` installed (`core.hooksPath .githooks`): blocks staged paths under `internal/`, blocks `.env*` files other than `.env.example`, blocks diffs containing any value from `internal/secrets/*.env`. Verified all three rejection paths manually (staged `internal/secrets/wallets.env`, attempted commit of a file embedding a real private key — both rejected).
- pnpm + Turborepo workspace scaffolded per PRD §5.2: `apps/{web,api,signer,aggregator,indexer,notifier,watch}`, `packages/{contracts,engine,calendars,sources,protocol,policy,db,sdk,ui,config}`, `design/reference/`, `scripts/{gates,seed,deploy}`, `deployments/`.
- `.env.example` written per app from PRD §8.9's "Used by" column (signer, aggregator, indexer, notifier, watch, api, web, root).
- `internal/NEEDS.md` written: 9 credential/access items the team must provide, each with where to get it and which env var it fills.

## 2026-09-27 — wallets

- Generated 10 EOAs locally with viem (`scripts/generate-wallets.ts`): `deployer`, `operator`, `submitter`, `signer-a/b/c`, `safe-owner-1/2/3`, `e2e`. Private keys written only to `internal/secrets/wallets.env` (chmod 600, gitignored, blocked from commits by the pre-commit hook). Only addresses were ever printed to terminal.
- Addresses:
  - deployer: `0xc2d695d3865cB5407be2809Edbd0c489CA842a32`
  - operator: `0xdb67D5a77D807362Aa787C67F83d692a96C132d5`
  - submitter: `0x6d90E94b559dB05226920061E4da82d3FBd5Ff7b`
  - signer-a: `0x4805E8D5B091977461Bd6d10EE8B723DF6ef0faD`
  - signer-b: `0x239c3f39039Ad891968F94E7476d9c9e2886201F`
  - signer-c: `0xA883b9dBA614e639BD4818d2Fc4ed459Eb80767b`
  - safe-owner-1: `0x0d3501Bcf50056609d885460Ba0EA11EAEF49865`
  - safe-owner-2: `0xD68BA7a3a38b51dA162BF0e29924F62bd8e3673f`
  - safe-owner-3: `0x01332B84dBfF44264C9F32924894b23c3897c00E`
  - e2e: `0xe12a7FeEE3271CAE59Bd9FA8f8A44FeB8b1dDf64`
- 2-of-3 Safe deployment is blocked on the user confirming these owner addresses (or supplying their own) and funding the deployer for gas — see funding table sent separately.

## 2026-09-27 — build gates (chain-read, no credentials required)

Run via `scripts/gates/*.ts` against X Layer mainnet (`https://rpc.xlayer.tech`) and the issuer's public catalog API.

| Gate | Result | Evidence |
|---|---|---|
| G12 | **PASS** | `eth_getCode` non-empty on PoolManager `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`, PositionManager `0xcF1EAFC6928dC385A342E7C6491d371d2871458b`, V4Quoter `0x8928074CA1b241D8Ec02815881c1Af11E8bC5219`, UniversalRouter 2.1.1 `0x8B844f885672f333Bc0042cB669255f93a4C1E6b`, Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`, Multicall3 `0xcA11bde05977b3631167028862bE2a173976CA11`. Addresses sourced from developers.uniswap.org/docs/protocols/v4/deployments ("X Layer: 196" table, cross-linked to OKLink verified contract pages) plus mds1/multicall3 README for Multicall3. |
| G13 | **PASS** | `isPaused()` on NVDAx raw (`0xc845b2894dbddd03858fd2d643b4ef725fe0849d`) → `false`; on NVDAx wrapped (`0xa8ddb5cd96b5222afe198316e9a57caa642850d5`) → `false`. Both return `bool`. |
| G16 | **PASS** | `GET https://api.xstocks.fi/api/v2/public/assets` (cursor-paginated via `?page=N`, `page.hasNextPage`), 1124 total assets across all pages. NVDAx, SKHYx, TCENTx all present. Recorded shapes: `trading.exchange` (`mic`, `abbreviation`, `name`, `timezone`), `trading.limitsPerPeriod` (`market`/`extended`/`overnight`/`closed`, each `{minOrderFiatValue, maxOrderFiatValue}`), `deployments[].stablecoins[]` (`symbol`, `currency`, `network`, `address`, `decimals`, `issuance`, `redemption`, `supportsAtomicSwaps`). |
| G17 | **PASS** | `latestRoundData()` on Chainlink L2 Sequencer Uptime feed `0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9` → `answer = 0` (sequencer up). |

Gates still blocked on credentials not yet provided (see `internal/NEEDS.md`): G1 (Chainlink Data Streams), G8/G10 (require a deployed Worker), G2/G3/G4/G5/G6/G7/G9/G11/G14/G15 (external registries, reference images, or OKX keys). These block their dependent parts only; unrelated build continues.
