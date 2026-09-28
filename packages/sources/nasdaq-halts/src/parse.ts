import { zonedTimeToUnix } from "@winsznx/bellstate-calendars";
import type { NasdaqHaltItem } from "./types.js";

const NY_TZ = "America/New_York";

function stripWhitespace(s: string): string {
  return s.replace(/\s+/g, "");
}

function field(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<ndaq:${name}>([^<]*)</ndaq:${name}>`));
  if (!match) return null;
  const value = stripWhitespace(match[1]!);
  return value.length > 0 ? value : null;
}

/** MM/DD/YYYY + HH:MM:SS[.mmm], both possibly padded with internal whitespace (§4.1). */
function parseEasternDateTime(dateStr: string | null, timeStr: string | null): number | null {
  if (!dateStr || !timeStr) return null;
  const dateMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;
  const [, mm, dd, yyyy] = dateMatch;
  const [, hh, min, ss] = timeMatch;
  return zonedTimeToUnix(Number(yyyy), Number(mm), Number(dd), Number(hh), Number(min), Number(ss), NY_TZ);
}

/**
 * PRD §4.1. Parses a single RSS fetch into normalized items. Does not merge across fetches or
 * key by (symbol, haltAt) — that accumulation lives in the signer's UsHalts Durable Object,
 * which is the only thing that sees every poll and can tell an item disappearing from this
 * rolling-window feed from a halt actually resolving. See README.md.
 */
export function parseNasdaqHaltFeed(xml: string): NasdaqHaltItem[] {
  const items: NasdaqHaltItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of blocks) {
    const symbol = field(block, "IssueSymbol");
    const reasonCode = field(block, "ReasonCode");
    const market = field(block, "Market") ?? field(block, "Mkt");
    const haltDate = field(block, "HaltDate");
    const haltTime = field(block, "HaltTime");
    const resumptionDate = field(block, "ResumptionDate");
    const resumptionQuoteTime = field(block, "ResumptionQuoteTime");
    const resumptionTradeTime = field(block, "ResumptionTradeTime");

    const haltAt = parseEasternDateTime(haltDate, haltTime);
    if (!symbol || !reasonCode || !market || haltAt === null) continue;

    items.push({
      symbol,
      market,
      reasonCode,
      haltAt,
      resumeQuoteAt: parseEasternDateTime(resumptionDate, resumptionQuoteTime),
      resumeTradeAt: parseEasternDateTime(resumptionDate, resumptionTradeTime),
    });
  }

  return items;
}
