// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";
import {HaltGatePolicy} from "./libraries/HaltGatePolicy.sol";
import {LendingPolicy} from "./libraries/LendingPolicy.sol";
import {PrintPolicy} from "./libraries/PrintPolicy.sol";

/// @notice PRD §7.7 — pure external wrappers over the policy libraries, used by the replay
/// player and matched 1:1 against the TS mirror in packages/policy (10,000-input fork test).
contract PolicyLens {
    function haltGateDecide(
        T.MarketView calldata m,
        T.ProgramView calldata p,
        T.Resumption calldata r,
        HaltGatePolicy.Params calldata params,
        uint64 nowTs
    ) external pure returns (HaltGatePolicy.Decision memory) {
        return HaltGatePolicy.decide(m, p, r, params, nowTs);
    }

    function lendingCanLiquidate(
        T.MarketView calldata market,
        T.ProgramView calldata program,
        T.ValuationView calldata valuation,
        bool hasValuation,
        uint8 profile,
        uint64 nowTs,
        bool seqUp,
        uint64 seqStartedAt
    ) external pure returns (bool ok, uint8 reason) {
        LendingPolicy.LiquidationInput memory in_ = LendingPolicy.LiquidationInput({
            market: market,
            program: program,
            valuation: valuation,
            hasValuation: hasValuation,
            profile: profile,
            nowTs: nowTs,
            seqUp: seqUp,
            seqStartedAt: seqStartedAt
        });
        return LendingPolicy.canLiquidate(in_);
    }

    function lendingMaxLtv(
        T.MarketView calldata market,
        T.ValuationView calldata valuation,
        bool hasValuation,
        uint16 baseLtvBps,
        bool seqUp,
        uint64 nowTs,
        uint64 seqStartedAt
    ) external pure returns (uint16) {
        return LendingPolicy.maxLtvBps(market, valuation, hasValuation, baseLtvBps, seqUp, nowTs, seqStartedAt);
    }

    function printVerdict(PrintPolicy.VenueState calldata venue, uint64 printTs, uint64 nowTs)
        external
        pure
        returns (uint8 verdict, uint16 flags, uint8 session, uint8 interruption)
    {
        return PrintPolicy.verdictSingle(venue, printTs, nowTs);
    }

    function printVerdictSecondary(
        PrintPolicy.VenueState calldata venue,
        PrintPolicy.VenueState calldata primary,
        uint64 printTs,
        uint64 nowTs
    ) external pure returns (uint8 verdict, uint16 flags) {
        return PrintPolicy.verdictSecondary(venue, primary, printTs, nowTs);
    }
}
