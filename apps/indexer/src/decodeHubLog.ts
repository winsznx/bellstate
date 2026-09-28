import { decodeEventLog, type Log } from "viem";
import { HUB_EVENTS_ABI } from "./abi.js";

export type Facet = "market" | "program" | "primary" | "valuation";

export interface MarketUpdatedEvent {
  eventName: "MarketUpdated";
  facet: "market";
  args: {
    listingId: `0x${string}`;
    seq: number;
    session: number;
    interruption: number;
    reasonCategory: number;
    reasonCode: `0x${string}`;
    sessionSince: bigint;
    interruptionSince: bigint;
    nextScheduledTransition: bigint;
    expectedResumption: bigint;
    epoch: bigint;
  };
}

export interface ProgramUpdatedEvent {
  eventName: "ProgramUpdated";
  facet: "program";
  args: {
    programId: `0x${string}`;
    seq: number;
    lifecycle: number;
    programStatus: number;
    programReason: number;
    epoch: bigint;
  };
}

export interface PrimaryUpdatedEvent {
  eventName: "PrimaryUpdated";
  facet: "primary";
  args: {
    programId: `0x${string}`;
    seq: number;
    issuance: number;
    redemption: number;
    nextScheduledChange: bigint;
    nextCutoff: bigint;
    primaryReason: number;
    epoch: bigint;
  };
}

export interface ValuationUpdatedEvent {
  eventName: "ValuationUpdated";
  facet: "valuation";
  args: {
    programId: `0x${string}`;
    seq: number;
    condition: number;
    conditionSince: bigint;
    valueAsOf: bigint;
    nextExpectedUpdate: bigint;
    sourceMarketStatus: number;
    epoch: bigint;
  };
}

export interface HeartbeatAcceptedEvent {
  eventName: "HeartbeatAccepted";
  facet: null;
  args: { domain: number; version: bigint; epoch: bigint };
}

export type StatusUpdateEvent = MarketUpdatedEvent | ProgramUpdatedEvent | PrimaryUpdatedEvent | ValuationUpdatedEvent;
export type DecodedHubEvent = StatusUpdateEvent | HeartbeatAcceptedEvent;

/**
 * PRD §8.3: decodes one hub log into a typed event, or `null` for a hub event this indexer
 * doesn't need to act on (registration events, admin events — still worth a `registry` table
 * row eventually, not built yet). Returns `null` rather than throwing for a log from a
 * different contract or an unrecognized topic, since `eth_getLogs` in the real indexer covers
 * three contract addresses (hub, HaltGate, AdapterFactory) in one range query.
 */
export function decodeHubLog(log: Log): DecodedHubEvent | null {
  let decoded;
  try {
    decoded = decodeEventLog({ abi: HUB_EVENTS_ABI, topics: log.topics, data: log.data });
  } catch {
    return null;
  }

  switch (decoded.eventName) {
    case "MarketUpdated":
      return { eventName: "MarketUpdated", facet: "market", args: decoded.args } as MarketUpdatedEvent;
    case "ProgramUpdated":
      return { eventName: "ProgramUpdated", facet: "program", args: decoded.args } as ProgramUpdatedEvent;
    case "PrimaryUpdated":
      return { eventName: "PrimaryUpdated", facet: "primary", args: decoded.args } as PrimaryUpdatedEvent;
    case "ValuationUpdated":
      return { eventName: "ValuationUpdated", facet: "valuation", args: decoded.args } as ValuationUpdatedEvent;
    case "HeartbeatAccepted":
      return { eventName: "HeartbeatAccepted", facet: null, args: decoded.args } as HeartbeatAcceptedEvent;
    default:
      return null;
  }
}
