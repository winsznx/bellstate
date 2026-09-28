// Generated from packages/contracts/out/BellstateHub.sol/BellstateHub.json — event fragments only.
// Regenerate if BellstateHub's events change: forge build in packages/contracts, then re-run
// the extraction described in README.md.
export const HUB_EVENTS_ABI = [
  {
    "type": "event",
    "name": "CalendarVersionSet",
    "inputs": [
      {
        "name": "v",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Frozen",
    "inputs": [
      {
        "name": "until",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HeartbeatAccepted",
    "inputs": [
      {
        "name": "domain",
        "type": "uint8",
        "indexed": true,
        "internalType": "uint8"
      },
      {
        "name": "version",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "epoch",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LifecycleOverrideSet",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "lifecycle",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "evidenceHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ListingRegistered",
    "inputs": [
      {
        "name": "listingId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "mic",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "symbol",
        "type": "bytes16",
        "indexed": false,
        "internalType": "bytes16"
      },
      {
        "name": "domain",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MarketUpdated",
    "inputs": [
      {
        "name": "listingId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "seq",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "session",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "interruption",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "reasonCategory",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "reasonCode",
        "type": "bytes8",
        "indexed": false,
        "internalType": "bytes8"
      },
      {
        "name": "sessionSince",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "interruptionSince",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "nextScheduledTransition",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "expectedResumption",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "epoch",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "MaxAgesSet",
    "inputs": [
      {
        "name": "m",
        "type": "tuple",
        "indexed": false,
        "internalType": "struct BellstateTypes.MaxAges",
        "components": [
          {
            "name": "marketOpen",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "marketClosed",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "program",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "primary",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "valuationLive",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "valuationIdle",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PrimaryUpdated",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "seq",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "issuance",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "redemption",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "nextScheduledChange",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "nextCutoff",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "primaryReason",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "epoch",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProgramRegistered",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "referenceListing",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "hasPrimary",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProgramUpdated",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "seq",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "lifecycle",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "programStatus",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "programReason",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "epoch",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleAdminChanged",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "previousAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "newAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleGranted",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleRevoked",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SignersChanged",
    "inputs": [
      {
        "name": "version",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "quorum",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "added",
        "type": "address[]",
        "indexed": false,
        "internalType": "address[]"
      },
      {
        "name": "removed",
        "type": "address[]",
        "indexed": false,
        "internalType": "address[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SubmissionFailed",
    "inputs": [
      {
        "name": "index",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "reason",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TokenRegistered",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "kind",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "poolEligible",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "adapter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unfrozen",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ValuationSourceSet",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "source",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "sourceId",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ValuationUpdated",
    "inputs": [
      {
        "name": "programId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "seq",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "condition",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "conditionSince",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "valueAsOf",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "nextExpectedUpdate",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "sourceMarketStatus",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "epoch",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  }
] as const;
