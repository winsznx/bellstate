import { classifyReasonCode } from "./codes.js";
import { marketToMic } from "./marketMap.js";
import type { HaltRecordWithMeta, NasdaqHaltItem } from "./types.js";

/** Converts one parsed feed item into the engine's HaltRecord shape at face value — the item's
 * current reasonCode already reflects Nasdaq's latest known state for that halt (§4.1: "T1
 * becomes T3 when resumption times post" happens by Nasdaq mutating the row, not by us tracking
 * a state machine across two different rows). */
export function toHaltRecord(item: NasdaqHaltItem): HaltRecordWithMeta {
  const info = classifyReasonCode(item.reasonCode);
  return {
    symbol: item.symbol,
    market: marketToMic(item.market),
    scope: info.scope,
    haltAt: item.haltAt,
    resumeTradeAt: item.resumeTradeAt,
    reasonCategory: info.category,
    reasonCode: item.reasonCode,
  };
}
