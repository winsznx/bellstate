// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IBellstateHub} from "./interfaces/IBellstateHub.sol";
import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";
import {HaltGatePolicy} from "./libraries/HaltGatePolicy.sol";

/// @notice PRD §7.4 — Uniswap v4 hook. Permissions: beforeInitialize + beforeSwap only.
/// No liquidity hooks: adding and removing liquidity are never gated, so a pool can never be
/// bricked by this contract. All other IHooks callbacks revert because the mined hook address's
/// low bits only ever set the two flags this contract implements — PoolManager will never call
/// the others — but the interface still requires them to be defined.
contract HaltGateHook is IHooks, AccessControl {
    using PoolIdLibrary for PoolKey;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    error NotPoolManager();
    error HookNotImplemented();
    error PoolNotDynamicFee();
    error NoEligibleToken();
    error QuoteNotAllowlisted();
    error ParamsOutOfBounds();
    error ProgramNotActive();
    error MarketHalted(
        bytes32 listingId, uint8 interruption, uint8 reasonCategory, bytes8 reasonCode, uint64 since, uint64 expectedResumption
    );
    error StatusUnknown(bytes32 listingId, uint64 unknownSince, uint64 degradesAt);

    event PoolRegistered(PoolId indexed id, bytes32 programId, address quote);
    event GateFee(PoolId indexed id, uint8 mode, uint24 fee);
    event QuoteAllowlistSet(address indexed token, bool allowed);

    struct PoolConfig {
        bytes32 programId;
        bytes32 listingId;
        HaltGatePolicy.Params params;
        bool registered;
    }

    IPoolManager public immutable poolManager;
    IBellstateHub public immutable hub;

    mapping(PoolId => PoolConfig) public poolConfigs;
    mapping(address => bool) public quoteAllowlist;

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(IPoolManager poolManager_, IBellstateHub hub_, address owner_) {
        poolManager = poolManager_;
        hub = hub_;
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(OPERATOR_ROLE, owner_);
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);

        // PRD §7.4: quoteAllowlist seeded at deploy with USDT0 and USDG.
        quoteAllowlist[0x779Ded0c9e1022225f8E0630b35a9b54bE713736] = true; // USDT0
        quoteAllowlist[0x4ae46a509F6b1D9056937BA4500cb143933D2dc8] = true; // USDG
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // =========================================================================================
    // beforeInitialize — permissionless; validates dynamic fee, one hub-registered wrapped
    // pool-eligible token, and an allowlisted quote currency.
    // =========================================================================================

    function beforeInitialize(address, PoolKey calldata key, uint160) external override onlyPoolManager returns (bytes4) {
        if (key.fee != LPFeeLibrary.DYNAMIC_FEE_FLAG) revert PoolNotDynamicFee();

        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);

        (bytes32 programId, bool ok0) = _eligibleProgram(token0);
        (bytes32 programId1, bool ok1) = _eligibleProgram(token1);

        if (ok0 == ok1) revert NoEligibleToken(); // exactly one side must be hub-eligible

        address quote = ok0 ? token1 : token0;
        bytes32 winningProgram = ok0 ? programId : programId1;

        if (!quoteAllowlist[quote]) revert QuoteNotAllowlisted();

        (T.ProgramConfig memory cfg,) = hub.programInfo(winningProgram);

        PoolId id = key.toId();
        poolConfigs[id] = PoolConfig({
            programId: winningProgram,
            listingId: cfg.referenceListing,
            params: HaltGatePolicy.defaultParams(),
            registered: true
        });

        emit PoolRegistered(id, winningProgram, quote);
        return IHooks.beforeInitialize.selector;
    }

    function _eligibleProgram(address token) internal view returns (bytes32 programId, bool ok) {
        T.TokenConfig memory cfg = hub.tokenInfo(token);
        if (cfg.kind == T.KIND_WRAPPED && cfg.poolEligible) {
            return (cfg.programId, true);
        }
        return (bytes32(0), false);
    }

    // =========================================================================================
    // beforeSwap
    // =========================================================================================

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata)
        external
        override
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        PoolId id = key.toId();
        PoolConfig memory cfg = poolConfigs[id];

        T.MarketView memory m = hub.marketView(cfg.listingId);
        T.ProgramView memory p = hub.programView(cfg.programId);
        T.Resumption memory r = hub.resumptionOf(cfg.listingId);

        HaltGatePolicy.Decision memory d = HaltGatePolicy.decide(m, p, r, cfg.params, uint64(block.timestamp));

        if (d.verdict == HaltGatePolicy.Verdict.RevertProgramNotActive) revert ProgramNotActive();
        if (d.verdict == HaltGatePolicy.Verdict.RevertMarketHalted) {
            revert MarketHalted(cfg.listingId, d.interruption, d.reasonCategory, d.reasonCode, d.since, d.expectedResumption);
        }
        if (d.verdict == HaltGatePolicy.Verdict.RevertStatusUnknown) {
            revert StatusUnknown(cfg.listingId, d.unknownSince, d.degradesAt);
        }

        emit GateFee(id, d.mode, d.fee);
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, d.fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    // =========================================================================================
    // Operator: pool params and quote allowlist
    // =========================================================================================

    function setPoolParams(PoolKey calldata key, HaltGatePolicy.Params calldata params) external onlyRole(OPERATOR_ROLE) {
        _checkBounds(params);
        poolConfigs[key.toId()].params = params;
    }

    function setQuoteAllowlist(address token, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        quoteAllowlist[token] = allowed;
        emit QuoteAllowlistSet(token, allowed);
    }

    /// @dev PRD §7.4 "Bounds" table.
    function _checkBounds(HaltGatePolicy.Params calldata params) internal pure {
        uint24[6] memory fees = [
            params.feeRegular,
            params.feeExtended,
            params.feeAuction,
            params.feeClosed,
            params.feeConstrained,
            params.feeDegraded
        ];
        for (uint256 i = 0; i < fees.length; i++) {
            if (fees[i] < 100 || fees[i] > 30_000) revert ParamsOutOfBounds();
        }
        if (params.degradeAfter < 600 || params.degradeAfter > 7_200) revert ParamsOutOfBounds();
        if (params.surgeNewsRegulatoryCorporateOther > 30_000) revert ParamsOutOfBounds();
        if (params.surgeMarketWide > 30_000) revert ParamsOutOfBounds();
        if (params.surgeVolatility > 30_000) revert ParamsOutOfBounds();
        if (params.surgeNewsDuration > 3_600) revert ParamsOutOfBounds();
        if (params.surgeMarketWideDuration > 3_600) revert ParamsOutOfBounds();
        if (params.surgeVolatilityDuration > 3_600) revert ParamsOutOfBounds();
        if (params.maxFee > 50_000) revert ParamsOutOfBounds();
    }

    // =========================================================================================
    // Unused IHooks callbacks — the mined address never sets these flags, so PoolManager never
    // calls them; defined to satisfy the interface, and revert defensively if ever invoked.
    // =========================================================================================

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        revert HookNotImplemented();
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
