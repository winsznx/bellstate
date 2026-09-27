// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";
import {StatusLib} from "./libraries/StatusLib.sol";
import {MicLib} from "./libraries/MicLib.sol";
import {IBellstateHub} from "./interfaces/IBellstateHub.sol";

/// @notice PRD §7.2 — registry, signature verification, status storage, transition history,
/// domain heartbeats and owner controls. Immutable: a new protocol version deploys new addresses.
contract BellstateHub is IBellstateHub, EIP712, AccessControl {
    using ECDSA for bytes32;

    // ---- Roles ----
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    // DEFAULT_ADMIN_ROLE (0x00) is the owner (Safe 2-of-3), per AccessControl.

    // ---- EIP-712 typehashes (§6.2) ----
    bytes32 internal constant MARKET_UPDATE_TYPEHASH = keccak256(
        "MarketUpdate(bytes32 listingId,uint32 seq,uint64 epoch,uint8 session,uint8 interruption,uint8 reasonCategory,bytes8 reasonCode,uint64 sessionSince,uint64 interruptionSince,uint64 nextScheduledTransition,uint64 expectedResumption,uint32 calendarVersion)"
    );
    bytes32 internal constant PROGRAM_UPDATE_TYPEHASH =
        keccak256("ProgramUpdate(bytes32 programId,uint32 seq,uint64 epoch,uint8 lifecycle,uint8 programStatus,uint8 programReason)");
    bytes32 internal constant PRIMARY_UPDATE_TYPEHASH = keccak256(
        "PrimaryUpdate(bytes32 programId,uint32 seq,uint64 epoch,uint8 issuance,uint8 redemption,uint64 nextScheduledChange,uint64 nextCutoff,uint8 primaryReason)"
    );
    bytes32 internal constant VALUATION_UPDATE_TYPEHASH = keccak256(
        "ValuationUpdate(bytes32 programId,uint32 seq,uint64 epoch,uint8 condition,uint64 conditionSince,uint64 valueAsOf,uint64 nextExpectedUpdate,uint8 sourceMarketStatus)"
    );
    bytes32 internal constant HEARTBEAT_TYPEHASH =
        keccak256("Heartbeat(uint8 domain,uint64 version,uint64 epoch,uint32 calendarVersion)");

    // ---- Facet discriminators for recordDigest() ----
    uint8 public constant FACET_MARKET = 1;
    uint8 public constant FACET_PROGRAM = 2;
    uint8 public constant FACET_PRIMARY = 3;
    uint8 public constant FACET_VALUATION = 4;

    uint64 internal constant EPOCH_LENGTH = 15;
    uint64 internal constant FRONT_SKEW = 15;
    uint64 internal constant BACK_SKEW = 60;
    uint64 internal constant MAX_FREEZE = 86_400;

    // ---- Global state ----
    address[] internal _signerList;
    mapping(address => bool) public isSigner;
    uint8 public quorum;
    uint32 public signerSetVersion;

    uint32 public calendarVersion;
    uint64 public frozenUntil;
    T.MaxAges internal _maxAges;

    // ---- Registry ----
    mapping(bytes32 => T.ListingConfig) internal _listings;
    mapping(bytes32 => T.MarketRecord) internal _marketRecords;
    mapping(bytes32 => T.Transition[32]) internal _history;
    mapping(bytes32 => uint8) internal _historyHead;
    mapping(bytes32 => uint8) internal _historyCount;
    mapping(bytes32 => T.Resumption) internal _resumptions;

    mapping(bytes32 => T.ProgramConfig) internal _programs;
    mapping(bytes32 => bytes32[]) internal _homeListings;
    mapping(bytes32 => T.ProgramRecord) internal _programRecords;
    mapping(bytes32 => T.PrimaryRecord) internal _primaryRecords;
    mapping(bytes32 => T.ValuationRecord) internal _valuationRecords;
    mapping(bytes32 => T.LifecycleOverride) internal _lifecycleOverrides;

    mapping(address => T.TokenConfig) internal _tokens;

    mapping(uint8 => T.DomainState) internal _domains;
    mapping(uint8 => bytes32[]) internal _domainSubjects; // listingIds or programIds, by domain
    mapping(uint8 => mapping(bytes32 => bool)) internal _domainHasSubject;

    address public immutable adapterFactory;

    modifier notFrozen() {
        if (block.timestamp < frozenUntil) revert IBellstateHub.HubFrozen(frozenUntil);
        _;
    }

    constructor(
        address owner_,
        address operator_,
        address[] memory signers_,
        uint8 quorum_,
        uint32 calendarVersion_,
        T.MaxAges memory maxAges_
    ) EIP712("Bellstate", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(OPERATOR_ROLE, operator_);
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);

        if (quorum_ < 2 || quorum_ > signers_.length) revert IBellstateHub.InvalidQuorum();
        for (uint256 i = 0; i < signers_.length; i++) {
            isSigner[signers_[i]] = true;
            _signerList.push(signers_[i]);
        }
        quorum = quorum_;
        signerSetVersion = 1;

        calendarVersion = calendarVersion_;
        _maxAges = maxAges_;
        adapterFactory = address(0); // set via registerToken gate below; factory grants itself via operator role
    }

    // =========================================================================================
    // Operator functions
    // =========================================================================================

    function registerListing(bytes32 mic, bytes16 symbol, uint8 domain) external onlyRole(OPERATOR_ROLE) returns (bytes32 listingId) {
        // PRD §2.3: listingId = keccak256(utf8("<MIC>:<SYMBOL>")), not a raw word encoding.
        listingId = MicLib.listingId(mic, symbol);
        _listings[listingId] = T.ListingConfig({mic: mic, symbol: symbol, domain: domain, active: true});
        _addDomainSubject(domain, listingId);
        emit ListingRegistered(listingId, mic, symbol, domain);
    }

    /// @param key Must be exactly "xstocks:<SYMBOL>" (PRD §2.3) — programId = keccak256(utf8(key)).
    function registerProgram(string calldata key, bytes32 referenceListing, bytes32[] calldata homeListings_, bool hasPrimary)
        external
        onlyRole(OPERATOR_ROLE)
        returns (bytes32 programId)
    {
        programId = keccak256(abi.encodePacked(key));
        _programs[programId] = T.ProgramConfig({
            referenceListing: referenceListing,
            hasPrimary: hasPrimary,
            hasValuation: false,
            valuationSource: address(0),
            valuationSourceId: bytes32(0),
            registeredAt: uint64(block.timestamp),
            active: true
        });
        _homeListings[programId] = homeListings_;
        _addDomainSubject(T.DOMAIN_PROGRAMS, programId);
        if (hasPrimary) _addDomainSubject(T.DOMAIN_PRIMARY, programId);
        emit ProgramRegistered(programId, referenceListing, hasPrimary);
    }

    function setValuationSource(bytes32 programId, address source, bytes32 sourceId) external onlyRole(OPERATOR_ROLE) {
        T.ProgramConfig storage p = _programs[programId];
        p.hasValuation = true;
        p.valuationSource = source;
        p.valuationSourceId = sourceId;
        _addDomainSubject(T.DOMAIN_VALUATION, programId);
        emit ValuationSourceSet(programId, source, sourceId);
    }

    function clearValuationSource(bytes32 programId) external onlyRole(OPERATOR_ROLE) {
        T.ProgramConfig storage p = _programs[programId];
        p.hasValuation = false;
        p.valuationSource = address(0);
        p.valuationSourceId = bytes32(0);
        emit ValuationSourceSet(programId, address(0), bytes32(0));
    }

    function registerToken(address token, bytes32 programId, uint8 kind, bool poolEligible, address adapter)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _tokens[token] = T.TokenConfig({programId: programId, adapter: adapter, kind: kind, poolEligible: poolEligible});
        emit TokenRegistered(token, programId, kind, poolEligible, adapter);
    }

    function setListingActive(bytes32 listingId, bool active) external onlyRole(OPERATOR_ROLE) {
        _listings[listingId].active = active;
    }

    function setProgramActive(bytes32 programId, bool active) external onlyRole(OPERATOR_ROLE) {
        _programs[programId].active = active;
    }

    function _addDomainSubject(uint8 domain, bytes32 subject) internal {
        if (!_domainHasSubject[domain][subject]) {
            _domainHasSubject[domain][subject] = true;
            _domainSubjects[domain].push(subject);
        }
    }

    // =========================================================================================
    // Submission
    // =========================================================================================

    function submitMarketUpdates(T.MarketUpdate[] calldata u, bytes[][] calldata sigs) external notFrozen {
        for (uint256 i = 0; i < u.length; i++) {
            _applyMarketUpdate(u[i], sigs[i]);
        }
    }

    function submitProgramUpdates(T.ProgramUpdate[] calldata u, bytes[][] calldata sigs) external notFrozen {
        for (uint256 i = 0; i < u.length; i++) {
            _applyProgramUpdate(u[i], sigs[i]);
        }
    }

    function submitPrimaryUpdates(T.PrimaryUpdate[] calldata u, bytes[][] calldata sigs) external notFrozen {
        for (uint256 i = 0; i < u.length; i++) {
            _applyPrimaryUpdate(u[i], sigs[i]);
        }
    }

    function submitValuationUpdates(T.ValuationUpdate[] calldata u, bytes[][] calldata sigs) external notFrozen {
        for (uint256 i = 0; i < u.length; i++) {
            _applyValuationUpdate(u[i], sigs[i]);
        }
    }

    function submitHeartbeats(T.Heartbeat[] calldata h, bytes[][] calldata sigs) external notFrozen {
        for (uint256 i = 0; i < h.length; i++) {
            _applyHeartbeat(h[i], sigs[i]);
        }
    }

    function submitBatch(bytes[] calldata calls) external notFrozen {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = address(this).call(calls[i]);
            if (!ok) emit SubmissionFailed(i, ret);
        }
    }

    // ---- Shared validation ----

    function _checkEpochAndCalendar(uint64 epoch, uint32 msgCalendarVersion) internal view {
        uint64 epochStart = epoch * EPOCH_LENGTH;
        if (epochStart > block.timestamp + FRONT_SKEW || block.timestamp > epochStart + BACK_SKEW) {
            revert EpochOutOfWindow(epoch);
        }
        if (msgCalendarVersion != calendarVersion) revert CalendarMismatch(calendarVersion, msgCalendarVersion);
    }

    /// @dev Verifies sorted-ascending, distinct, active signer signatures over `digest` and checks quorum.
    function _verifyQuorum(bytes32 digest, bytes[] calldata sigs) internal view {
        if (sigs.length < quorum) revert QuorumNotMet(sigs.length, quorum);
        address prev = address(0);
        uint256 validCount = 0;
        for (uint256 i = 0; i < sigs.length; i++) {
            address recovered = digest.recover(sigs[i]);
            if (recovered <= prev) revert BadSignerOrder();
            prev = recovered;
            if (isSigner[recovered]) validCount++;
        }
        if (validCount < quorum) revert QuorumNotMet(validCount, quorum);
    }

    function _bumpDomain(uint8 domain) internal {
        _domains[domain].version++;
    }

    // ---- Market ----

    function _applyMarketUpdate(T.MarketUpdate calldata u, bytes[] calldata sigs) internal {
        _checkEpochAndCalendar(u.epoch, u.calendarVersion);
        if (u.session > 4 || u.interruption > 4) revert EnumOutOfRange();
        if (u.interruption == 1 /* NONE */ && u.expectedResumption != 0) revert EnumOutOfRange();
        if (u.sessionSince != 0 && u.nextScheduledTransition != 0 && u.sessionSince > u.nextScheduledTransition) {
            revert OutOfBounds();
        }

        T.MarketRecord storage r = _marketRecords[u.listingId];
        T.ListingConfig memory cfg = _listings[u.listingId];
        if (cfg.mic == bytes32(0) && cfg.symbol == bytes16(0)) revert UnknownSubject(u.listingId);
        if (u.seq != r.seq + 1) revert StaleSeq(u.listingId, r.seq + 1, u.seq);

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    MARKET_UPDATE_TYPEHASH,
                    u.listingId,
                    u.seq,
                    u.epoch,
                    u.session,
                    u.interruption,
                    u.reasonCategory,
                    u.reasonCode,
                    u.sessionSince,
                    u.interruptionSince,
                    u.nextScheduledTransition,
                    u.expectedResumption,
                    u.calendarVersion
                )
            )
        );
        _verifyQuorum(digest, sigs);

        bool wasHalted = r.interruption == 3 /* ASSET_HALTED */ || r.interruption == 4 /* VENUE_HALTED */;
        bool nowHalted = u.interruption == 3 || u.interruption == 4;
        uint8 prevReasonCategory = r.reasonCategory;

        r.session = u.session;
        r.interruption = u.interruption;
        r.reasonCategory = u.reasonCategory;
        r.reasonCode = u.reasonCode;
        r.sessionSince = u.sessionSince;
        r.interruptionSince = u.interruptionSince;
        r.nextScheduledTransition = u.nextScheduledTransition;
        r.expectedResumption = u.expectedResumption;
        r.writtenAt = uint64(block.timestamp);
        r.seq = u.seq;
        r.domain = cfg.domain;

        _bumpDomain(cfg.domain);

        uint64 transitionAt = u.sessionSince != 0 ? u.sessionSince : (u.interruptionSince != 0 ? u.interruptionSince : r.writtenAt);
        _pushTransition(u.listingId, T.Transition({at: transitionAt, writtenAt: r.writtenAt, session: u.session, interruption: u.interruption, reasonCategory: u.reasonCategory}));

        if (wasHalted && !nowHalted) {
            _resumptions[u.listingId] = T.Resumption({at: u.interruptionSince != 0 ? u.interruptionSince : r.writtenAt, category: prevReasonCategory});
        }

        emit MarketUpdated(
            u.listingId, u.seq, u.session, u.interruption, u.reasonCategory, u.reasonCode, u.sessionSince, u.interruptionSince, u.nextScheduledTransition, u.expectedResumption, u.epoch
        );
    }

    function _pushTransition(bytes32 listingId, T.Transition memory t) internal {
        uint8 head = _historyHead[listingId];
        _history[listingId][head] = t;
        _historyHead[listingId] = uint8((head + 1) % 32);
        uint8 count = _historyCount[listingId];
        if (count < 32) _historyCount[listingId] = count + 1;
    }

    // ---- Program ----

    function _applyProgramUpdate(T.ProgramUpdate calldata u, bytes[] calldata sigs) internal {
        _checkEpochAndCalendarProgram(u.epoch);
        if (u.lifecycle > 4 || u.programStatus > 2) revert EnumOutOfRange();

        T.ProgramRecord storage r = _programRecords[u.programId];
        if (_programs[u.programId].registeredAt == 0) revert UnknownSubject(u.programId);
        if (u.seq != r.seq + 1) revert StaleSeq(u.programId, r.seq + 1, u.seq);

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(PROGRAM_UPDATE_TYPEHASH, u.programId, u.seq, u.epoch, u.lifecycle, u.programStatus, u.programReason))
        );
        _verifyQuorum(digest, sigs);

        r.lifecycle = u.lifecycle;
        r.programStatus = u.programStatus;
        r.programReason = u.programReason;
        r.writtenAt = uint64(block.timestamp);
        r.seq = u.seq;

        _bumpDomain(T.DOMAIN_PROGRAMS);
        emit ProgramUpdated(u.programId, u.seq, u.lifecycle, u.programStatus, u.programReason, u.epoch);
    }

    // ---- Primary ----

    function _applyPrimaryUpdate(T.PrimaryUpdate calldata u, bytes[] calldata sigs) internal {
        _checkEpochAndCalendarProgram(u.epoch);
        if (u.issuance > 5 || u.redemption > 5) revert EnumOutOfRange();

        T.PrimaryRecord storage r = _primaryRecords[u.programId];
        if (!_programs[u.programId].hasPrimary) revert UnknownSubject(u.programId);
        if (u.seq != r.seq + 1) revert StaleSeq(u.programId, r.seq + 1, u.seq);

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PRIMARY_UPDATE_TYPEHASH, u.programId, u.seq, u.epoch, u.issuance, u.redemption, u.nextScheduledChange, u.nextCutoff, u.primaryReason
                )
            )
        );
        _verifyQuorum(digest, sigs);

        r.issuance = u.issuance;
        r.redemption = u.redemption;
        r.primaryReason = u.primaryReason;
        r.nextScheduledChange = u.nextScheduledChange;
        r.nextCutoff = u.nextCutoff;
        r.writtenAt = uint64(block.timestamp);
        r.seq = u.seq;

        _bumpDomain(T.DOMAIN_PRIMARY);
        emit PrimaryUpdated(u.programId, u.seq, u.issuance, u.redemption, u.nextScheduledChange, u.nextCutoff, u.primaryReason, u.epoch);
    }

    // ---- Valuation ----

    function _applyValuationUpdate(T.ValuationUpdate calldata u, bytes[] calldata sigs) internal {
        _checkEpochAndCalendarProgram(u.epoch);
        if (u.condition > 6) revert EnumOutOfRange();

        T.ValuationRecord storage r = _valuationRecords[u.programId];
        if (!_programs[u.programId].hasValuation) revert UnknownSubject(u.programId);
        if (u.seq != r.seq + 1) revert StaleSeq(u.programId, r.seq + 1, u.seq);

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    VALUATION_UPDATE_TYPEHASH, u.programId, u.seq, u.epoch, u.condition, u.conditionSince, u.valueAsOf, u.nextExpectedUpdate, u.sourceMarketStatus
                )
            )
        );
        _verifyQuorum(digest, sigs);

        r.condition = u.condition;
        r.sourceMarketStatus = u.sourceMarketStatus;
        r.conditionSince = u.conditionSince;
        r.valueAsOf = u.valueAsOf;
        r.nextExpectedUpdate = u.nextExpectedUpdate;
        r.writtenAt = uint64(block.timestamp);
        r.seq = u.seq;

        _bumpDomain(T.DOMAIN_VALUATION);
        emit ValuationUpdated(u.programId, u.seq, u.condition, u.conditionSince, u.valueAsOf, u.nextExpectedUpdate, u.sourceMarketStatus, u.epoch);
    }

    /// @dev Program/primary/valuation updates use the same epoch window but aren't tied to a listing calendar;
    /// calendar version is still required to match so a stale signer build can't submit non-market facets either.
    function _checkEpochAndCalendarProgram(uint64 epoch) internal view {
        uint64 epochStart = epoch * EPOCH_LENGTH;
        if (epochStart > block.timestamp + FRONT_SKEW || block.timestamp > epochStart + BACK_SKEW) {
            revert EpochOutOfWindow(epoch);
        }
    }

    // ---- Heartbeats ----

    function _applyHeartbeat(T.Heartbeat calldata h, bytes[] calldata sigs) internal {
        _checkEpochAndCalendar(h.epoch, h.calendarVersion);
        if (h.version != _domains[h.domain].version) revert VersionMismatch(h.domain, _domains[h.domain].version, h.version);

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(HEARTBEAT_TYPEHASH, h.domain, h.version, h.epoch, h.calendarVersion)));
        _verifyQuorum(digest, sigs);

        _domains[h.domain].affirmedAt = uint64(block.timestamp);
        emit HeartbeatAccepted(h.domain, h.version, h.epoch);
    }

    // =========================================================================================
    // Owner functions
    // =========================================================================================

    function setSigners(address[] calldata add, address[] calldata remove, uint8 newQuorum) external onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < remove.length; i++) {
            isSigner[remove[i]] = false;
        }
        for (uint256 i = 0; i < add.length; i++) {
            if (!isSigner[add[i]]) {
                isSigner[add[i]] = true;
                _signerList.push(add[i]);
            }
        }
        // Rebuild active list.
        uint256 activeCount = 0;
        for (uint256 i = 0; i < _signerList.length; i++) {
            if (isSigner[_signerList[i]]) activeCount++;
        }
        if (newQuorum < 2 || newQuorum > activeCount) revert InvalidQuorum();
        quorum = newQuorum;
        signerSetVersion++;
        emit SignersChanged(signerSetVersion, newQuorum, add, remove);
    }

    function setCalendarVersion(uint32 v) external onlyRole(DEFAULT_ADMIN_ROLE) {
        calendarVersion = v;
        emit CalendarVersionSet(v);
    }

    function setMaxAges(T.MaxAges calldata m) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint32[6] memory vals = [m.marketOpen, m.marketClosed, m.program, m.primary, m.valuationLive, m.valuationIdle];
        for (uint256 i = 0; i < vals.length; i++) {
            if (vals[i] < 60 || vals[i] > 7200) revert OutOfBounds();
        }
        _maxAges = m;
        emit MaxAgesSet(m);
    }

    function setLifecycleOverride(bytes32 programId, uint8 lifecycle, bytes32 evidenceHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (lifecycle != 3 /* SETTLEMENT_PENDING */ && lifecycle != 4 /* TERMINATED */) revert EnumOutOfRange();
        _lifecycleOverrides[programId] = T.LifecycleOverride({lifecycle: lifecycle, evidenceHash: evidenceHash, setAt: uint64(block.timestamp)});
        emit LifecycleOverrideSet(programId, lifecycle, evidenceHash);
    }

    function clearLifecycleOverride(bytes32 programId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete _lifecycleOverrides[programId];
        emit LifecycleOverrideSet(programId, 0, bytes32(0));
    }

    function freeze(uint64 duration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (duration > MAX_FREEZE) revert OutOfBounds();
        frozenUntil = uint64(block.timestamp) + duration;
        emit Frozen(frozenUntil);
    }

    function unfreeze() external onlyRole(DEFAULT_ADMIN_ROLE) {
        frozenUntil = 0;
        emit Unfrozen();
    }

    function grantOperator(address a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, a);
    }

    function revokeOperator(address a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, a);
    }

    // =========================================================================================
    // Views
    // =========================================================================================

    function marketView(bytes32 listingId) public view returns (T.MarketView memory v) {
        T.MarketRecord memory r = _marketRecords[listingId];
        v = StatusLib.effectiveMarketView(r, _domains[r.domain].affirmedAt, _maxAges, uint64(block.timestamp));
        v.mic = _listings[listingId].mic;
    }

    function programView(bytes32 programId) public view returns (T.ProgramView memory) {
        T.ProgramRecord memory r = _programRecords[programId];
        return StatusLib.effectiveProgramView(r, _domains[T.DOMAIN_PROGRAMS].affirmedAt, _maxAges.program, uint64(block.timestamp));
    }

    function primaryView(bytes32 programId) public view returns (T.PrimaryView memory) {
        T.PrimaryRecord memory r = _primaryRecords[programId];
        return StatusLib.effectivePrimaryView(r, _domains[T.DOMAIN_PRIMARY].affirmedAt, _maxAges.primary, uint64(block.timestamp));
    }

    function valuationView(bytes32 programId) public view returns (T.ValuationView memory) {
        T.ValuationRecord memory r = _valuationRecords[programId];
        return StatusLib.effectiveValuationView(r, _domains[T.DOMAIN_VALUATION].affirmedAt, _maxAges, uint64(block.timestamp));
    }

    function resumptionOf(bytes32 listingId) external view returns (T.Resumption memory) {
        return _resumptions[listingId];
    }

    function historyOf(bytes32 listingId) external view returns (T.Transition[] memory out) {
        uint8 count = _historyCount[listingId];
        out = new T.Transition[](count);
        uint8 head = _historyHead[listingId];
        // oldest is at (head - count) mod 32 when count == 32, else index 0..count-1.
        uint8 start = count == 32 ? head : 0;
        for (uint8 i = 0; i < count; i++) {
            out[i] = _history[listingId][(start + i) % 32];
        }
    }

    function stateAt(bytes32 listingId, uint64 ts) external view returns (bool found, T.Transition memory t, uint64 sessionStartedAt) {
        uint8 count = _historyCount[listingId];
        uint8 head = _historyHead[listingId];
        uint8 start = count == 32 ? head : 0;
        // Scan newest-to-oldest for the latest transition at or before ts.
        for (uint256 i = count; i > 0; i--) {
            T.Transition memory candidate = _history[listingId][(start + i - 1) % 32];
            if (candidate.at <= ts) {
                return (true, candidate, candidate.at);
            }
        }
        return (false, t, 0);
    }

    function statusDigest(bytes32 programId) public view returns (bytes32) {
        T.ProgramConfig memory cfg = _programs[programId];
        return keccak256(
            abi.encode(marketView(cfg.referenceListing), programView(programId), primaryView(programId), valuationView(programId))
        );
    }

    function domainDigests(uint8 domain) external view returns (uint64 version, bytes32[] memory subjects, bytes32[] memory digests) {
        subjects = _domainSubjects[domain];
        digests = new bytes32[](subjects.length);
        for (uint256 i = 0; i < subjects.length; i++) {
            digests[i] = recordDigest(_facetForDomain(domain), subjects[i]);
        }
        version = _domains[domain].version;
    }

    function _facetForDomain(uint8 domain) internal pure returns (uint8) {
        if (domain == T.DOMAIN_PROGRAMS) return FACET_PROGRAM;
        if (domain == T.DOMAIN_PRIMARY) return FACET_PRIMARY;
        if (domain == T.DOMAIN_VALUATION) return FACET_VALUATION;
        return FACET_MARKET;
    }

    function recordDigest(uint8 facet, bytes32 subject) public view returns (bytes32) {
        if (facet == FACET_MARKET) return keccak256(abi.encode(_marketRecords[subject]));
        if (facet == FACET_PROGRAM) return keccak256(abi.encode(_programRecords[subject]));
        if (facet == FACET_PRIMARY) return keccak256(abi.encode(_primaryRecords[subject]));
        return keccak256(abi.encode(_valuationRecords[subject]));
    }

    function signerSet() external view returns (address[] memory active, uint8 q, uint32 version) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < _signerList.length; i++) {
            if (isSigner[_signerList[i]]) activeCount++;
        }
        active = new address[](activeCount);
        uint256 j = 0;
        for (uint256 i = 0; i < _signerList.length; i++) {
            if (isSigner[_signerList[i]]) active[j++] = _signerList[i];
        }
        q = quorum;
        version = signerSetVersion;
    }

    function tokenInfo(address token) external view returns (T.TokenConfig memory) {
        return _tokens[token];
    }

    function listingInfo(bytes32 listingId) external view returns (T.ListingConfig memory) {
        return _listings[listingId];
    }

    function programInfo(bytes32 programId) external view returns (T.ProgramConfig memory, bytes32[] memory) {
        return (_programs[programId], _homeListings[programId]);
    }

    function maxAges() external view returns (T.MaxAges memory) {
        return _maxAges;
    }

    function lifecycleOverrideOf(bytes32 programId) external view returns (T.LifecycleOverride memory) {
        return _lifecycleOverrides[programId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
