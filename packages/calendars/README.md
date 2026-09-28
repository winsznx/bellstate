Venue session templates and holiday calendars (PRD Appendix C/D), resolved into the
`SessionWindow` shape `packages/engine`'s `deriveMarket` consumes.

`resolveSessionWindow(mic, unixSeconds)` is a pure function of pinned table data — no wall-clock
reads beyond the `unixSeconds` argument. Bump `CALENDAR_VERSION` (`src/types.ts`) on any change to
`holidays.ts` or `templates.ts`, per §3.9: signers refuse to sign when their compiled-in version
diverges from the hub's.

## Not yet implemented

- **2027 calendars.** The PRD marks 2027 US/KR/HK holiday and half-day tables provisional
  pending official publication (gates G4/G7) — only 2026 is encoded.
- **XKRX v2** (the 16:00-20:00 continuous EXTENDED session replacing the single-price after-hours
  session, effective 2026-09-14) — only the v1 template is implemented.
- **KRX/NXTE special days** — the Jan 2 delayed-open shift and the CSAT-day shift (Appendix C.6,
  C.7) are not implemented; the regular v1 template applies on those dates too.

None of these gaps affect the XNAS/XNYS/ARCX/XASE/XHKG paths, which are fully encoded per the PRD.
