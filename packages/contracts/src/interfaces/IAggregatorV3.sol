// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Minimal Chainlink AggregatorV3Interface — only what LendingGuard needs from the
/// L2 Sequencer Uptime feed (PRD §4.11/§7.5): `answer` 0 = up, 1 = down; `startedAt` = last change.
interface IAggregatorV3 {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
