// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "../libraries/BellstateTypes.sol";

/// @notice PRD §7.2 — BellstateHub's external surface.
interface IBellstateHub {
    // ---- Operator functions ----
    function registerListing(bytes32 mic, bytes16 symbol, uint8 domain) external returns (bytes32 listingId);
    function registerProgram(string calldata key, bytes32 referenceListing, bytes32[] calldata homeListings, bool hasPrimary)
        external
        returns (bytes32 programId);
    function setValuationSource(bytes32 programId, address source, bytes32 sourceId) external;
    function clearValuationSource(bytes32 programId) external;
    function registerToken(address token, bytes32 programId, uint8 kind, bool poolEligible, address adapter) external;
    function setListingActive(bytes32 listingId, bool active) external;
    function setProgramActive(bytes32 programId, bool active) external;

    // ---- Submission (permissionless, quorum-signed) ----
    function submitMarketUpdates(T.MarketUpdate[] calldata u, bytes[][] calldata sigs) external;
    function submitProgramUpdates(T.ProgramUpdate[] calldata u, bytes[][] calldata sigs) external;
    function submitPrimaryUpdates(T.PrimaryUpdate[] calldata u, bytes[][] calldata sigs) external;
    function submitValuationUpdates(T.ValuationUpdate[] calldata u, bytes[][] calldata sigs) external;
    function submitHeartbeats(T.Heartbeat[] calldata h, bytes[][] calldata sigs) external;
    function submitBatch(bytes[] calldata calls) external;

    // ---- Owner functions (Safe 2-of-3) ----
    function setSigners(address[] calldata add, address[] calldata remove, uint8 newQuorum) external;
    function setCalendarVersion(uint32 v) external;
    function setMaxAges(T.MaxAges calldata m) external;
    function setLifecycleOverride(bytes32 programId, uint8 lifecycle, bytes32 evidenceHash) external;
    function clearLifecycleOverride(bytes32 programId) external;
    function freeze(uint64 duration) external;
    function unfreeze() external;
    function grantOperator(address a) external;
    function revokeOperator(address a) external;

    // ---- Views ----
    function marketView(bytes32 listingId) external view returns (T.MarketView memory);
    function programView(bytes32 programId) external view returns (T.ProgramView memory);
    function primaryView(bytes32 programId) external view returns (T.PrimaryView memory);
    function valuationView(bytes32 programId) external view returns (T.ValuationView memory);
    function resumptionOf(bytes32 listingId) external view returns (T.Resumption memory);
    function historyOf(bytes32 listingId) external view returns (T.Transition[] memory);
    function stateAt(bytes32 listingId, uint64 ts)
        external
        view
        returns (bool found, T.Transition memory t, uint64 sessionStartedAt);
    function statusDigest(bytes32 programId) external view returns (bytes32);
    function domainDigests(uint8 domain)
        external
        view
        returns (uint64 version, bytes32[] memory subjects, bytes32[] memory digests);
    function recordDigest(uint8 facet, bytes32 subject) external view returns (bytes32);
    function signerSet() external view returns (address[] memory, uint8 quorum, uint32 version);
    function tokenInfo(address token) external view returns (T.TokenConfig memory);
    function listingInfo(bytes32 listingId) external view returns (T.ListingConfig memory);
    function programInfo(bytes32 programId) external view returns (T.ProgramConfig memory, bytes32[] memory homeListings);
    function calendarVersion() external view returns (uint32);
    function frozenUntil() external view returns (uint64);
    function maxAges() external view returns (T.MaxAges memory);
    function lifecycleOverrideOf(bytes32 programId) external view returns (T.LifecycleOverride memory);

    // ---- Events ----
    event ListingRegistered(bytes32 indexed listingId, bytes32 mic, bytes16 symbol, uint8 domain);
    event ProgramRegistered(bytes32 indexed programId, bytes32 referenceListing, bool hasPrimary);
    event TokenRegistered(address indexed token, bytes32 indexed programId, uint8 kind, bool poolEligible, address adapter);
    event ValuationSourceSet(bytes32 indexed programId, address source, bytes32 sourceId);
    event MarketUpdated(
        bytes32 indexed listingId,
        uint32 seq,
        uint8 session,
        uint8 interruption,
        uint8 reasonCategory,
        bytes8 reasonCode,
        uint64 sessionSince,
        uint64 interruptionSince,
        uint64 nextScheduledTransition,
        uint64 expectedResumption,
        uint64 epoch
    );
    event ProgramUpdated(bytes32 indexed programId, uint32 seq, uint8 lifecycle, uint8 programStatus, uint8 programReason, uint64 epoch);
    event PrimaryUpdated(
        bytes32 indexed programId,
        uint32 seq,
        uint8 issuance,
        uint8 redemption,
        uint64 nextScheduledChange,
        uint64 nextCutoff,
        uint8 primaryReason,
        uint64 epoch
    );
    event ValuationUpdated(
        bytes32 indexed programId,
        uint32 seq,
        uint8 condition,
        uint64 conditionSince,
        uint64 valueAsOf,
        uint64 nextExpectedUpdate,
        uint8 sourceMarketStatus,
        uint64 epoch
    );
    event HeartbeatAccepted(uint8 indexed domain, uint64 version, uint64 epoch);
    event SubmissionFailed(uint256 index, bytes reason);
    event SignersChanged(uint32 version, uint8 quorum, address[] added, address[] removed);
    event CalendarVersionSet(uint32 v);
    event MaxAgesSet(T.MaxAges m);
    event LifecycleOverrideSet(bytes32 indexed programId, uint8 lifecycle, bytes32 evidenceHash);
    event Frozen(uint64 until);
    event Unfrozen();

    // ---- Errors ----
    // Named HubFrozen (not Frozen) to avoid a Solidity identifier collision with the
    // `event Frozen(uint64 until)` above — the PRD names both `Frozen`, which does not compile.
    error HubFrozen(uint64 until);
    error StaleSeq(bytes32 subject, uint32 expected, uint32 got);
    error EpochOutOfWindow(uint64 epoch);
    error CalendarMismatch(uint32 expected, uint32 got);
    error QuorumNotMet(uint256 got, uint8 quorum);
    error BadSignerOrder();
    error UnknownSubject(bytes32 subject);
    error EnumOutOfRange();
    error VersionMismatch(uint8 domain, uint64 expected, uint64 got);
    error InvalidQuorum();
    error OutOfBounds();
    error NotOperator();
}
