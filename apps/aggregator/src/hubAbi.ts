/** BellstateHub ABI fragments this app needs — read views, the five typed-submission functions,
 * submitBatch, and the SubmissionFailed event — mirroring packages/contracts/src/BellstateHub.sol
 * and packages/contracts/src/libraries/BellstateTypes.sol exactly (field names, order, types). */

const MARKET_UPDATE_COMPONENTS = [
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
] as const;

const PROGRAM_UPDATE_COMPONENTS = [
  { name: "programId", type: "bytes32" },
  { name: "seq", type: "uint32" },
  { name: "epoch", type: "uint64" },
  { name: "lifecycle", type: "uint8" },
  { name: "programStatus", type: "uint8" },
  { name: "programReason", type: "uint8" },
] as const;

const PRIMARY_UPDATE_COMPONENTS = [
  { name: "programId", type: "bytes32" },
  { name: "seq", type: "uint32" },
  { name: "epoch", type: "uint64" },
  { name: "issuance", type: "uint8" },
  { name: "redemption", type: "uint8" },
  { name: "nextScheduledChange", type: "uint64" },
  { name: "nextCutoff", type: "uint64" },
  { name: "primaryReason", type: "uint8" },
] as const;

const VALUATION_UPDATE_COMPONENTS = [
  { name: "programId", type: "bytes32" },
  { name: "seq", type: "uint32" },
  { name: "epoch", type: "uint64" },
  { name: "condition", type: "uint8" },
  { name: "conditionSince", type: "uint64" },
  { name: "valueAsOf", type: "uint64" },
  { name: "nextExpectedUpdate", type: "uint64" },
  { name: "sourceMarketStatus", type: "uint8" },
] as const;

const HEARTBEAT_COMPONENTS = [
  { name: "domain", type: "uint8" },
  { name: "version", type: "uint64" },
  { name: "epoch", type: "uint64" },
  { name: "calendarVersion", type: "uint32" },
] as const;

export const hubAbi = [
  {
    name: "isSigner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "quorum",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "marketView",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [{ name: "v", type: "tuple", components: [
      { name: "session", type: "uint8" },
      { name: "interruption", type: "uint8" },
      { name: "reasonCategory", type: "uint8" },
      { name: "reasonCode", type: "bytes8" },
      { name: "sessionSince", type: "uint64" },
      { name: "interruptionSince", type: "uint64" },
      { name: "nextScheduledTransition", type: "uint64" },
      { name: "expectedResumption", type: "uint64" },
      { name: "seq", type: "uint32" },
      { name: "writtenAt", type: "uint64" },
      { name: "effectiveAsOf", type: "uint64" },
      { name: "unknownSince", type: "uint64" },
      { name: "stale", type: "bool" },
      { name: "mic", type: "bytes32" },
    ] }],
  },
  {
    name: "submitMarketUpdates",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "u", type: "tuple[]", components: MARKET_UPDATE_COMPONENTS },
      { name: "sigs", type: "bytes[][]" },
    ],
    outputs: [],
  },
  {
    name: "submitProgramUpdates",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "u", type: "tuple[]", components: PROGRAM_UPDATE_COMPONENTS },
      { name: "sigs", type: "bytes[][]" },
    ],
    outputs: [],
  },
  {
    name: "submitPrimaryUpdates",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "u", type: "tuple[]", components: PRIMARY_UPDATE_COMPONENTS },
      { name: "sigs", type: "bytes[][]" },
    ],
    outputs: [],
  },
  {
    name: "submitValuationUpdates",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "u", type: "tuple[]", components: VALUATION_UPDATE_COMPONENTS },
      { name: "sigs", type: "bytes[][]" },
    ],
    outputs: [],
  },
  {
    name: "submitHeartbeats",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "h", type: "tuple[]", components: HEARTBEAT_COMPONENTS },
      { name: "sigs", type: "bytes[][]" },
    ],
    outputs: [],
  },
  {
    name: "submitBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "calls", type: "bytes[]" }],
    outputs: [],
  },
  {
    name: "SubmissionFailed",
    type: "event",
    inputs: [
      { name: "index", type: "uint256", indexed: false },
      { name: "reason", type: "bytes", indexed: false },
    ],
  },
  // Custom errors from IBellstateHub.sol — decoded from a SubmissionFailed event's `reason`
  // bytes so a partial-batch failure logs a real reason ("StaleSeq(...)") instead of raw hex.
  { name: "HubFrozen", type: "error", inputs: [{ name: "until", type: "uint64" }] },
  {
    name: "StaleSeq",
    type: "error",
    inputs: [
      { name: "subject", type: "bytes32" },
      { name: "expected", type: "uint32" },
      { name: "got", type: "uint32" },
    ],
  },
  { name: "EpochOutOfWindow", type: "error", inputs: [{ name: "epoch", type: "uint64" }] },
  {
    name: "CalendarMismatch",
    type: "error",
    inputs: [
      { name: "expected", type: "uint32" },
      { name: "got", type: "uint32" },
    ],
  },
  {
    name: "QuorumNotMet",
    type: "error",
    inputs: [
      { name: "got", type: "uint256" },
      { name: "quorum", type: "uint8" },
    ],
  },
  { name: "BadSignerOrder", type: "error", inputs: [] },
  { name: "UnknownSubject", type: "error", inputs: [{ name: "subject", type: "bytes32" }] },
  { name: "EnumOutOfRange", type: "error", inputs: [] },
  {
    name: "VersionMismatch",
    type: "error",
    inputs: [
      { name: "domain", type: "uint8" },
      { name: "expected", type: "uint64" },
      { name: "got", type: "uint64" },
    ],
  },
  { name: "InvalidQuorum", type: "error", inputs: [] },
  { name: "OutOfBounds", type: "error", inputs: [] },
  { name: "NotOperator", type: "error", inputs: [] },
] as const;
