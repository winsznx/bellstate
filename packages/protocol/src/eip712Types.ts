/** PRD §6.2, verbatim field order — must match packages/contracts' EIP-712 type strings exactly. */
export const EIP712_TYPES = {
  MarketUpdate: [
    { name: "listingId", type: "bytes32" },
    { name: "seq", type: "uint32" },
    { name: "epoch", type: "uint64" },
    { name: "session", type: "uint8" },
    { name: "interruption", type: "uint8" },
    { name: "reasonCategory", type: "uint8" },
    { name: "reasonCode", type: "bytes8" },
    { name: "sessionSince", type: "uint64" },
    { name: "interruptionSince", type: "uint64" },
    { name: "nextScheduledTransition", type: "uint64" },
    { name: "expectedResumption", type: "uint64" },
    { name: "calendarVersion", type: "uint32" },
  ],
  ProgramUpdate: [
    { name: "programId", type: "bytes32" },
    { name: "seq", type: "uint32" },
    { name: "epoch", type: "uint64" },
    { name: "lifecycle", type: "uint8" },
    { name: "programStatus", type: "uint8" },
    { name: "programReason", type: "uint8" },
  ],
  PrimaryUpdate: [
    { name: "programId", type: "bytes32" },
    { name: "seq", type: "uint32" },
    { name: "epoch", type: "uint64" },
    { name: "issuance", type: "uint8" },
    { name: "redemption", type: "uint8" },
    { name: "nextScheduledChange", type: "uint64" },
    { name: "nextCutoff", type: "uint64" },
    { name: "primaryReason", type: "uint8" },
  ],
  ValuationUpdate: [
    { name: "programId", type: "bytes32" },
    { name: "seq", type: "uint32" },
    { name: "epoch", type: "uint64" },
    { name: "condition", type: "uint8" },
    { name: "conditionSince", type: "uint64" },
    { name: "valueAsOf", type: "uint64" },
    { name: "nextExpectedUpdate", type: "uint64" },
    { name: "sourceMarketStatus", type: "uint8" },
  ],
  Heartbeat: [
    { name: "domain", type: "uint8" },
    { name: "version", type: "uint64" },
    { name: "epoch", type: "uint64" },
    { name: "calendarVersion", type: "uint32" },
  ],
} as const;

export type Eip712TypeName = keyof typeof EIP712_TYPES;
