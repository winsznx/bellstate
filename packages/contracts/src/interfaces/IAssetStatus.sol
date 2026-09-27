// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice ERC-8392 §A.1 — verbatim from ERCS/erc-8391.md (ethereum/ERCs PR #1964).
/// Interface ID: 0xfecd6b9b
interface IAssetStatus {
    /// @dev Lifecycle of the token program itself.
    enum Lifecycle {
        UNKNOWN, // 0 — status unavailable
        PRE_ACTIVE, // program announced/deployed, not yet operational
        ACTIVE, // normal operation
        SETTLEMENT_PENDING, // terminal event in progress (merger cash-out, wind-down)
        TERMINATED // program concluded; token is a claim residue at most

    }

    /// @dev Operational status of the program, orthogonal to lifecycle.
    enum ProgramStatus {
        UNKNOWN, // 0
        NORMAL, // issuer operations functioning as designed
        SUSPENDED // issuer has suspended normal operations (ops/legal/technical)

    }

    /// @notice Current program status. MUST NOT revert; MUST NOT depend on msg.sender.
    /// @return lifecycle lifecycle state of the token program
    /// @return programStatus operational status
    /// @return lifecycleAsOf unix time lifecycle was last affirmed (0 = unknown)
    /// @return programAsOf unix time programStatus was last affirmed (0 = unknown)
    function assetStatus()
        external
        view
        returns (Lifecycle lifecycle, ProgramStatus programStatus, uint64 lifecycleAsOf, uint64 programAsOf);
}
