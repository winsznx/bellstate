HKEXnews "Resumption / Suspension / Trading Halt" HTML-table parser (PRD §4.3) — the HK halt
source. HK has no API with exact halt times; this scrapes the predefined-document list.

Fixture: `fixtures/2026-09-28-predefineddoc.html`, captured live from
`GET https://www1.hkexnews.hk/search/predefineddoc.xhtml?predefineddocuments=9` on 2026-09-28.

## A real ordering case this fixture caught

One row's title (China Rare Earth, code 00769) reads "QUARTERLY UPDATE ON RESUMPTION PROGRESS AND
CONTINUED SUSPENSION OF TRADING" — it mentions both RESUMPTION and SUSPENSION. Per the PRD's
stated rule ordering ("RESUMPTION" checked first, "SUSPENSION" only when RESUMPTION isn't
present), this classifies as `RESUME` even though the company is, in substance, still suspended.
The live capture is what surfaced this; a hand-written fixture wouldn't have exercised the
ordering rule against a real ambiguous title.

## Two open questions, not fully specified by the PRD

- `toHaltOpens`/`toResumptions` split HALT and RESUME output rather than always returning a
  `HaltRecord`, because a RESUME announcement has no `haltAt` — it only closes a halt announced
  separately, possibly days earlier. Matching a resumption to the open halt it closes belongs to
  the signer's `HkHalts` Durable Object, the only thing that has seen every prior poll.
- §4.3 says `resumeTradeAt` is "the start of the first non-CLOSED XHKG session window at or after
  the release time," which is unambiguous when the release lands inside a CLOSED period (the
  common case — filings go out after hours). When a release lands inside an already-active
  session, this implementation returns that session's own start (in the past relative to the
  release) rather than waiting for the next window, on the reasoning that the market is already
  open. Worth confirming against the team's intent.
