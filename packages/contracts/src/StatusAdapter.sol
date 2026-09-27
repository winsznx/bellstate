// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IAssetStatus} from "./interfaces/IAssetStatus.sol";
import {IReferenceMarketStatus} from "./interfaces/IReferenceMarketStatus.sol";
import {IReferenceValuationStatus} from "./interfaces/IReferenceValuationStatus.sol";
import {IAssetPrimaryStatus} from "./interfaces/IAssetPrimaryStatus.sol";
import {IBellstateStatus} from "./interfaces/IBellstateStatus.sol";
import {IBellstateHub} from "./interfaces/IBellstateHub.sol";
import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";

/// @notice PRD §7.3 — ERC-8392 surface per token. Deployed as EIP-1167 clones by AdapterFactory.
/// Any failure returns UNKNOWN and zeros, never a revert (ERC-8392 rules 2 and 5): a revert,
/// out-of-gas, bad return length, or an out-of-range enum after range-checking is swallowed by
/// the staticcall wrapper below and mapped to the zero/UNKNOWN response.
contract StatusAdapter is
    IAssetStatus,
    IReferenceMarketStatus,
    IReferenceValuationStatus,
    IAssetPrimaryStatus,
    IBellstateStatus,
    IERC165
{
    uint256 internal constant HUB_CALL_GAS = 100_000;

    bytes4 internal constant IID_ERC165 = 0x01ffc9a7;
    bytes4 internal constant IID_ASSET_STATUS = 0xfecd6b9b;
    bytes4 internal constant IID_REFERENCE_MARKET_STATUS = 0xfe1d1980;
    bytes4 internal constant IID_REFERENCE_VALUATION_STATUS = 0x7d9b41ad;
    bytes4 internal constant IID_ASSET_PRIMARY_STATUS = 0x4ba96385;
    // IBellstateStatus ERC-165 id is computed and published on S10 (PRD App. A.2); left as a
    // constant slot for the ops/dev-hub page to fill once computed in tests, not load-bearing here.

    address public hub;
    address public asset;
    bytes32 public programId;
    uint8 public kind;
    bool internal _initialized;

    modifier onlyUninitialized() {
        require(!_initialized, "already initialized");
        _;
    }

    function initialize(address hub_, address asset_, bytes32 programId_, uint8 kind_) external onlyUninitialized {
        hub = hub_;
        asset = asset_;
        programId = programId_;
        kind = kind_;
        _initialized = true;
    }

    // =========================================================================================
    // IAssetStatus
    // =========================================================================================

    function assetStatus()
        external
        view
        override
        returns (Lifecycle lifecycle, ProgramStatus programStatus, uint64 lifecycleAsOf, uint64 programAsOf)
    {
        T.LifecycleOverride memory ov = _lifecycleOverrideSafe();
        if (ov.setAt != 0) {
            lifecycle = Lifecycle(ov.lifecycle);
            lifecycleAsOf = ov.setAt;
        } else {
            (bool ok, T.ProgramView memory v) = _programViewSafe();
            if (ok && !v.stale) {
                lifecycle = Lifecycle(v.lifecycle);
                lifecycleAsOf = v.effectiveAsOf;
            }
        }

        (bool ok2, T.ProgramView memory v2) = _programViewSafe();
        if (ok2 && !v2.stale) {
            programStatus = ProgramStatus(v2.programStatus);
            programAsOf = v2.effectiveAsOf;
        }
    }

    // =========================================================================================
    // IReferenceMarketStatus (reference listing only)
    // =========================================================================================

    function referenceMarketStatus()
        external
        view
        override
        returns (
            Session session,
            Interruption interruption,
            uint64 sessionAsOf,
            uint64 interruptionAsOf,
            uint64 nextScheduledTransition,
            bytes32 marketId
        )
    {
        (bool ok, T.ProgramConfig memory cfg) = _programConfigSafe();
        if (!ok) return (Session.UNKNOWN, Interruption.UNKNOWN, 0, 0, 0, bytes32(0));

        (bool ok2, T.MarketView memory v) = _marketViewSafe(cfg.referenceListing);
        if (!ok2) return (Session.UNKNOWN, Interruption.UNKNOWN, 0, 0, 0, bytes32(0));

        session = Session(v.session);
        interruption = Interruption(v.interruption);
        sessionAsOf = v.effectiveAsOf;
        interruptionAsOf = v.effectiveAsOf;
        nextScheduledTransition = v.nextScheduledTransition;
        marketId = v.mic;
    }

    // =========================================================================================
    // IReferenceValuationStatus
    // =========================================================================================

    function referenceValuationStatus() external view override returns (ValuationStatus memory out) {
        (bool ok, T.ValuationView memory v) = _valuationViewSafe();
        (bool okCfg, T.ProgramConfig memory cfg) = _programConfigSafe();
        if (!ok || v.stale) {
            return out; // all-zero => Condition.UNKNOWN
        }
        out.condition = Condition(v.condition);
        out.valueAsOf = v.valueAsOf;
        out.statusAsOf = v.effectiveAsOf;
        out.nextExpectedUpdate = v.nextExpectedUpdate;
        out.source = okCfg ? cfg.valuationSource : address(0);
        out.sourceId = okCfg ? cfg.valuationSourceId : bytes32(0);
    }

    // =========================================================================================
    // IAssetPrimaryStatus
    // =========================================================================================

    function primaryStatus() external view override returns (LegStatus memory issuance, LegStatus memory redemption) {
        (bool ok, T.PrimaryView memory v) = _primaryViewSafe();
        if (!ok || v.stale) {
            return (issuance, redemption); // all-zero => RequestState.UNKNOWN
        }
        issuance = LegStatus({
            state: RequestState(v.issuance),
            statusAsOf: v.effectiveAsOf,
            nextScheduledChange: v.nextScheduledChange,
            nextCutoff: v.nextCutoff
        });
        redemption = LegStatus({
            state: RequestState(v.redemption),
            statusAsOf: v.effectiveAsOf,
            nextScheduledChange: v.nextScheduledChange,
            nextCutoff: v.nextCutoff
        });
    }

    // =========================================================================================
    // IBellstateStatus (extension)
    // =========================================================================================

    function marketDetail() external view override returns (MarketDetail memory d) {
        (bool ok, T.ProgramConfig memory cfg) = _programConfigSafe();
        if (!ok) return d;
        return _marketDetailOf(cfg.referenceListing);
    }

    function homeListings() external view override returns (bytes32[] memory out) {
        (bool ok, bytes memory ret) = hub.staticcall{gas: HUB_CALL_GAS}(
            abi.encodeWithSelector(IBellstateHub.programInfo.selector, programId)
        );
        if (!ok || ret.length == 0) return out;
        (, out) = abi.decode(ret, (T.ProgramConfig, bytes32[]));
    }

    function homeMarketDetail(bytes32 listingId) external view override returns (MarketDetail memory) {
        return _marketDetailOf(listingId);
    }

    function programReason() external view override returns (uint8) {
        (bool ok, T.ProgramView memory v) = _programViewSafe();
        return ok ? v.programReason : 0;
    }

    function primaryReason() external view override returns (uint8) {
        (bool ok, T.PrimaryView memory v) = _primaryViewSafe();
        return ok ? v.primaryReason : 0;
    }

    function valuationDetail() external view override returns (uint64 conditionSince, uint8 sourceMarketStatus) {
        (bool ok, T.ValuationView memory v) = _valuationViewSafe();
        if (!ok) return (0, 0);
        return (v.conditionSince, v.sourceMarketStatus);
    }

    function lifecycleOverride() external view override returns (uint8 lifecycle, bytes32 evidenceHash, uint64 setAt) {
        T.LifecycleOverride memory ov = _lifecycleOverrideSafe();
        return (ov.lifecycle, ov.evidenceHash, ov.setAt);
    }

    function statusDigest() external view override returns (bytes32) {
        (bool ok, bytes memory ret) =
            hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.statusDigest.selector, programId));
        if (!ok || ret.length != 32) return bytes32(0);
        return abi.decode(ret, (bytes32));
    }

    // =========================================================================================
    // ERC-165
    // =========================================================================================

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        if (interfaceId == IID_ERC165 || interfaceId == IID_ASSET_STATUS) return true;
        if (interfaceId == IID_REFERENCE_MARKET_STATUS) {
            (bool ok, T.ProgramConfig memory cfg) = _programConfigSafe();
            return ok && cfg.referenceListing != bytes32(0);
        }
        if (interfaceId == IID_ASSET_PRIMARY_STATUS) {
            (bool ok, T.ProgramConfig memory cfg) = _programConfigSafe();
            return ok && cfg.hasPrimary;
        }
        if (interfaceId == IID_REFERENCE_VALUATION_STATUS) {
            (bool ok, T.ProgramConfig memory cfg) = _programConfigSafe();
            return ok && cfg.hasValuation;
        }
        return false;
    }

    // =========================================================================================
    // Internal: capped staticcalls to the hub, never revert
    // =========================================================================================

    function _marketDetailOf(bytes32 listingId) internal view returns (MarketDetail memory d) {
        (bool ok, T.MarketView memory v) = _marketViewSafe(listingId);
        if (!ok) return d;
        (bool okListing, T.ListingConfig memory cfg) = _listingInfoSafe(listingId);
        d.listingId = listingId;
        d.mic = okListing ? cfg.mic : bytes32(0);
        d.symbol = okListing ? cfg.symbol : bytes16(0);
        d.reasonCategory = v.reasonCategory;
        d.reasonCode = v.reasonCode;
        d.sessionSince = v.sessionSince;
        d.interruptionSince = v.interruptionSince;
        d.expectedResumption = v.expectedResumption;
        d.seq = v.seq;
        d.writtenAt = v.writtenAt;
        d.effectiveAsOf = v.effectiveAsOf;
        d.unknownSince = v.unknownSince;
        d.stale = v.stale;
    }

    function _marketViewSafe(bytes32 listingId) internal view returns (bool ok, T.MarketView memory v) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.marketView.selector, listingId));
        if (!ok || ret.length == 0) return (false, v);
        v = abi.decode(ret, (T.MarketView));
        if (v.session > 4 || v.interruption > 4) return (false, v); // ERC rule 5: out-of-range enum => UNKNOWN
        return (true, v);
    }

    function _programViewSafe() internal view returns (bool ok, T.ProgramView memory v) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.programView.selector, programId));
        if (!ok || ret.length == 0) return (false, v);
        v = abi.decode(ret, (T.ProgramView));
        if (v.lifecycle > 4 || v.programStatus > 2) return (false, v);
        return (true, v);
    }

    function _primaryViewSafe() internal view returns (bool ok, T.PrimaryView memory v) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.primaryView.selector, programId));
        if (!ok || ret.length == 0) return (false, v);
        v = abi.decode(ret, (T.PrimaryView));
        if (v.issuance > 5 || v.redemption > 5) return (false, v);
        return (true, v);
    }

    function _valuationViewSafe() internal view returns (bool ok, T.ValuationView memory v) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.valuationView.selector, programId));
        if (!ok || ret.length == 0) return (false, v);
        v = abi.decode(ret, (T.ValuationView));
        if (v.condition > 6) return (false, v);
        return (true, v);
    }

    function _programConfigSafe() internal view returns (bool ok, T.ProgramConfig memory cfg) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.programInfo.selector, programId));
        if (!ok || ret.length == 0) return (false, cfg);
        (cfg,) = abi.decode(ret, (T.ProgramConfig, bytes32[]));
        return (true, cfg);
    }

    function _listingInfoSafe(bytes32 listingId) internal view returns (bool ok, T.ListingConfig memory cfg) {
        bytes memory ret;
        (ok, ret) = hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.listingInfo.selector, listingId));
        if (!ok || ret.length == 0) return (false, cfg);
        cfg = abi.decode(ret, (T.ListingConfig));
        return (true, cfg);
    }

    function _lifecycleOverrideSafe() internal view returns (T.LifecycleOverride memory ov) {
        (bool ok, bytes memory ret) =
            hub.staticcall{gas: HUB_CALL_GAS}(abi.encodeWithSelector(IBellstateHub.lifecycleOverrideOf.selector, programId));
        if (!ok || ret.length == 0) return ov;
        ov = abi.decode(ret, (T.LifecycleOverride));
    }
}
