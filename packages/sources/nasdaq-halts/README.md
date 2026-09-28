Nasdaq Trade Halt RSS parser (PRD §4.1) — the primary US halt source.

`fetchNasdaqHaltFeed` gets the feed (current or historical), `parseNasdaqHaltFeed` normalizes it
into `NasdaqHaltItem[]`, `toHaltRecord` classifies each item's reason code (Appendix B.1) into the
engine's `HaltRecord` shape.

Fixtures in `fixtures/` are live captures, each named `<capture-date>-<current|historical>.xml`
with the exact request URL in this README:

- `2026-09-28-current.xml` — `GET https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts`
- `2026-09-25-historical.xml` — same, `&haltdate=09252026` (exercises the letter-coded `Mkt`
  field and the padded-whitespace `HaltTime` quirk §4.1 calls out)

One synthetic (non-captured, clearly labeled) XML snippet in the test file covers a still-open
halt with no resumption posted yet — the live captures above happened not to catch one.

## Scope

This package does one fetch's worth of parsing. It does **not** merge across polls: §4.1's
"the latest item for a key wins" and "T1 becomes T3 when resumption times post" both happen
because Nasdaq mutates the row in place, which a single fetch already reflects — no state
machine needed here. What *does* need cross-poll state, and belongs to the signer's `UsHalts`
Durable Object instead: noticing a halt has aged out of this feed's rolling window versus
actually resolving, and applying `MWCQ`'s "closes any open MWC* halt" rule, which references a
halt this fetch might not itself contain.
