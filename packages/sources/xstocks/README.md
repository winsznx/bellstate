xStocks public API client (PRD §4.5) — issuer catalog, trading periods and valuation-stream
metadata. No auth.

Fixtures captured live from `https://api.xstocks.fi/api/v2` on 2026-09-28: a paginated catalog
page (`pageSize=3`, a real response trimmed at the source via the query param, not edited after
the fact), NVDAx's single-asset detail, and NVDAx's oracle metadata across every network xStocks
tracks for it.

## A real field-naming mismatch this fixture caught

The PRD's prose describes `limitsPerPeriod[currentPeriod].max`, but the real API's period objects
are `{ minOrderFiatValue, maxOrderFiatValue }` — no field named `max`. `toPrimaryCatalogView`
does the rename when adapting into `packages/engine`'s `PrimaryCatalogView`, which is intentionally
source-agnostic and keeps the PRD's `max` shorthand; the real field name only exists at this
boundary. Confirmed against a live NVDAx capture, not assumed from the PRD's prose.

## Also confirmed against real data

- NVDAx's XLayer deployment addresses match exactly what `BUILDLOG.md` recorded from the
  contracts work: raw `0xc845…849d`, wrapped `0xa8ddb…850d5`.
- NVDAx's XLayer Chainlink oracle: feed ID `0x000a37a5…0918a`, verifier
  `0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7`, schema `v10` — matches §3.6's worked example
  exactly.
- `/public/oracles/{symbol}` returns every network's feed for that symbol, Chainlink and Pyth
  alike, un-filtered — callers must filter to `network === "XLayer" && managedBy === "Chainlink"`
  themselves; a naive "first result" read would silently grab a Pyth feed on the wrong chain.
