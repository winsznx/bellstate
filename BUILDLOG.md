# Bellstate build log

## 2026-09-28 — Remaining 14 screens complete the PRD §11 route inventory (S05-S18)

- Every screen in the PRD's route table now exists and returns 200. Restructured under `app/(site)` so global header/footer apply everywhere except `/embed/[symbol]` (must stay a bare iframe per §17) — verified directly.
- Genuinely real pieces: S15 Method's observability matrix is the PRD's own facts; S09 Replay player's venue panel is computed live from packages/calendars at each replay's real historical timestamp (verified /replay/jul-28-skhynix reproduces the PRD's own Jul 28 worked example exactly); S10 Developers' EIP-712 field lists come straight from packages/protocol.
- Everything gated on missing infra (swaps, x402, SIWE, ops actions, live network health) renders the PRD's own specified not-connected/no-pool/403 states rather than guessed interactive UI.
- Full workspace: 182 tests passing (unchanged, page composition only). This closes out the entire frontend route inventory — everything left across the whole project now needs either credentials (Cloudflare, Chainlink, KIND, Supabase) or a funded/deployed contract, both tracked in `internal/NEEDS.md`.

## 2026-09-28 — S04 Event screen with real EIP-712 signature recovery (§11.5)

- Header/diff, latency waterfall, evidence and share regions built. Evidence is genuinely cryptographic: the fixture signs a real MarketUpdate with packages/protocol at request time and recovers the signers — verified two distinct real addresses recovered correctly by fetching the page directly, not asserted internally.
- Found and fixed a real duplicate-viem-instance type clash between apps/web's locally-pinned TS 5.7 (for Next's benefit) and the workspace's TS 7 — fixed by routing all viem usage through packages/protocol instead of importing viem directly in apps/web.
- Full workspace: 182 tests passing.

## 2026-09-28 — S03 Venue screen with real calendar computation (§11.5)

- `packages/calendars` gained `dayWindows`/`upcomingSpecialDays` — the first screen where session/transition/special-days data is computed *live* from the calendars package rather than fixture data.
- Verified against the real clock at build time: XNAS correctly showed REGULAR with the "now" marker at 52.4% through the day, special days correctly found Thanksgiving 2026 as nearest upcoming closure.
- Full workspace: 182 tests passing.

## 2026-09-28 — S02 Asset screen (§11.5)

- Identity, status hero (market sentence + 4 facet cards), home market region for ADS programs, "Not provided"/unknown-symbol states — against a documented fixture.
- Verified for real: built, started, fetched /asset/NVDAx, /asset/SKHYx and /asset/DOESNOTEXIST directly — correct content and addresses on the real ones, a genuine 404 on the unknown one.
- Timeline, halt history, guards panel, pools, integrate/subscribe regions need a live indexer/adapter, not built — noted on the page itself.

## 2026-09-28 — First frontend work: design tokens + Board screen (§11)

- `packages/ui`: status labels (§11.3), severity ordering, formatting, and the §11.4 copy-deck sentence templates — the "data, states and flows" layer gate G15 permits building without screen mockups. 24 tests matching the PRD's own worked examples.
- Design tokens: no Bellstate screen mockups exist yet, but a real owned design system from a separate product (Closure Ledger) was adopted as the base palette/type/geometry, with a new Bellstate-specific semantic color mapping reasoned out per-token in `design/tokens.md`.
- `apps/web`: Next.js scaffold wired to those tokens, first real screen (S01 Board) built against a documented fixture. Verified for real — built, started, HTML fetched, confirmed real content and compiled CSS.
- Found and fixed a real toolchain issue: Next.js 15 doesn't support TypeScript 7 (used everywhere else in this workspace) for its build-time typecheck/lint. Disabled Next's redundant internal passes, pinned TS 5.7 locally for apps/web's own tooling; real typechecking still runs separately against the workspace's TS 7.
- Full workspace: 165 tests passing.

## 2026-09-28 — apps/indexer: hub event decoding + domain-event derivation (§8.3)

- `decodeHubLog`/`deriveDomainEvents`/`rows.ts`: decode real hub events into `status.*.changed`/`halt.opened`/`halt.resumed` domain events and `status_history`/`status_current` row shapes.
- Verified against a real deployed contract: `tests/decode.fork.test.ts` deploys the actual compiled `BellstateHub` to a local anvil, submits a genuinely quorum-signed `MarketUpdate` via `packages/protocol`'s real EIP-712 signing, decodes the real emitted log — including a real halt transition proving `halt.opened`/`halt.resumed` against actual event data.
- Full workspace: 141 tests passing.

## 2026-09-28 — packages/policy: TS mirror of the Solidity policy libraries (§7.4-7.7), verified against real PolicyLens

- Line-for-line TS ports of `HaltGatePolicy`, `LendingPolicy`, `PrintPolicy`.
- Verified against the real thing: deployed the actual compiled `PolicyLens` to a local anvil, ran the PRD's exact gate ("packages/policy equals PolicyLens on 10,000 random inputs") at the full 10,000 iterations across all four functions. Zero mismatches.
- Fast unit tests replicate the exact worked-example scenarios from `packages/contracts`' own Foundry tests (including the SK hynix Jul 28 08:00:02 KST case) so a port mistake surfaces in milliseconds, not the ~100s fork run.
- Full workspace: 134 tests passing (10 fork-gated tests skipped by default, need `anvil` on PATH).

## 2026-09-28 — apps/signer: Core tick + UsHalts/HkHalts domain logic (§8.1)

- `core/tick.ts`: the Core DO's tick steps 2-5, pure — runs all four `derive*` functions per subject, diffs against onchain state, builds signed-update messages at `seq = onchain + 1`, produces a heartbeat for every domain with zero diffs.
- `domains/usHalts.ts` / `domains/hkHalts.ts`: the cross-poll halt-merge state the source parser packages explicitly scoped out of themselves — Nasdaq-wins/NYSE-fills-resumption/MWCQ-closes-everything for US, RESUME-matches-most-recent-open-halt for HK. Integration-tested against real captured fixtures merged together.
- Actual DO classes, `wrangler.jsonc`, signing, and KrHalts/Issuer/Valuation/Chain remain unbuilt — blocked on Cloudflare login, KIND gate G2, a deployed hub, and Chainlink Data Streams credentials respectively. Documented in `apps/signer/README.md`.
- Full workspace: 123 tests passing.

## 2026-09-28 — packages/sources: HKEXnews, xStocks, KIND gate-G2 findings (§4.3-4.5)

- hkex-halts: scrapes the HTML predefined-document list (HK has no halt API). Caught a real ordering case in a live capture — one row's title mentions both RESUMPTION and a continued SUSPENSION (China Rare Earth, 00769); the PRD's stated rule ordering classifies it RESUME.
- xstocks: full catalog/oracle client. Caught a real field-naming mismatch — `limitsPerPeriod` entries are `{minOrderFiatValue, maxOrderFiatValue}` in the live API, not the `{max}` shorthand the PRD's prose implies. NVDAx's XLayer addresses and Chainlink oracle metadata confirmed byte-for-byte against §3.6's worked example.
- kind-halts: **not implemented.** Verified KIND access now works (the PRD's Sep 26 403 didn't reproduce), but the endpoint the PRD names (`tradinghaltissue.do`) turned out to be an administrative watch-list with no stock code or halt timestamp — not the halt-event data needed. The real data lives behind an undocumented, third-party-reverse-engineered endpoint (`disclosure/details.do`) not implemented here rather than guessed at. Findings recorded in `packages/sources/kind-halts/GATE_G2.md`.
- Full workspace: 107 tests passing (6 db tests correctly skipped, no `TEST_DATABASE_URL`).

## 2026-09-28 — packages/sources: Nasdaq + NYSE halt parsers (§4.1-4.2)

- Both tested against live-captured fixtures (not hand-written), per §4's own requirement.
- nasdaq-halts: handles the historical feed's letter Mkt codes and padded-whitespace HaltTime quirk the PRD calls out, verified against a real `&haltdate=09252026` capture. Full Appendix B.1 code classification.
- nyse-halts: found a real quirk the PRD doesn't mention — some rows carry `"See Subsequent Halt"` (a non-date sentinel, not null) in `formatedResumptionDate` for a symbol re-halted immediately under a different reason. Handled, not crashed on.
- Both scoped to one fetch's parsing only — cross-poll state (key merging, feed-window aging, MWCQ closing a carried-over halt) is the signer's `UsHalts` DO's job, documented as not-yet-built in each README.
- Added `packages/sources/*` to the pnpm workspace glob (the PRD's two-levels-deep `packages/sources/<source>` layout wasn't covered by the existing `packages/*` pattern).
- 17 new tests. Full workspace now 90/90 passing.

## 2026-09-28 — packages/protocol: EIP-712 signing/verification (§6)

- MarketUpdate/ProgramUpdate/PrimaryUpdate/ValuationUpdate/Heartbeat EIP-712 types + Bellstate domain, pinned to §6.2 so digests match `packages/contracts`' `BellstateHub` byte-for-byte. Enum-to-uint8 mappings reuse `packages/engine`'s ordered arrays via a workspace dependency instead of duplicating them.
- Two PRD gaps flagged in README: `sourceMarketStatus`'s enum ordering isn't specified anywhere (assumed UNKNOWN=0/OPEN=1/CLOSED=2 by convention), and `PrimaryUpdate`'s single `primaryReason` for two legs needs a tie-break the PRD doesn't give (issuance wins unless NONE).
- 10 tests: sign/recover roundtrip, digest determinism, reasonCode round-trips (including the "NONE" -> zero-bytes8 sentinel), epoch boundaries, signature sorting + duplicate rejection. `tsc --noEmit` clean.
- Switched from ad hoc `npm install` per package to a real `pnpm install` at the repo root now that a package (protocol) needs a workspace dependency (engine) — this is how the rest of the monorepo should be installed going forward.

## 2026-09-28 — packages/calendars: Appendix C/D session templates and holidays

- `resolveSessionWindow(mic, t)`: pure, Intl.DateTimeFormat-based tz conversion (no external tz dependency), full XNAS/XNYS/ARCX/XASE/XHKG coverage, XKRX/NXTE v1 (pre-2026-09-14) only.
- Multi-day CLOSED runs walk the holiday table backward/forward to find the true session boundary (a Saturday abutting a Friday close gets Friday's actual after-hours end as `sessionSince`, not an arbitrary midnight).
- Not implemented, documented in README: 2027 calendars (provisional in the PRD), XKRX v2, KRX/NXTE Jan 2/CSAT shifts.
- 11 tests incl. the PRD's Jul 28 NXTE-vs-XKRX divergence case. `packages/engine`'s `deriveMarket` can now take a real `SessionWindow` from here instead of a stub.

## 2026-09-28 — packages/engine: status-derivation pure functions (§3.3-3.6)

- `deriveMarket`, `deriveProgram`, `derivePrimary`, `deriveValuation` — pure, no I/O, matching the PRD's first-match-wins precedence rules exactly (SOURCE_STALE > VENUE_HALTED > ASSET_HALTED > NONE for market interruption; NO_TRADING_OBJECT > ISSUER_TRADING_HALTED > XLAYER_LEG_DISABLED > PERIOD_CLOSED > PERIOD_LIMITED > ACCEPTING per primary leg; etc).
- Enum orderings in `types.ts` match ERC-8392 Appendix A and the Bellstate extension Appendix B.4 exactly (UNKNOWN = 0 first), lining up 1:1 with `packages/contracts`' `BellstateTypes.sol`.
- Scoping decision: `deriveMarket` takes a pre-resolved `SessionWindow` rather than reading a venue calendar itself, keeping the engine a single-listing pure function; calendar resolution belongs to `packages/calendars` (not yet built). Documented in `packages/engine/README.md`.
- 26 golden tests covering representative §3.8 canonical-joint-reading rows (Saturday close, pre-market, T1 news halt, LULD pause, MWCB beating a concurrent asset halt, HKEX random-end window, stale halt source, halt carrying across a close) plus the §3.9 determinism property. `tsc --noEmit` clean, all tests pass.
- Next per deployment order (§15.2): `packages/calendars` (venue session templates + holiday tables, App. C/D) — `deriveMarket` needs it to get a real `SessionWindow` instead of a caller-supplied stub.

## 2026-09-27 — Supabase schema, RLS, realtime, retention (§9)

- 4 migrations in `packages/db`: full 26-table schema (§9.1) with `hex32`/`hex_address` domains enforcing the PRD's id/address regex shapes at the DB level, RLS per §9.2, realtime publication per §9.3, daily `pg_cron` retention per §9.4.
- Validated by hand against a disposable `postgres:16` container: schema + RLS apply cleanly; simulated `anon` role confirms `venues` readable, `subscriptions`/`attestations`/`ops_audit` blocked even with rows present, all writes rejected, `replays` correctly filtered to `published = true`. Codified as `packages/db/tests/rls.test.ts`.
- Docker daemon hung mid-pull of the `supabase/postgres` image (needed for local `pg_cron` testing, since plain `postgres` lacks the extension) and had to be restarted; the retention migration itself is standard `pg_cron` syntax and will be validated against the real Supabase project once credentials land.
- Still blocked on `SUPABASE_URL`/keys (see `internal/NEEDS.md`) to actually push these migrations to a live project.

## 2026-09-27 — MicLib fix + fork tests pass against real X Layer mainnet state

- Added `MicLib` and fixed a real correctness bug: `registerListing` was hashing `keccak256(abi.encode(mic, symbol))` instead of the PRD-specified `keccak256(utf8("<MIC>:<SYMBOL>"))` (§2.3) — a completely different digest that would have broken every offchain-to-onchain listing ID lookup (API, indexer). 4 new tests lock the formula against the PRD's own examples.
- Added a fork test suite (`test/fork/HaltGateHookFork.t.sol`) run against real X Layer mainnet via `--fork-url https://rpc.xlayer.tech`, per PRD §14.2: full stack deployed, real wNVDAx and USDT0 balances, real `PoolManager`, real sequencer feed. 5/5 pass: pool registration on init, a real swap in REGULAR mode, a swap reverting during an attested halt, LendingGuard against the live sequencer feed, and — the core guarantee — liquidity removed successfully during a halt.
- **Real integration bug found only by testing against live mainnet state, not mocks:** the deployed USDT0 proxy on X Layer rejects `transferFrom` with "exceeds allowance" even when the PoolManager itself holds a `type(uint256).max` approval — Uniswap v4's documented settlement path. It only works if the calling router is *also* approved directly. This is exactly the class of bug "no mocks, fork tests before any mainnet tx that moves value" exists to catch — it would have silently blocked every real swap or liquidity call against a live NVDAx/USDT0 pool.
- Local suite: 49 passing + 1 clean skip (fork test, when run without `--fork-url`).

## 2026-09-27 — full §7.1 contract set complete (local, pre-deploy)

- Added `LendingGuard`/`LendingPolicy` (§7.5), `PrintGuard`/`PrintPolicy` (§7.6), `PolicyLens` (§7.7), plus the minimal `IAggregatorV3` interface for the L2 sequencer feed.
- 45/45 tests pass across the whole `packages/contracts` suite (`forge test`), including a 256-run fuzz check that `PolicyLens` matches its underlying policy libraries call-for-call, and the PRD's own SK hynix Jul 28 08:00:02 KST worked example (§7.6) reproduced exactly: NXTE `EXTENDED` + `FIRST_MINUTE`, XKRX `CLOSED` → `REJECT`.
- **Real bug found and fixed before touching mainnet:** `LendingPolicy.canLiquidate` let the `HALT_ONLY` profile fall through to *allow* liquidation during an attested `ASSET_HALTED`/`VENUE_HALTED` market — the PRD table excludes halted markets from all three profiles, not just STRICT/EXTENDED. Caught by `test_canLiquidate_haltOnly_blocksOnHalt`.
- Every contract in PRD §7.1's table now exists and compiles: `BellstateHub`, `StatusAdapter`, `AdapterFactory`, `HaltGateHook`, `HookDeployer`, `LendingGuard`, `PrintGuard`, `PolicyLens`, plus all libraries (`BellstateTypes`, `StatusLib`, `HaltGatePolicy`, `LendingPolicy`, `PrintPolicy`) and interfaces (the four verbatim ERC-8392 interfaces, `IBellstateStatus`, `IBellstateHub`, `IAggregatorV3`).
- **Not yet done, and required before any mainnet deploy:** fork tests against real X Layer state (PRD §14.2 guarantees — liquidity removal never blocked, pool never stuck longer than `maxAge + degradeAfter`), `MicLib`, deploy scripts (`scripts/deploy/`), and the actual `BellstateHub` deployment + Safe setup, which needs funded `deployer`/`operator`/`submitter` wallets (blocked on user funding, per §1) and Chainlink Data Streams credentials for gate G1 before the valuation facet can go live.

## 2026-09-27 — BellstateHub (contracts)

- Foundry package scaffolded at `packages/contracts` (Solidity 0.8.26, `evm_version = cancun`, `via_ir = true` — required, see below). Dependencies (OpenZeppelin v5.1.0, Uniswap v4-core 1.0.2, v4-periphery 1.0.4, forge-std) installed via `forge install --no-git` and gitignored (87 MB); `setup.sh` reinstalls the pinned versions.
- Implemented per PRD §7.2/§6: `BellstateTypes` (packed structs + EIP-712 payloads + effective views), `StatusLib` (§6.6 staleness and transition-expiry rules), the four verbatim ERC-8392 interfaces + `IBellstateStatus` (App. A), `IBellstateHub`, and `BellstateHub` itself — EIP-712 quorum-signed submission for market/program/primary/valuation updates and heartbeats, 32-entry ring-buffer transition history per listing, domain heartbeats and `effectiveAsOf`, freeze/unfreeze, signer rotation, operator role via OZ `AccessControl` (owner = `DEFAULT_ADMIN_ROLE`, meant to be the Safe).
- **Spec bug found and fixed:** PRD §7.2 lists both `event Frozen(uint64 until)` and `error Frozen(uint64)` — identical Solidity identifiers in one contract don't compile (`Error (2333): Identifier already declared`). Renamed the error to `HubFrozen`, kept the event name as specified. Flagging for the team in case the PRD should be corrected upstream.
- **Compiler note:** `_applyMarketUpdate`'s EIP-712 digest hashing hit "stack too deep" under the default codegen (13+ locals in one struct hash). Enabled `via_ir = true` in `foundry.toml` to resolve it, rather than restructuring the (spec-mandated) struct fields.
- 8/8 tests pass (`forge test --match-contract BellstateHubTest`): quorum-signed update acceptance, `StaleSeq` rejection, `QuorumNotMet` rejection, staleness-to-`UNKNOWN` aging after `maxAge`, `freeze()` blocking submission with `HubFrozen`, operator-only registration access control, transition history append.
- Not yet built: `StatusAdapter`/`AdapterFactory`, `HaltGateHook`, `LendingGuard`, `PrintGuard`, `PolicyLens`, deploy scripts. Continuing per PRD §7.1 contract set next.

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
