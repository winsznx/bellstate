import { zonedTimeToUnix } from "@winsznx/bellstate-calendars";
import type { HkexAnnouncement } from "./types.js";

const HK_TZ = "Asia/Hong_Kong";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#x3b;/gi, ";")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** PRD §4.3: "case-insensitive on the document title." RESUMPTION wins if present, even when
 * the title also mentions a continued suspension (a real capture had exactly this: a title
 * announcing both a resumption-progress update and a continued suspension of a different
 * matter — RESUMPTION still takes precedence per the PRD's stated rule ordering). */
function classify(title: string): HkexAnnouncement["classification"] {
  const upper = title.toUpperCase();
  if (upper.includes("RESUMPTION")) return "RESUME";
  if (upper.includes("TRADING HALT") || upper.includes("SUSPENSION")) return "HALT";
  return "OTHER";
}

/** PRD §4.3. Parses the HKEXnews "Resumption / Suspension / Trading Halt" predefined-document
 * list (an HTML table, not an API) into normalized announcements. */
export function parseHkexAnnouncements(html: string): HkexAnnouncement[] {
  const results: HkexAnnouncement[] = [];
  const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];

  for (const row of rows) {
    const releaseMatch = row.match(/Release Time:\s*<\/span>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    const codeMatch = row.match(/Stock Code:\s*<\/span>\s*([0-9,\s/]+)/);
    const nameMatch = row.match(/Stock Short Name:\s*<\/span>\s*([^<]*)</);
    const linkMatch = row.match(/<a [^>]*>([\s\S]*?)<\/a>/);

    if (!releaseMatch || !codeMatch || !linkMatch) continue;

    const [, dd, mm, yyyy, hh, min] = releaseMatch;
    const releaseAt = zonedTimeToUnix(Number(yyyy), Number(mm), Number(dd), Number(hh), Number(min), 0, HK_TZ);

    // "A row can list several codes" (§4.3) — split on any non-digit separator.
    const stockCodes = codeMatch[1]!.split(/[^0-9]+/).filter(Boolean);
    const documentTitle = stripTags(linkMatch[1]!);

    results.push({
      releaseAt,
      stockCodes,
      stockShortName: (nameMatch?.[1] ?? "").trim(),
      documentTitle,
      classification: classify(documentTitle),
    });
  }

  return results;
}
