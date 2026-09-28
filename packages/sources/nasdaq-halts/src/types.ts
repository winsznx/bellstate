import type { HaltRecord } from "@winsznx/bellstate-engine";

/** One item from the RSS feed, normalized but not yet merged into halt-key state (§4.1's
 * "latest item for a key wins" merge is the signer DO's job — see README.md). */
export interface NasdaqHaltItem {
  symbol: string;
  market: string;
  reasonCode: string;
  haltAt: number;
  resumeQuoteAt: number | null;
  resumeTradeAt: number | null;
}

export interface HaltRecordWithMeta extends HaltRecord {
  symbol: string;
  market: string;
}
