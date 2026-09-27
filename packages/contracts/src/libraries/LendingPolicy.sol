// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "./BellstateTypes.sol";

/// @notice PRD §7.5 — LendingGuard's canLiquidate / maxLtvBps decision logic, extracted as a pure
/// library so PolicyLens (replays) and packages/policy (TS mirror) match the exact same logic.
library LendingPolicy {
    // ---- Session enum values ----
    uint8 constant SESSION_UNKNOWN = 0;
    uint8 constant SESSION_REGULAR = 1;
    uint8 constant SESSION_EXTENDED = 2;
    uint8 constant SESSION_AUCTION = 3;
    uint8 constant SESSION_CLOSED = 4;

    // ---- Interruption enum values ----
    uint8 constant INTERRUPTION_UNKNOWN = 0;
    uint8 constant INTERRUPTION_NONE = 1;
    uint8 constant INTERRUPTION_PRICE_CONSTRAINED = 2;
    uint8 constant INTERRUPTION_ASSET_HALTED = 3;
    uint8 constant INTERRUPTION_VENUE_HALTED = 4;

    // ---- Lifecycle / ProgramStatus ----
    uint8 constant LIFECYCLE_ACTIVE = 2;
    uint8 constant PROGRAM_STATUS_NORMAL = 1;

    // ---- Valuation Condition ----
    uint8 constant CONDITION_UPDATING = 1;
    uint8 constant CONDITION_DELAYED = 3;

    // ---- Profiles (PRD §7.5) ----
    uint8 constant PROFILE_STRICT = 0;
    uint8 constant PROFILE_EXTENDED = 1;
    uint8 constant PROFILE_HALT_ONLY = 2;

    // ---- reason codes ----
    uint8 constant REASON_OK = 0;
    uint8 constant REASON_SEQUENCER_DOWN = 1;
    uint8 constant REASON_SEQUENCER_GRACE = 2;
    uint8 constant REASON_STALE = 3;
    uint8 constant REASON_LIFECYCLE = 4;
    uint8 constant REASON_PROGRAM_SUSPENDED = 5;
    uint8 constant REASON_HALTED = 6;
    uint8 constant REASON_UNKNOWN_STATUS = 7;
    uint8 constant REASON_SESSION = 8;
    uint8 constant REASON_VALUATION = 9;

    uint256 constant SEQUENCER_GRACE_SECONDS = 3600;

    struct LiquidationInput {
        T.MarketView market;
        T.ProgramView program;
        T.ValuationView valuation;
        bool hasValuation;
        uint8 profile;
        uint64 nowTs;
        bool seqUp;
        uint64 seqStartedAt;
    }

    function canLiquidate(LiquidationInput memory in_) internal pure returns (bool ok, uint8 reason) {
        if (!in_.seqUp) return (false, REASON_SEQUENCER_DOWN);
        if (in_.nowTs - in_.seqStartedAt < SEQUENCER_GRACE_SECONDS) return (false, REASON_SEQUENCER_GRACE);

        if (in_.market.stale || in_.program.stale || (in_.hasValuation && in_.valuation.stale)) {
            return (false, REASON_STALE);
        }

        if (in_.program.lifecycle != LIFECYCLE_ACTIVE) return (false, REASON_LIFECYCLE);
        if (in_.program.programStatus != PROGRAM_STATUS_NORMAL) return (false, REASON_PROGRAM_SUSPENDED);

        if (in_.market.interruption == INTERRUPTION_UNKNOWN || in_.market.session == SESSION_UNKNOWN) {
            return (false, REASON_UNKNOWN_STATUS);
        }

        // PRD §7.5: all three profiles exclude ASSET_HALTED/VENUE_HALTED. STRICT and EXTENDED
        // additionally require interruption == NONE (checked below); HALT_ONLY allows any other
        // interruption (e.g. PRICE_CONSTRAINED).
        if (in_.market.interruption == INTERRUPTION_ASSET_HALTED || in_.market.interruption == INTERRUPTION_VENUE_HALTED) {
            return (false, REASON_HALTED);
        }

        bool valuationOk = !in_.hasValuation || in_.valuation.condition == CONDITION_UPDATING;

        if (in_.profile == PROFILE_STRICT) {
            if (in_.market.session != SESSION_REGULAR) return (false, REASON_SESSION);
            if (in_.market.interruption != INTERRUPTION_NONE) return (false, REASON_HALTED);
            if (!valuationOk) return (false, REASON_VALUATION);
            return (true, REASON_OK);
        }

        if (in_.profile == PROFILE_EXTENDED) {
            if (in_.market.session != SESSION_REGULAR && in_.market.session != SESSION_EXTENDED) {
                return (false, REASON_SESSION);
            }
            if (in_.market.interruption != INTERRUPTION_NONE) return (false, REASON_HALTED);
            if (!valuationOk) return (false, REASON_VALUATION);
            return (true, REASON_OK);
        }

        // PROFILE_HALT_ONLY: ASSET_HALTED/VENUE_HALTED/UNKNOWN already excluded above; any other
        // interruption (NONE or PRICE_CONSTRAINED) and any session is allowed.
        return (true, REASON_OK);
    }

    function maxLtvBps(T.MarketView memory market, T.ValuationView memory valuation, bool hasValuation, uint16 baseLtvBps, bool seqUp, uint64 nowTs, uint64 seqStartedAt)
        internal
        pure
        returns (uint16)
    {
        if (!seqUp) return 0;
        if (nowTs - seqStartedAt < SEQUENCER_GRACE_SECONDS) return 0;
        if (market.stale) return 0;
        if (market.session == SESSION_UNKNOWN || market.interruption == INTERRUPTION_UNKNOWN) return 0;
        if (market.interruption == INTERRUPTION_ASSET_HALTED || market.interruption == INTERRUPTION_VENUE_HALTED) return 0;
        if (hasValuation && valuation.condition == 3 /* DELAYED */) return 0;

        uint256 max = baseLtvBps;

        if (market.interruption == INTERRUPTION_PRICE_CONSTRAINED) {
            max = _sub(max, 1_500);
        } else if (market.session == SESSION_EXTENDED || market.session == SESSION_AUCTION) {
            max = _sub(max, 500);
        } else if (market.session == SESSION_CLOSED) {
            max = _sub(max, 1_000);
        }

        return uint16(max);
    }

    function _sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : 0;
    }
}
