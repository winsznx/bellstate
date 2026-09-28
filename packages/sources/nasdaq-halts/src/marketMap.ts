/** PRD §4.1: historical responses use single-letter <ndaq:Mkt> codes. Display only — the halt
 * itself always keys by symbol, not by venue. */
export const MARKET_LETTER_TO_MIC: Record<string, string> = {
  N: "XNYS",
  P: "ARCX",
  A: "XASE",
  Z: "BATS",
  V: "IEXG",
  Q: "XNAS", // inferred; Nasdaq's own legend omits it
};

/** Current-feed <ndaq:Market> uses names directly; pass them through, mapping the ones with a
 * different MIC spelling. */
export const MARKET_NAME_TO_MIC: Record<string, string> = {
  NASDAQ: "XNAS",
  NYSE: "XNYS",
};

export function marketToMic(raw: string): string {
  return MARKET_LETTER_TO_MIC[raw] ?? MARKET_NAME_TO_MIC[raw] ?? raw;
}
