// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBellstateHub} from "./interfaces/IBellstateHub.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";
import {LendingPolicy} from "./libraries/LendingPolicy.sol";

/// @notice PRD §7.5 — liquidation and LTV gates for money markets.
contract LendingGuard {
    error StatusChanged(bytes32 expected, bytes32 actual);

    IBellstateHub public immutable hub;
    IAggregatorV3 public immutable sequencerUptimeFeed;

    constructor(IBellstateHub hub_, IAggregatorV3 sequencerUptimeFeed_) {
        hub = hub_;
        sequencerUptimeFeed = sequencerUptimeFeed_;
    }

    function _sequencerStatus() internal view returns (bool up, uint64 startedAt) {
        (, int256 answer, uint256 startedAt_,,) = sequencerUptimeFeed.latestRoundData();
        return (answer == 0, uint64(startedAt_));
    }

    function _input(address token, uint8 profile) internal view returns (LendingPolicy.LiquidationInput memory in_) {
        T.TokenConfig memory tokenCfg = hub.tokenInfo(token);
        (T.ProgramConfig memory programCfg,) = hub.programInfo(tokenCfg.programId);

        in_.market = hub.marketView(programCfg.referenceListing);
        in_.program = hub.programView(tokenCfg.programId);
        in_.hasValuation = programCfg.hasValuation;
        if (in_.hasValuation) {
            in_.valuation = hub.valuationView(tokenCfg.programId);
        }
        in_.profile = profile;
        in_.nowTs = uint64(block.timestamp);
        (in_.seqUp, in_.seqStartedAt) = _sequencerStatus();
    }

    function canLiquidate(address token, uint8 profile) external view returns (bool ok, uint8 reason, bytes32 digest) {
        LendingPolicy.LiquidationInput memory in_ = _input(token, profile);
        (ok, reason) = LendingPolicy.canLiquidate(in_);
        digest = statusDigest(token);
    }

    function maxLtvBps(address token, uint16 baseLtvBps) external view returns (uint16) {
        T.TokenConfig memory tokenCfg = hub.tokenInfo(token);
        (T.ProgramConfig memory programCfg,) = hub.programInfo(tokenCfg.programId);

        T.MarketView memory market = hub.marketView(programCfg.referenceListing);
        T.ValuationView memory valuation;
        if (programCfg.hasValuation) {
            valuation = hub.valuationView(tokenCfg.programId);
        }
        (bool seqUp, uint64 seqStartedAt) = _sequencerStatus();

        return LendingPolicy.maxLtvBps(market, valuation, programCfg.hasValuation, baseLtvBps, seqUp, uint64(block.timestamp), seqStartedAt);
    }

    function statusDigest(address token) public view returns (bytes32) {
        T.TokenConfig memory tokenCfg = hub.tokenInfo(token);
        return hub.statusDigest(tokenCfg.programId);
    }

    function assertDigest(address token, bytes32 expected) external view {
        bytes32 actual = statusDigest(token);
        if (actual != expected) revert StatusChanged(expected, actual);
    }
}
