import type { MarketState, PrimaryState, ProgramState, ValuationState } from "@winsznx/bellstate-engine";
import {
  interruptionIndex,
  lifecycleIndex,
  primaryReasonIndex,
  programReasonIndex,
  programStatusIndex,
  reasonCategoryIndex,
  requestStateIndex,
  sessionIndex,
  sourceMarketStatusIndex,
  valuationConditionIndex,
} from "./enums.js";
import type {
  MarketUpdateMessage,
  PrimaryUpdateMessage,
  ProgramUpdateMessage,
  ValuationUpdateMessage,
} from "./messages.js";
import { encodeReasonCode } from "./reasonCode.js";

export function buildMarketUpdateMessage(
  listingId: `0x${string}`,
  seq: number,
  epoch: bigint,
  state: MarketState,
  calendarVersion: number,
): MarketUpdateMessage {
  return {
    listingId,
    seq,
    epoch,
    session: sessionIndex(state.session),
    interruption: interruptionIndex(state.interruption),
    reasonCategory: reasonCategoryIndex(state.reasonCategory),
    reasonCode: encodeReasonCode(state.reasonCode),
    sessionSince: BigInt(state.sessionSince),
    interruptionSince: BigInt(state.interruptionSince),
    nextScheduledTransition: BigInt(state.nextScheduledTransition),
    expectedResumption: BigInt(state.expectedResumption),
    calendarVersion,
  };
}

export function buildProgramUpdateMessage(
  programId: `0x${string}`,
  seq: number,
  epoch: bigint,
  state: ProgramState,
): ProgramUpdateMessage {
  return {
    programId,
    seq,
    epoch,
    lifecycle: lifecycleIndex(state.lifecycle),
    programStatus: programStatusIndex(state.programStatus),
    programReason: programReasonIndex(state.programReason),
  };
}

export function buildPrimaryUpdateMessage(
  programId: `0x${string}`,
  seq: number,
  epoch: bigint,
  state: PrimaryState,
): PrimaryUpdateMessage {
  // Both legs share one primaryReason onchain (§7.2's PrimaryUpdate struct has a single field);
  // the issuance leg's reason takes precedence when the two legs disagree.
  const primaryReason =
    state.issuance.reason !== "NONE" ? state.issuance.reason : state.redemption.reason;
  return {
    programId,
    seq,
    epoch,
    issuance: requestStateIndex(state.issuance.state),
    redemption: requestStateIndex(state.redemption.state),
    nextScheduledChange: BigInt(state.nextScheduledChange),
    nextCutoff: BigInt(state.nextCutoff),
    primaryReason: primaryReasonIndex(primaryReason),
  };
}

export function buildValuationUpdateMessage(
  programId: `0x${string}`,
  seq: number,
  epoch: bigint,
  state: ValuationState,
): ValuationUpdateMessage {
  return {
    programId,
    seq,
    epoch,
    condition: valuationConditionIndex(state.condition),
    conditionSince: BigInt(state.conditionSince),
    valueAsOf: BigInt(state.valueAsOf),
    nextExpectedUpdate: BigInt(state.nextExpectedUpdate),
    sourceMarketStatus: sourceMarketStatusIndex(state.sourceMarketStatus),
  };
}
