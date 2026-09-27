// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice PRD Appendix A.2 — Bellstate extension present on every adapter.
interface IBellstateStatus {
    struct MarketDetail {
        bytes32 listingId;
        bytes32 mic;
        bytes16 symbol;
        uint8 reasonCategory;
        bytes8 reasonCode;
        uint64 sessionSince;
        uint64 interruptionSince;
        uint64 expectedResumption;
        uint32 seq;
        uint64 writtenAt;
        uint64 effectiveAsOf;
        uint64 unknownSince;
        bool stale;
    }

    function hub() external view returns (address);
    function asset() external view returns (address);
    function programId() external view returns (bytes32);
    function kind() external view returns (uint8); // 1 RAW, 2 WRAPPED
    function marketDetail() external view returns (MarketDetail memory); // reference listing
    function homeListings() external view returns (bytes32[] memory);
    function homeMarketDetail(bytes32 listingId) external view returns (MarketDetail memory);
    function programReason() external view returns (uint8);
    function primaryReason() external view returns (uint8);
    function valuationDetail() external view returns (uint64 conditionSince, uint8 sourceMarketStatus);
    function lifecycleOverride() external view returns (uint8 lifecycle, bytes32 evidenceHash, uint64 setAt);
    function statusDigest() external view returns (bytes32);
}
