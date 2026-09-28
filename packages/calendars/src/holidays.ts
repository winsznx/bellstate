import type { Mic } from "./types.js";

export type Family = "US" | "KR" | "HK";

export const FAMILY_BY_MIC: Record<Mic, Family> = {
  XNAS: "US",
  XNYS: "US",
  ARCX: "US",
  XASE: "US",
  XHKG: "HK",
  XKRX: "KR",
  NXTE: "KR",
};

// PRD Appendix D. 2026 only — 2027 tables are still provisional in the PRD (gates G4/G7) and are
// deliberately not encoded here; see README.md.

export const CLOSED_DAYS: Record<Family, Set<string>> = {
  US: new Set([
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-04-03",
    "2026-05-25",
    "2026-06-19",
    "2026-07-03",
    "2026-09-07",
    "2026-11-26",
    "2026-12-25",
  ]),
  KR: new Set([
    "2026-01-01",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-03-02",
    "2026-05-01",
    "2026-05-05",
    "2026-05-25",
    "2026-06-03",
    "2026-07-17",
    "2026-08-17",
    "2026-09-24",
    "2026-09-25",
    "2026-10-05",
    "2026-10-09",
    "2026-12-25",
    "2026-12-31", // provisional until KRX's December notice (gate G4)
  ]),
  HK: new Set([
    "2026-01-01",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-04-03",
    "2026-04-06",
    "2026-04-07",
    "2026-05-01",
    "2026-05-25",
    "2026-06-19",
    "2026-07-01",
    "2026-10-01",
    "2026-10-19",
    "2026-12-25",
  ]),
};

/** Early close at 13:00 ET (US) or a published half-day (HK). KR has none in the given data. */
export const HALF_DAYS: Record<Family, Set<string>> = {
  US: new Set(["2026-11-27", "2026-12-24"]),
  KR: new Set([]),
  HK: new Set(["2026-02-16", "2026-12-24", "2026-12-31"]),
};
