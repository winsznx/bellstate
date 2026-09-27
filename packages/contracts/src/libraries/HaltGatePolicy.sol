// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "./BellstateTypes.sol";

/// @notice PRD §7.4 — HaltGateHook's beforeSwap decision policy, extracted as a pure library so
/// PolicyLens (replays) and packages/policy (TS mirror) link/match the exact same logic.
library HaltGatePolicy {
    // ---- Interruption enum values (IReferenceMarketStatus.Interruption) ----
    uint8 constant INTERRUPTION_UNKNOWN = 0;
    uint8 constant INTERRUPTION_NONE = 1;
    uint8 constant INTERRUPTION_PRICE_CONSTRAINED = 2;
    uint8 constant INTERRUPTION_ASSET_HALTED = 3;
    uint8 constant INTERRUPTION_VENUE_HALTED = 4;

    // ---- Session enum values (IReferenceMarketStatus.Session) ----
    uint8 constant SESSION_UNKNOWN = 0;
    uint8 constant SESSION_REGULAR = 1;
    uint8 constant SESSION_EXTENDED = 2;
    uint8 constant SESSION_AUCTION = 3;
    uint8 constant SESSION_CLOSED = 4;

    // ---- Lifecycle enum values (IAssetStatus.Lifecycle) ----
    uint8 constant LIFECYCLE_UNKNOWN = 0;
    uint8 constant LIFECYCLE_SETTLEMENT_PENDING = 3;
    uint8 constant LIFECYCLE_TERMINATED = 4;

    // ---- ProgramStatus enum values (IAssetStatus.ProgramStatus) ----
    uint8 constant PROGRAM_STATUS_UNKNOWN = 0;
    uint8 constant PROGRAM_STATUS_SUSPENDED = 2;

    // ---- Halt reason categories (App. B.4) ----
    uint8 constant CATEGORY_NEWS = 1;
    uint8 constant CATEGORY_VOLATILITY = 2;
    uint8 constant CATEGORY_REGULATORY = 3;
    uint8 constant CATEGORY_MARKET_WIDE = 4;
    uint8 constant CATEGORY_CORPORATE = 6;
    uint8 constant CATEGORY_OTHER = 9;

    // ---- Modes (App. B.4) ----
    uint8 constant MODE_REGULAR = 0;
    uint8 constant MODE_EXTENDED = 1;
    uint8 constant MODE_AUCTION = 2;
    uint8 constant MODE_CLOSED = 3;
    uint8 constant MODE_CONSTRAINED = 4;
    uint8 constant MODE_DEGRADED = 5;

    struct Params {
        uint24 feeRegular;
        uint24 feeExtended;
        uint24 feeAuction;
        uint24 feeClosed;
        uint24 feeConstrained;
        uint24 feeDegraded;
        uint32 degradeAfter;
        uint24 surgeNewsRegulatoryCorporateOther;
        uint32 surgeNewsDuration;
        uint24 surgeMarketWide;
        uint32 surgeMarketWideDuration;
        uint24 surgeVolatility;
        uint32 surgeVolatilityDuration;
        uint24 maxFee;
    }

    enum Verdict {
        Allow,
        RevertProgramNotActive,
        RevertMarketHalted,
        RevertStatusUnknown
    }

    struct Decision {
        Verdict verdict;
        uint8 mode;
        uint24 fee;
        // Revert-payload fields (only meaningful when verdict != Allow)
        uint8 interruption;
        uint8 reasonCategory;
        bytes8 reasonCode;
        uint64 since;
        uint64 expectedResumption;
        uint64 unknownSince;
        uint64 degradesAt;
    }

    /// @dev First match wins, per PRD §7.4's numbered policy table.
    function decide(T.MarketView memory m, T.ProgramView memory p, T.Resumption memory r, Params memory params, uint64 nowTs)
        internal
        pure
        returns (Decision memory d)
    {
        // Rule 1: program lifecycle terminal, or program suspended.
        if (
            p.lifecycle == LIFECYCLE_SETTLEMENT_PENDING || p.lifecycle == LIFECYCLE_TERMINATED
                || p.programStatus == PROGRAM_STATUS_SUSPENDED
        ) {
            d.verdict = Verdict.RevertProgramNotActive;
            return d;
        }

        // Rule 2: attested halt.
        if (m.interruption == INTERRUPTION_ASSET_HALTED || m.interruption == INTERRUPTION_VENUE_HALTED) {
            d.verdict = Verdict.RevertMarketHalted;
            d.interruption = m.interruption;
            d.reasonCategory = m.reasonCategory;
            d.reasonCode = m.reasonCode;
            d.since = m.interruptionSince;
            d.expectedResumption = m.expectedResumption;
            return d;
        }

        bool anyUnknown = m.session == SESSION_UNKNOWN || m.interruption == INTERRUPTION_UNKNOWN
            || p.lifecycle == LIFECYCLE_UNKNOWN || p.programStatus == PROGRAM_STATUS_UNKNOWN;

        if (anyUnknown) {
            uint64 unknownSince = m.unknownSince != 0 ? m.unknownSince : m.effectiveAsOf;
            uint64 degradesAt = unknownSince + params.degradeAfter;

            // Rule 3: within grace window.
            if (nowTs - unknownSince <= params.degradeAfter) {
                d.verdict = Verdict.RevertStatusUnknown;
                d.unknownSince = unknownSince;
                d.degradesAt = degradesAt;
                return d;
            }

            // Rule 4: past grace, degrade-allow.
            d.verdict = Verdict.Allow;
            d.mode = MODE_DEGRADED;
            d.fee = params.feeDegraded;
            return _applySurge(d, r, params, nowTs);
        }

        // Rule 5: price-constrained.
        if (m.interruption == INTERRUPTION_PRICE_CONSTRAINED) {
            d.verdict = Verdict.Allow;
            d.mode = MODE_CONSTRAINED;
            d.fee = params.feeConstrained;
            return _applySurge(d, r, params, nowTs);
        }

        // Rules 6-9: session fee.
        d.verdict = Verdict.Allow;
        if (m.session == SESSION_REGULAR) {
            d.mode = MODE_REGULAR;
            d.fee = params.feeRegular;
        } else if (m.session == SESSION_EXTENDED) {
            d.mode = MODE_EXTENDED;
            d.fee = params.feeExtended;
        } else if (m.session == SESSION_AUCTION) {
            d.mode = MODE_AUCTION;
            d.fee = params.feeAuction;
        } else {
            // SESSION_CLOSED
            d.mode = MODE_CLOSED;
            d.fee = params.feeClosed;
        }
        return _applySurge(d, r, params, nowTs);
    }

    /// @dev Reopen surge: fee += surge * (duration - (now - r.at)) / duration, decaying to 0, capped at maxFee.
    function _applySurge(Decision memory d, T.Resumption memory r, Params memory params, uint64 nowTs) internal pure returns (Decision memory) {
        if (r.at == 0) return _cap(d, params);

        (uint24 surge, uint32 duration) = _surgeFor(r.category, params);
        if (duration == 0) return _cap(d, params);

        uint64 elapsed = nowTs - r.at;
        if (elapsed >= duration) return _cap(d, params);

        uint256 remaining = uint256(duration) - uint256(elapsed);
        uint256 add = (uint256(surge) * remaining) / uint256(duration);
        d.fee = uint24(uint256(d.fee) + add);
        return _cap(d, params);
    }

    function _surgeFor(uint8 category, Params memory params) internal pure returns (uint24 surge, uint32 duration) {
        if (category == CATEGORY_MARKET_WIDE) {
            return (params.surgeMarketWide, params.surgeMarketWideDuration);
        }
        if (category == CATEGORY_VOLATILITY) {
            return (params.surgeVolatility, params.surgeVolatilityDuration);
        }
        // NEWS, REGULATORY, CORPORATE, OTHER share one surge bucket per §7.4's table.
        return (params.surgeNewsRegulatoryCorporateOther, params.surgeNewsDuration);
    }

    function _cap(Decision memory d, Params memory params) internal pure returns (Decision memory) {
        if (d.fee > params.maxFee) d.fee = params.maxFee;
        return d;
    }

    function defaultParams() internal pure returns (Params memory) {
        return Params({
            feeRegular: 1_000,
            feeExtended: 3_000,
            feeAuction: 3_000,
            feeClosed: 5_000,
            feeConstrained: 10_000,
            feeDegraded: 10_000,
            degradeAfter: 1_800,
            surgeNewsRegulatoryCorporateOther: 30_000,
            surgeNewsDuration: 900,
            surgeMarketWide: 20_000,
            surgeMarketWideDuration: 600,
            surgeVolatility: 10_000,
            surgeVolatilityDuration: 300,
            maxFee: 50_000
        });
    }
}
