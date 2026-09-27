// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "./BellstateTypes.sol";

/// @notice PRD §6.6 — staleness and transition-expiry rules applied on every view.
/// Rule 1: block.timestamp - effectiveAsOf > maxAge => every enum in the facet reads UNKNOWN, every timestamp 0.
/// Rule 2 (market only): nextScheduledTransition != 0 and now >= it and effectiveAsOf < it => session reads UNKNOWN
/// until the next attestation lands; interruption keeps its value while fresh.
/// Rule 3: hub frozen => no new writes, so facets age into rule 1 naturally (enforced by the hub, not this library).
library StatusLib {
    uint8 constant SESSION_UNKNOWN = 0;
    uint8 constant SESSION_CLOSED = 4;

    uint8 constant CONDITION_UNKNOWN = 0;
    uint8 constant CONDITION_UPDATING = 1;
    uint8 constant CONDITION_DELAYED = 3;

    /// @dev §6.6 market maxAge depends on the *stored* session (open vs closed), not the effective one.
    function marketMaxAge(T.MaxAges memory ages, uint8 storedSession) internal pure returns (uint32) {
        return storedSession == SESSION_CLOSED ? ages.marketClosed : ages.marketOpen;
    }

    /// @dev §6.6 valuation maxAge depends on the *stored* condition.
    function valuationMaxAge(T.MaxAges memory ages, uint8 storedCondition) internal pure returns (uint32) {
        return (storedCondition == CONDITION_UPDATING || storedCondition == 3 /* DELAYED */)
            ? ages.valuationLive
            : ages.valuationIdle;
    }

    function effectiveMarketView(T.MarketRecord memory r, uint64 domainAffirmedAt, T.MaxAges memory ages, uint64 nowTs)
        internal
        pure
        returns (T.MarketView memory v)
    {
        uint64 effectiveAsOf = r.writtenAt > domainAffirmedAt ? r.writtenAt : domainAffirmedAt;
        uint32 maxAge = marketMaxAge(ages, r.session);
        v.seq = r.seq;
        v.writtenAt = r.writtenAt;
        v.effectiveAsOf = effectiveAsOf;
        v.mic = bytes32(0); // filled by the hub from listing config

        bool stale = r.writtenAt == 0 || nowTs > effectiveAsOf + maxAge;
        if (stale) {
            v.stale = true;
            v.unknownSince = effectiveAsOf + maxAge;
            // session/interruption/reasons/timestamps all read UNKNOWN/0
            return v;
        }

        v.session = r.session;
        v.interruption = r.interruption;
        v.reasonCategory = r.reasonCategory;
        v.reasonCode = r.reasonCode;
        v.sessionSince = r.sessionSince;
        v.interruptionSince = r.interruptionSince;
        v.nextScheduledTransition = r.nextScheduledTransition;
        v.expectedResumption = r.expectedResumption;

        // Rule 2: transition expiry — session only.
        if (r.nextScheduledTransition != 0 && nowTs >= r.nextScheduledTransition && effectiveAsOf < r.nextScheduledTransition) {
            v.session = SESSION_UNKNOWN;
            v.unknownSince = r.nextScheduledTransition;
        }
    }

    function effectiveProgramView(T.ProgramRecord memory r, uint64 domainAffirmedAt, uint32 maxAge, uint64 nowTs)
        internal
        pure
        returns (T.ProgramView memory v)
    {
        uint64 effectiveAsOf = r.writtenAt > domainAffirmedAt ? r.writtenAt : domainAffirmedAt;
        v.seq = r.seq;
        v.writtenAt = r.writtenAt;
        v.effectiveAsOf = effectiveAsOf;

        bool stale = r.writtenAt == 0 || nowTs > effectiveAsOf + maxAge;
        v.stale = stale;
        if (stale) return v;

        v.lifecycle = r.lifecycle;
        v.programStatus = r.programStatus;
        v.programReason = r.programReason;
    }

    function effectivePrimaryView(T.PrimaryRecord memory r, uint64 domainAffirmedAt, uint32 maxAge, uint64 nowTs)
        internal
        pure
        returns (T.PrimaryView memory v)
    {
        uint64 effectiveAsOf = r.writtenAt > domainAffirmedAt ? r.writtenAt : domainAffirmedAt;
        v.seq = r.seq;
        v.writtenAt = r.writtenAt;
        v.effectiveAsOf = effectiveAsOf;

        bool stale = r.writtenAt == 0 || nowTs > effectiveAsOf + maxAge;
        v.stale = stale;
        if (stale) return v;

        v.issuance = r.issuance;
        v.redemption = r.redemption;
        v.primaryReason = r.primaryReason;
        v.nextScheduledChange = r.nextScheduledChange;
        v.nextCutoff = r.nextCutoff;

        if (
            r.nextScheduledChange != 0 && nowTs >= r.nextScheduledChange && effectiveAsOf < r.nextScheduledChange
        ) {
            v.issuance = 0;
            v.redemption = 0;
        }
    }

    function effectiveValuationView(T.ValuationRecord memory r, uint64 domainAffirmedAt, T.MaxAges memory ages, uint64 nowTs)
        internal
        pure
        returns (T.ValuationView memory v)
    {
        uint64 effectiveAsOf = r.writtenAt > domainAffirmedAt ? r.writtenAt : domainAffirmedAt;
        uint32 maxAge = valuationMaxAge(ages, r.condition);
        v.seq = r.seq;
        v.writtenAt = r.writtenAt;
        v.effectiveAsOf = effectiveAsOf;

        bool stale = r.writtenAt == 0 || nowTs > effectiveAsOf + maxAge;
        v.stale = stale;
        if (stale) return v;

        v.condition = r.condition;
        v.sourceMarketStatus = r.sourceMarketStatus;
        v.conditionSince = r.conditionSince;
        v.valueAsOf = r.valueAsOf;
        v.nextExpectedUpdate = r.nextExpectedUpdate;
    }
}
