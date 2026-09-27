// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice PRD §7.2 — packed storage structs, submission payloads and effective views for BellstateHub.
library BellstateTypes {
    // ---- Domains (§6.4) ----
    uint8 constant DOMAIN_US_MARKETS = 1;
    uint8 constant DOMAIN_HK_MARKETS = 2;
    uint8 constant DOMAIN_KR_MARKETS = 3;
    uint8 constant DOMAIN_PROGRAMS = 4;
    uint8 constant DOMAIN_PRIMARY = 5;
    uint8 constant DOMAIN_VALUATION = 6;

    // ---- Token kinds (§2.1) ----
    uint8 constant KIND_RAW = 1;
    uint8 constant KIND_WRAPPED = 2;

    // ---- Packed onchain records (§7.2) ----

    struct MarketRecord {
        uint8 session;
        uint8 interruption;
        uint8 reasonCategory;
        bytes8 reasonCode;
        uint64 sessionSince;
        uint64 interruptionSince;
        uint64 nextScheduledTransition;
        uint64 expectedResumption;
        uint64 writtenAt;
        uint32 seq;
        uint8 domain;
    }

    struct Resumption {
        uint64 at;
        uint8 category;
    }

    struct Transition {
        uint64 at;
        uint64 writtenAt;
        uint8 session;
        uint8 interruption;
        uint8 reasonCategory;
    }

    struct ProgramRecord {
        uint8 lifecycle;
        uint8 programStatus;
        uint8 programReason;
        uint64 writtenAt;
        uint32 seq;
    }

    struct PrimaryRecord {
        uint8 issuance;
        uint8 redemption;
        uint8 primaryReason;
        uint64 nextScheduledChange;
        uint64 nextCutoff;
        uint64 writtenAt;
        uint32 seq;
    }

    struct ValuationRecord {
        uint8 condition;
        uint8 sourceMarketStatus;
        uint64 conditionSince;
        uint64 valueAsOf;
        uint64 nextExpectedUpdate;
        uint64 writtenAt;
        uint32 seq;
    }

    struct ListingConfig {
        bytes32 mic;
        bytes16 symbol;
        uint8 domain;
        bool active;
    }

    struct ProgramConfig {
        bytes32 referenceListing;
        bool hasPrimary;
        bool hasValuation;
        address valuationSource;
        bytes32 valuationSourceId;
        uint64 registeredAt;
        bool active;
    }

    struct TokenConfig {
        bytes32 programId;
        address adapter;
        uint8 kind; // 1 RAW, 2 WRAPPED
        bool poolEligible;
    }

    struct DomainState {
        uint64 version;
        uint64 affirmedAt;
    }

    struct MaxAges {
        uint32 marketOpen;
        uint32 marketClosed;
        uint32 program;
        uint32 primary;
        uint32 valuationLive;
        uint32 valuationIdle;
    }

    struct LifecycleOverride {
        uint8 lifecycle;
        bytes32 evidenceHash;
        uint64 setAt;
    }

    // ---- EIP-712 submission payloads (§6.2) ----

    struct MarketUpdate {
        bytes32 listingId;
        uint32 seq;
        uint64 epoch;
        uint8 session;
        uint8 interruption;
        uint8 reasonCategory;
        bytes8 reasonCode;
        uint64 sessionSince;
        uint64 interruptionSince;
        uint64 nextScheduledTransition;
        uint64 expectedResumption;
        uint32 calendarVersion;
    }

    struct ProgramUpdate {
        bytes32 programId;
        uint32 seq;
        uint64 epoch;
        uint8 lifecycle;
        uint8 programStatus;
        uint8 programReason;
    }

    struct PrimaryUpdate {
        bytes32 programId;
        uint32 seq;
        uint64 epoch;
        uint8 issuance;
        uint8 redemption;
        uint64 nextScheduledChange;
        uint64 nextCutoff;
        uint8 primaryReason;
    }

    struct ValuationUpdate {
        bytes32 programId;
        uint32 seq;
        uint64 epoch;
        uint8 condition;
        uint64 conditionSince;
        uint64 valueAsOf;
        uint64 nextExpectedUpdate;
        uint8 sourceMarketStatus;
    }

    struct Heartbeat {
        uint8 domain;
        uint64 version;
        uint64 epoch;
        uint32 calendarVersion;
    }

    // ---- Effective views returned to callers (§7.2 "Views") ----

    struct MarketView {
        uint8 session;
        uint8 interruption;
        uint8 reasonCategory;
        bytes8 reasonCode;
        uint64 sessionSince;
        uint64 interruptionSince;
        uint64 nextScheduledTransition;
        uint64 expectedResumption;
        uint32 seq;
        uint64 writtenAt;
        uint64 effectiveAsOf;
        uint64 unknownSince;
        bool stale;
        bytes32 mic;
    }

    struct ProgramView {
        uint8 lifecycle;
        uint8 programStatus;
        uint8 programReason;
        uint32 seq;
        uint64 writtenAt;
        uint64 effectiveAsOf;
        bool stale;
    }

    struct PrimaryView {
        uint8 issuance;
        uint8 redemption;
        uint8 primaryReason;
        uint64 nextScheduledChange;
        uint64 nextCutoff;
        uint32 seq;
        uint64 writtenAt;
        uint64 effectiveAsOf;
        bool stale;
    }

    struct ValuationView {
        uint8 condition;
        uint8 sourceMarketStatus;
        uint64 conditionSince;
        uint64 valueAsOf;
        uint64 nextExpectedUpdate;
        uint32 seq;
        uint64 writtenAt;
        uint64 effectiveAsOf;
        bool stale;
    }
}
