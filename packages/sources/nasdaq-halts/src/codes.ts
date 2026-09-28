import type { ReasonCategory } from "@winsznx/bellstate-engine";

export interface CodeInfo {
  category: ReasonCategory;
  uiText: string;
  /** Market-wide circuit breaker codes apply to every listing on the venue (§3.3 rule 2). */
  scope: "VENUE" | "ASSET";
}

/** PRD Appendix B.1, halt/pause codes. */
const HALT_CODES: Record<string, CodeInfo> = {
  T1: { category: "NEWS", uiText: "news pending", scope: "ASSET" },
  T2: { category: "NEWS", uiText: "news released", scope: "ASSET" },
  T5: { category: "VOLATILITY", uiText: "single-stock trading pause", scope: "ASSET" },
  T6: { category: "REGULATORY", uiText: "extraordinary market activity", scope: "ASSET" },
  T8: { category: "ETF", uiText: "ETF halt", scope: "ASSET" },
  T12: { category: "REGULATORY", uiText: "information requested by Nasdaq", scope: "ASSET" },
  H4: { category: "REGULATORY", uiText: "non-compliance", scope: "ASSET" },
  H9: { category: "REGULATORY", uiText: "filings not current", scope: "ASSET" },
  H10: { category: "REGULATORY", uiText: "SEC trading suspension", scope: "ASSET" },
  H11: { category: "REGULATORY", uiText: "regulatory concern", scope: "ASSET" },
  O1: { category: "OPERATIONAL", uiText: "operations halt", scope: "ASSET" },
  IPO1: { category: "IPO", uiText: "IPO not yet trading", scope: "ASSET" },
  M1: { category: "CORPORATE", uiText: "corporate action", scope: "ASSET" },
  M2: { category: "OPERATIONAL", uiText: "quotation not available", scope: "ASSET" },
  LUDP: { category: "VOLATILITY", uiText: "limit up/limit down trading pause", scope: "ASSET" },
  LUDS: { category: "VOLATILITY", uiText: "LULD pause (straddle)", scope: "ASSET" },
  M: { category: "VOLATILITY", uiText: "volatility trading pause", scope: "ASSET" },
  MWC1: { category: "MARKET_WIDE", uiText: "market-wide circuit breaker level 1 (S&P 500 −7%)", scope: "VENUE" },
  MWC2: { category: "MARKET_WIDE", uiText: "market-wide circuit breaker level 2 (−13%)", scope: "VENUE" },
  MWC3: { category: "MARKET_WIDE", uiText: "market-wide circuit breaker level 3 (−20%, closed for the day)", scope: "VENUE" },
  MWC0: { category: "MARKET_WIDE", uiText: "circuit breaker carried over", scope: "VENUE" },
  D: { category: "CORPORATE", uiText: "security deleted (ops alert raised)", scope: "ASSET" },
};

/** PRD Appendix B.1, resumption/info codes — category applies only when the halt is otherwise
 * unknown (the governing halt's own category normally wins, per §3.3). */
const RESUMPTION_CODES: Record<string, CodeInfo> = {
  T3: { category: "NEWS", uiText: "news and resumption times", scope: "ASSET" },
  T7: { category: "VOLATILITY", uiText: "single stock trading pause / quotation-only period", scope: "ASSET" },
  R1: { category: "OTHER", uiText: "new issue available", scope: "ASSET" },
  R2: { category: "OTHER", uiText: "issue available", scope: "ASSET" },
  R4: { category: "REGULATORY", uiText: "qualifications or filings resolved; trading to resume", scope: "ASSET" },
  R9: { category: "REGULATORY", uiText: "qualifications or filings resolved; trading to resume", scope: "ASSET" },
  C4: { category: "REGULATORY", uiText: "qualifications or filings resolved; trading to resume", scope: "ASSET" },
  C9: { category: "REGULATORY", uiText: "qualifications or filings resolved; trading to resume", scope: "ASSET" },
  C3: { category: "NEWS", uiText: "issuer news not forthcoming; trading to resume", scope: "ASSET" },
  C11: { category: "REGULATORY", uiText: "trade halt concluded by other regulatory authority", scope: "ASSET" },
  IPOQ: { category: "IPO", uiText: "IPO released for quotation", scope: "ASSET" },
  IPOE: { category: "IPO", uiText: "IPO positioning window extension", scope: "ASSET" },
  /** Closes any open MWC* halt rather than describing a new one — handled by the caller, not
   * classifyReasonCode. */
  MWCQ: { category: "MARKET_WIDE", uiText: "market-wide circuit breaker resumption", scope: "VENUE" },
};

/** PRD §4.1: "Unknown values are logged, never dropped." Callers should log a code that falls
 * into the OTHER fallback here. */
export function classifyReasonCode(code: string): CodeInfo {
  return HALT_CODES[code] ?? RESUMPTION_CODES[code] ?? { category: "OTHER", uiText: code, scope: "ASSET" };
}
