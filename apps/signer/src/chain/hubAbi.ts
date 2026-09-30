/** Read-only subset of BellstateHub's ABI this signer needs (packages/contracts/src/BellstateHub.sol).
 * Verbatim from packages/contracts/out/BellstateHub.sol/BellstateHub.json — this app doesn't
 * submit transactions (§6.5: submission is the aggregator's job), so no write functions here. */
export const HUB_READ_ABI = [
  {
    type: "function",
    name: "calendarVersion",
    inputs: [],
    outputs: [{ name: "", type: "uint32", internalType: "uint32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "frozenUntil",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketView",
    inputs: [{ name: "listingId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      {
        name: "v",
        type: "tuple",
        internalType: "struct BellstateTypes.MarketView",
        components: [
          { name: "session", type: "uint8", internalType: "uint8" },
          { name: "interruption", type: "uint8", internalType: "uint8" },
          { name: "reasonCategory", type: "uint8", internalType: "uint8" },
          { name: "reasonCode", type: "bytes8", internalType: "bytes8" },
          { name: "sessionSince", type: "uint64", internalType: "uint64" },
          { name: "interruptionSince", type: "uint64", internalType: "uint64" },
          { name: "nextScheduledTransition", type: "uint64", internalType: "uint64" },
          { name: "expectedResumption", type: "uint64", internalType: "uint64" },
          { name: "seq", type: "uint32", internalType: "uint32" },
          { name: "writtenAt", type: "uint64", internalType: "uint64" },
          { name: "effectiveAsOf", type: "uint64", internalType: "uint64" },
          { name: "unknownSince", type: "uint64", internalType: "uint64" },
          { name: "stale", type: "bool", internalType: "bool" },
          { name: "mic", type: "bytes32", internalType: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "domainDigests",
    inputs: [{ name: "domain", type: "uint8", internalType: "uint8" }],
    outputs: [
      { name: "version", type: "uint64", internalType: "uint64" },
      { name: "subjects", type: "bytes32[]", internalType: "bytes32[]" },
      { name: "digests", type: "bytes32[]", internalType: "bytes32[]" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "signerSet",
    inputs: [],
    outputs: [
      { name: "active", type: "address[]", internalType: "address[]" },
      { name: "q", type: "uint8", internalType: "uint8" },
      { name: "version", type: "uint32", internalType: "uint32" },
    ],
    stateMutability: "view",
  },
] as const;
