Pure status-derivation functions for Bellstate (PRD §3.3-3.9): `deriveMarket`, `deriveProgram`,
`derivePrimary`, `deriveValuation`. No I/O, no wall-clock reads — every function is `(subject, t,
snapshot) → State`, so the signer and CI's golden tests (§14.1) get identical bytes from identical
inputs.

## Scope

`deriveMarket` takes a pre-resolved `SessionWindow` rather than reading a venue calendar itself.
The PRD describes session state as coming "from the listing's venue calendar," but calendar
resolution (holiday tables, session templates, App. C/D) belongs to `packages/calendars` — this
keeps the engine a single-listing pure function, since the calendar's own random-end-window logic
already needs no external state. `packages/calendars` (or the signer's `Chain`/`UsHalts` DOs)
should be resolving the window and handing it in.

Cross-listing halt-source health (§3.3 rule 1's "any listing in that family is in a non-CLOSED
session") is likewise computed by the caller and passed in as `sourceHealthy`, since a single
listing can't see the rest of its venue family.

## Tests

`tests/golden.test.ts` covers the representative rows of §3.8's canonical joint-reading table,
plus the determinism property from §3.9 (identical inputs → deep-equal output).
