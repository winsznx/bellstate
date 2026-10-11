# Aggregator Worker (PRD §6.5, §8.2)

Cloudflare Worker that takes signed attestations from signers, holds them in a Durable Object
until they reach quorum, and submits them to BellstateHub on X Layer mainnet as one batched
`submitBatch` transaction per tick.

## What's here

- `src/worker.ts`. Hono app: `POST /v1/attestations` (verify, check the signer is active, store
  in the DO, record to Supabase) and `GET /health`. Exports the `AttestationStore` Durable Object
  class so wrangler can bind it.
- `src/attestationStore.ts`. The `AttestationStore` Durable Object (bound as
  `ATTESTATION_STORE`, backed by SQLite per wrangler.jsonc). Stores attestations keyed by
  `(digest, signer)`, owns the submitter EOA's nonce, and runs the 1-second alarm that builds and
  sends the batch transaction, including the 10-second fee-bump replacement.
- `src/quorum.ts`. `selectQuorumBatch`, a pure function with no network or DO dependency: groups
  stored attestations by digest, keeps only digests with at least `quorum` distinct signers, then
  keeps only the highest seq (or epoch, for Heartbeat) per `(kind, subject)`. Unit-tested in
  `tests/quorum.test.ts`.
- `src/attestation.ts`. Wire-format types and runtime validation for the five EIP-712 message
  shapes, kind/subject/seq/epoch helpers, and the digest computation that ties a `POST` body to
  `packages/protocol`'s EIP-712 hashing.
- `src/hubAbi.ts`. The BellstateHub ABI fragments this app calls, hand-written to match
  `packages/contracts/src/BellstateHub.sol` and `BellstateTypes.sol` field-for-field.

The 2026-10-11 chain audit recovered 524 `SubmissionFailed(StaleSeq)` events. The DO now
checks `marketView.seq` before submitting a market update, prunes already committed digests
after a successful batch, and drops stale digests after a `StaleSeq` failure. This prevents
the retry loop from spending gas on old signed messages when the submitter is funded again.
- `src/chain.ts`. The X Layer chain object (id 196, OKB, matching `apps/web/app/_lib/chains.ts`
  and `Deploy.s.sol`) and the public/wallet client builders, using `XLAYER_RPC_URLS` as a viem
  fallback transport.
- `src/hubReads.ts`. Sixty-second, per-isolate caches for `isSigner(address)` and `quorum()`
  reads, so intake doesn't hit the RPC on every request.
- `src/rateLimiter.ts`. The per-source-IP request limiter for intake.
- `src/supabaseRecords.ts`. Real Supabase writes to `attestations` and `submissions`, plus a
  funding-alert helper into `ops_audit` (see "Deferred" below).

## Request flow

1. `POST /v1/attestations` with `{kind, message, signature}`. `kind` is one of the five EIP-712
   primaryType names; `message` is that type's fields with every `bigint` sent as a decimal
   string (JSON has no bigint).
2. The worker rebuilds the EIP-712 domain and digest with `packages/protocol`, recovers the
   signer from the signature, and checks `isSigner(signer)` on the live hub (60-second cache).
   An inactive or unrecoverable signer gets a 400, never a stored row.
3. The validated attestation goes to the `AttestationStore` DO (`ingest`) and, best-effort, to
   Supabase's `attestations` table.
4. Every second, the DO's alarm first runs `throttleHeartbeats` (§6.4: "at most one heartbeat per
   domain per 60 s") over everything not yet attached to a submission: a Heartbeat digest changes
   every epoch (15s) even when nothing in the domain changed, so without this a heartbeat would
   get submitted roughly every 15s per domain, forever — a real, unbounded gas cost, not a
   theoretical one (found and fixed after a direct question about it: submitter funding at the
   time would have run dry in hours at that rate). It keeps only the highest-epoch heartbeat
   digest per domain (deleting older, superseded ones immediately so the table doesn't grow one
   row per domain per epoch), and only lets that digest through once 60s have passed since the
   last time a heartbeat for that domain was actually submitted — tracked in the DO's own
   `heartbeat_submissions` table, not just attested. The surviving rows then go through
   `selectQuorumBatch`; anything that clears quorum gets grouped by facet (Market/Program/Primary/
   Valuation/Heartbeat) into up to five `submit*Updates` calls, wrapped in one `submitBatch`.
5. Fees follow the PRD exactly: `maxFeePerGas = 2 * baseFee + priorityFee`, `priorityFee = 0.001
   gwei`. The nonce is read from chain once and then owned by the DO. If a submission isn't
   mined within 10 seconds, the next tick replaces it at the same nonce with both fees bumped
   20%.
6. Once a submission's receipt lands: on a whole-tx revert (rare — the outer `submitBatch` call
   itself failing, e.g. out of gas or a frozen hub), every attestation is freed for retry. On a
   successful receipt, the DO decodes any `SubmissionFailed(index, reason)` events from the
   logs — since `submitBatch`'s per-call `try`/`catch` means the outer tx can succeed while one
   specific facet call inside it reverted — and only deletes attestations for facet kinds that
   actually landed; rows for a kind that failed are freed for retry, and the reason (decoded
   against BellstateHub's own custom errors where possible) is logged and written to the
   submission's `error` column.

## Deferred, and why

- **Cross-edge-exact rate limiting.** `rateLimiter.ts` is a real, working 50 req/s-per-IP limiter,
  but it counts per warm isolate, not globally across Cloudflare's edge. Cloudflare's native Rate
  Limiting binding would give an exact count, but wiring it in means adding a `ratelimits` entry
  and provisioning its namespace, a binding-surface change outside this pass's "work only inside
  apps/aggregator, code only, no deploys" scope. Left as a follow-up once that binding exists.
- **Funding alert delivery.** The PRD's ops alert and `/network` banner are delivered by
  apps/notifier and rendered by apps/web. Reaching either needs a queue producer binding this
  app's wrangler.jsonc doesn't declare. `checkFunding` in `attestationStore.ts` does the real
  part, a live `getBalance` check against the two thresholds every 60 seconds, and records the
  result into Supabase's `ops_audit` table so it's queryable, but doesn't push it anywhere else.
- **No re-check of signer activity at submission time.** The PRD only asks for the 60-second
  cache at intake, so a signer revoked between intake and batching isn't re-verified. If that
  causes a facet call to actually revert onchain (e.g. `QuorumNotMet`), the fix below still
  catches it — the affected attestations are freed for retry, not silently lost — so this can
  only ever add latency, never lose data or corrupt state.
- **Per-call `SubmissionFailed` decoding is used for attestation bookkeeping, not yet persisted
  for the indexer.** The DO decodes `SubmissionFailed(index, reason)` events itself (see "Request
  flow" step 6) to correctly free failed-kind attestations instead of deleting them — this was a
  real bug in an earlier version of this file (a successful outer-tx receipt was being read as
  proof every inner call succeeded, silently discarding attestations for a facet call that
  actually reverted). What's still deferred is writing the decoded per-call outcome anywhere the
  indexer could join it for latency computation (per §8.2, that's apps/indexer's job) — this app
  only logs it and appends a summary to `submissions.error`.

## Environment variables

See `.env.example`. All five were already declared before this pass; none were added.

| Variable | Used for |
|---|---|
| `SUBMITTER_PRIVATE_KEY` | The EOA that signs and sends `submitBatch` transactions. |
| `XLAYER_RPC_URLS` | Comma-separated X Layer RPC endpoints, used as a viem fallback transport. |
| `HUB_ADDRESS` | BellstateHub's deployed address (mainnet: `0x714bF088613729949A2dA92709e25c1Af95c1B1B`). |
| `SUPABASE_URL` | Project URL for the `attestations`/`submissions`/`ops_audit` writes. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for those writes. |

## Testing

```bash
npx tsc --noEmit   # clean
npx vitest run     # tests/quorum.test.ts, 8 tests, pure, no network or DO required
```

`quorum.test.ts` covers: below-quorum rows get dropped, quorum reached with signers sorted
ascending, a duplicate signer doesn't double-count, a higher-seq digest supersedes a lower one
even when the lower one individually has more signers, independent `(kind, subject)` pairs batch
separately, Heartbeat orders by epoch instead of seq (it has no seq field), and an empty input
returns an empty batch.

The DO's alarm/submission path and the worker's intake route aren't covered by an automated
integration test in this pass, since exercising them for real means either mocking the exact
things this task said not to fake (the hub's view calls, `submitBatch`) or actually sending a
transaction on X Layer mainnet, which "no wrangler deploy, code only" also rules out here.
`apps/signer/scripts/submit-market-update.ts` is the existing real, mainnet-verified proof that
the signer -> quorum -> hub path this code implements actually works end to end.
