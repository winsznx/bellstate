import { classifyNyseReason } from "./codes.js";
import type { HaltRecordWithMeta, NyseHaltRow } from "./types.js";

export function toHaltRecord(row: NyseHaltRow): HaltRecordWithMeta {
  const info = classifyNyseReason(row.reason);
  return {
    symbol: row.symbol,
    sourceExchange: row.sourceExchange,
    scope: "ASSET",
    haltAt: row.haltAt,
    resumeTradeAt: row.resumeTradeAt,
    reasonCategory: info.category,
    reasonCode: info.reasonCode,
  };
}
