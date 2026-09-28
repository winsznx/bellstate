TypeScript mirror of `packages/contracts`' policy libraries (PRD §7.4-§7.7): `HaltGatePolicy`,
`LendingPolicy`, `PrintPolicy`. Used by the replay player and anywhere else that needs the exact
same fee/liquidation/print-acceptance decisions the onchain contracts make, without an RPC call.

## Parity, not reimplementation

Each function here is a line-for-line port of its Solidity counterpart — same rule order, same
constants, same checked-arithmetic semantics (`sub64` in `util.ts` throws on underflow exactly
like Solidity 0.8.26's checked subtraction). `tests/parity.fork.test.ts` proves it: it deploys
the real compiled `PolicyLens` contract (packages/contracts' pure external wrapper over these
libraries) to a local anvil instance and compares this package's output to the live contract's
output on randomized inputs, per PRD §14.2's exact gate — **"packages/policy equals PolicyLens on
10,000 random inputs."** Run it:

```bash
RUN_FORK_TESTS=1 ITERATIONS=10000 pnpm --filter @winsznx/bellstate-policy test:fork
```

Verified at the full 10,000 iterations across all four functions (`haltGateDecide`,
`lendingCanLiquidate`, `lendingMaxLtv`, `printVerdict`/`printVerdictSecondary`): zero mismatches.
Skipped by default (`pnpm test`) since it needs `anvil` on `PATH`; `tests/print.test.ts` and
`tests/lending.test.ts` replicate the exact worked-example scenarios from
`packages/contracts/test/{PrintGuard,LendingGuard}.t.sol` as fast unit tests that need no anvil,
so a port mistake is caught immediately rather than only during the slower fork run.

## Scope of the parity guarantee

The random-input generator keeps every time value ordered (`nowTs` always at or after any
`since`/`at`/`sessionStartedAt` field) so neither side ever hits a checked-arithmetic underflow.
Solidity would revert on an out-of-order input; this package's `sub64` would throw. Both sides
agree on *that* the call fails, but the fuzz test doesn't currently assert on revert-for-revert
parity — not because it's expected to differ, but because doing so needs catching and comparing
viem's contract-revert against a thrown TS error, which wasn't worth the complexity for a case
that shouldn't be reachable through the real signer/replay pipeline (times are always attested
in the past relative to `now`).
