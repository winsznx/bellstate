import type { ReasonCategory } from "@winsznx/bellstate-engine";

export interface NyseReasonInfo {
  category: ReasonCategory;
  reasonCode: string;
}

/** PRD Appendix B.2. "When the matching Nasdaq item arrives, its code replaces the NYSE code" —
 * that merge is the signer's job (it sees both sources); this only classifies the NYSE string
 * on its own. */
const REASON_MAP: Record<string, NyseReasonInfo> = {
  "News Pending": { category: "NEWS", reasonCode: "N:NEWSP" },
  "News Dissemination": { category: "NEWS", reasonCode: "N:NEWSD" },
  "LULD Pause": { category: "VOLATILITY", reasonCode: "N:LULD" },
  "Corporate Action": { category: "CORPORATE", reasonCode: "N:CORP" },
  "Regulatory Concern": { category: "REGULATORY", reasonCode: "N:REG" },
};

/** PRD §4.1/B.2: unrecognized reasons classify as OTHER and should be logged, never dropped. */
export function classifyNyseReason(reason: string): NyseReasonInfo {
  return REASON_MAP[reason] ?? { category: "OTHER", reasonCode: "N:OTHER" };
}
