export interface MarketUpdateMessage {
  listingId: `0x${string}`;
  seq: number;
  epoch: bigint;
  session: number;
  interruption: number;
  reasonCategory: number;
  reasonCode: `0x${string}`;
  sessionSince: bigint;
  interruptionSince: bigint;
  nextScheduledTransition: bigint;
  expectedResumption: bigint;
  calendarVersion: number;
}

export interface ProgramUpdateMessage {
  programId: `0x${string}`;
  seq: number;
  epoch: bigint;
  lifecycle: number;
  programStatus: number;
  programReason: number;
}

export interface PrimaryUpdateMessage {
  programId: `0x${string}`;
  seq: number;
  epoch: bigint;
  issuance: number;
  redemption: number;
  nextScheduledChange: bigint;
  nextCutoff: bigint;
  primaryReason: number;
}

export interface ValuationUpdateMessage {
  programId: `0x${string}`;
  seq: number;
  epoch: bigint;
  condition: number;
  conditionSince: bigint;
  valueAsOf: bigint;
  nextExpectedUpdate: bigint;
  sourceMarketStatus: number;
}

export interface HeartbeatMessage {
  domain: number;
  version: bigint;
  epoch: bigint;
  calendarVersion: number;
}
