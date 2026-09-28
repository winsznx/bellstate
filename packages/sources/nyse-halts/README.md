NYSE trade halts JSON parser (PRD §4.2) — the corroborating US halt source.

`fetchNysePage` gets one page of `historical/filter` (never `/api/trade-halts/current` — the PRD
notes it omitted halts that `historical/filter` showed as still open on 2026-09-26).
`parseNyseHaltFeed` normalizes rows, `toHaltRecord` classifies each row's `reason` string
(Appendix B.2) into the engine's `HaltRecord` shape.

Fixture: `fixtures/2026-09-28-historical-filter.json`, captured live from
`GET https://www.nyse.com/api/trade-halts/historical/filter?haltDateFrom=2026-09-01&haltDateTo=2026-09-28&pageNumber=1`
on 2026-09-28.

## A real quirk this fixture caught

Some rows carry `"formatedResumptionDate": "See Subsequent Halt"` — a non-date sentinel string,
not `null` and not a parseable date, for a symbol (`SBXD`/`SBXD WS`/`SBXD U`) that was
immediately re-halted under a different reason. `parseEasternDateTime` treats anything that
doesn't match `YYYY-MM-DD` as "no known resumption" rather than throwing — this isn't documented
anywhere in the PRD or the NYSE API; the live capture is what caught it.

## Scope

Same as `packages/sources/nasdaq-halts`: this parses one page. Merging NYSE and Nasdaq halt keys
("Nasdaq's ReasonCode wins for reasonCode. NYSE fills a missing resumption," §4.2) and paging
through `historical/filter`'s 20-rows-per-page results are the signer's job.
