// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice ERC-8392 §A.1 — verbatim from ERCS/erc-8391.md (ethereum/ERCs PR #1964).
/// Interface ID: 0x7d9b41ad
interface IReferenceValuationStatus {
    /// @dev Condition of the designated valuation source.
    enum Condition {
        UNKNOWN, // 0
        UPDATING, // updates arriving per the source's own declared schedule
        EXPECTED_NO_UPDATE, // no newer valuation currently due (e.g. market closed)
        DELAYED, // an expected update has not arrived
        DEGRADED, // source operating outside its declared quality bounds
        SUSPENDED, // source deliberately paused by issuer/provider
        DISPUTED // source value is contested by issuer or provider

    }

    struct ValuationStatus {
        Condition condition;
        uint64 valueAsOf; // unix time of the last valuation value
        uint64 statusAsOf; // unix time this condition was last affirmed
        uint64 nextExpectedUpdate; // unix time next update is due (0 = unknown)
        address source; // designated valuation source contract (0 = offchain)
        bytes32 sourceId; // stable id of the valuation source
    }

    /// @notice Condition of the designated valuation source for this token.
    function referenceValuationStatus() external view returns (ValuationStatus memory);
}
