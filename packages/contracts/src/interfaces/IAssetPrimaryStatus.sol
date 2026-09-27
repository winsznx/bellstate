// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice ERC-8392 §A.1 — verbatim from ERCS/erc-8391.md (ethereum/ERCs PR #1964).
/// Interface ID: 0x4ba96385
interface IAssetPrimaryStatus {
    /// @dev Availability of a primary-market leg.
    enum RequestState {
        UNKNOWN, // 0
        NOT_APPLICABLE, // this leg does not exist for this program
        ACCEPTING, // requests currently accepted
        RESTRICTED, // accepted with additional constraints in force
        CLOSED, // outside scheduled window
        SUSPENDED // deliberately suspended

    }

    struct LegStatus {
        RequestState state;
        uint64 statusAsOf;
        uint64 nextScheduledChange; // 0 = unknown
        uint64 nextCutoff; // next request cutoff (e.g. NAV cutoff; 0 = n/a)
    }

    /// @notice Availability of primary issuance and redemption.
    /// @dev A view of availability, not entitlement: the reported state reflects the
    /// program's most-permissive authorized participant class (which may be a
    /// restricted set such as authorized participants only). ACCEPTING does not
    /// imply the caller — or any retail holder — is authorized (KYC/AP gating is
    /// out of scope; see ERC-7943/3643).
    function primaryStatus() external view returns (LegStatus memory issuance, LegStatus memory redemption);
}
