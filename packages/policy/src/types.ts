/**
 * Mirrors packages/contracts/src/libraries/BellstateTypes.sol's *View structs field-for-field
 * and in the same order. The policy libraries only read a subset of each struct, but the full
 * shape is required here too: the parity fuzz test (tests/parity.fork.test.ts) ABI-encodes these
 * as tuples against the real PolicyLens contract, which needs every field present. uint64/uint32
 * fields use bigint to match Solidity's arithmetic exactly (see sub64 in util.ts).
 */

export interface MarketView {
  session: number;
  interruption: number;
  reasonCategory: number;
  reasonCode: `0x${string}`;
  sessionSince: bigint;
  interruptionSince: bigint;
  nextScheduledTransition: bigint;
  expectedResumption: bigint;
  seq: number;
  writtenAt: bigint;
  effectiveAsOf: bigint;
  unknownSince: bigint;
  stale: boolean;
  mic: `0x${string}`;
}

export interface ProgramView {
  lifecycle: number;
  programStatus: number;
  programReason: number;
  seq: number;
  writtenAt: bigint;
  effectiveAsOf: bigint;
  stale: boolean;
}

export interface ValuationView {
  condition: number;
  sourceMarketStatus: number;
  conditionSince: bigint;
  valueAsOf: bigint;
  nextExpectedUpdate: bigint;
  seq: number;
  writtenAt: bigint;
  effectiveAsOf: bigint;
  stale: boolean;
}

export interface Resumption {
  at: bigint;
  category: number;
}
