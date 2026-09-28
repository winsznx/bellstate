import { zonedTimeToUnix } from "@winsznx/bellstate-calendars";
import type { NyseHaltFilterResponse, NyseHaltRow } from "./types.js";

const NY_TZ = "America/New_York";

function parseEasternDateTime(dateStr: string | null, timeStr: string | null): number | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})/);
  // §4.2's live data has been observed to carry non-date sentinels here (e.g. "See Subsequent
  // Halt") instead of null when a halt was immediately superseded by another halt on the same
  // symbol. Treat anything that doesn't parse as no known resumption, never crash.
  if (!dateMatch || !timeMatch) return null;
  const [, yyyy, mm, dd] = dateMatch;
  const [, hh, min, ss] = timeMatch;
  return zonedTimeToUnix(Number(yyyy), Number(mm), Number(dd), Number(hh), Number(min), Number(ss), NY_TZ);
}

/** PRD §4.2. Parses one page of `historical/filter`'s response into normalized rows. */
export function parseNyseHaltFeed(json: string): NyseHaltRow[] {
  const parsed = JSON.parse(json) as NyseHaltFilterResponse;
  const rows: NyseHaltRow[] = [];

  for (const row of parsed.results) {
    const haltAt = parseEasternDateTime(row.formatedHaltDate, row.formatedHaltTime);
    if (haltAt === null) continue;
    rows.push({
      symbol: row.symbol,
      issuerName: row.issuerName,
      sourceExchange: row.sourceExchange,
      reason: row.reason,
      haltAt,
      resumeTradeAt: parseEasternDateTime(row.formatedResumptionDate, row.formatedResumptionTime),
    });
  }

  return rows;
}

export function parsedTotalCount(json: string): number {
  return (JSON.parse(json) as NyseHaltFilterResponse).totalCount;
}
