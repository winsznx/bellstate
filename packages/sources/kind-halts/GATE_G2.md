Findings for PRD gate G2 (§4.4, KR halt source) — not yet a working parser.

## Access (the part gate G2 asked to establish)

On 2026-09-28, a server-side fetch to KIND **succeeded** with a browser `User-Agent` and
`Referer: https://kind.krx.co.kr/investwarn/tradinghaltissue.do?method=searchTradingHaltIssueMain`
— the PRD's noted 403 (as of Sep 26, 2026) did not reproduce. Exact request that worked:

```
GET https://kind.krx.co.kr/investwarn/tradinghaltissue.do?method=searchTradingHaltIssueMain
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36
Referer: https://kind.krx.co.kr/

POST https://kind.krx.co.kr/investwarn/tradinghaltissue.do
Content-Type: application/x-www-form-urlencoded
X-Requested-With: XMLHttpRequest
Referer: <the GET URL above>
Body: method=searchTradingHaltIssueSub&currentPageSize=15&pageIndex=1&marketType=0&repIsuSrtCd=&searchCorpName=&forward=tradinghaltissue_sub
```

This access should be re-verified from an actual deployed Cloudflare Worker before relying on it
— a residential/office IP behaving differently than Workers' egress IPs is exactly the kind of
thing gate G2 exists to catch, and this was checked from a local shell, not a Worker.

## The endpoint the PRD names is the wrong one for halt events

The POST above (`tradinghaltissue.do`, the "Trading-halt issue list") returns an **administrative
watch-list**: a table of 번호 (row number), 종목명 (name, with market/관리종목/투자주의환기 icon
badges), and 사유 (reason text like "상장폐지 사유발생" — "delisting-cause event occurred"). It
has **no stock code and no halt date/time** — nothing to key `XKRX:NNNNNN` or attach a `haltAt`
to. It lists currently-flagged issues, not halt/resume events.

The PRD's §4.4 second endpoint — `POST /disclosure/details.do` with
`disclosureType02=0311` (거래정지/재개, "trading halt/resumption"), reverse-engineered by
`github.com/mijungbang/kind-krx` and not documented by KRX — is the one that actually has
per-event halt/resumption rows with codes and times. That endpoint has not been reverse-engineered
here: guessing at an undocumented POST body for a real financial protocol risks silently wrong
halt data, which is worse than no data with `interruption = UNKNOWN (SOURCE_STALE)`.

## What's needed to close gate G2 for real

1. Study `github.com/mijungbang/kind-krx`'s actual request/response shape for
   `disclosureType02=0311` (or find KIND's own disclosure-search form and reverse the request the
   same way `tradinghaltissue.do` was reversed above).
2. Capture a real response with actual halt events (code, date, time, reason) and verify it
   against a known recent KR halt.
3. Re-verify both endpoints' access from an actual deployed Worker, not a local shell.

Until then, `packages/sources/kind-halts` is not implemented, and KR `VENUE_HALTED`/
`ASSET_HALTED` should report `UNKNOWN (SOURCE_STALE)` rather than ship on the wrong endpoint.
