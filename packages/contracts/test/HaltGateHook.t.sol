// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";

import {BellstateHub} from "../src/BellstateHub.sol";
import {HaltGateHook} from "../src/HaltGateHook.sol";
import {HookDeployer} from "../src/HookDeployer.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";
import {HaltGatePolicy} from "../src/libraries/HaltGatePolicy.sol";

contract HaltGateHookTest is Test {
    using PoolIdLibrary for PoolKey;

    BellstateHub hub;
    PoolManager manager;
    HaltGateHook hook;
    HookDeployer deployer;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address wrappedToken;
    address quoteToken = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736; // USDT0, pre-allowlisted

    uint256 signerAKey = 0xA11CE;
    uint256 signerBKey = 0xB0B;
    address signerA;
    address signerB;

    bytes32 listingId;
    bytes32 programId;

    bytes32 constant MARKET_UPDATE_TYPEHASH = keccak256(
        "MarketUpdate(bytes32 listingId,uint32 seq,uint64 epoch,uint8 session,uint8 interruption,uint8 reasonCategory,bytes8 reasonCode,uint64 sessionSince,uint64 interruptionSince,uint64 nextScheduledTransition,uint64 expectedResumption,uint32 calendarVersion)"
    );
    bytes32 constant PROGRAM_UPDATE_TYPEHASH =
        keccak256("ProgramUpdate(bytes32 programId,uint32 seq,uint64 epoch,uint8 lifecycle,uint8 programStatus,uint8 programReason)");

    function setUp() public {
        signerA = vm.addr(signerAKey);
        signerB = vm.addr(signerBKey);
        address signerC = makeAddr("signerC");

        address[] memory signers = new address[](3);
        signers[0] = signerA;
        signers[1] = signerB;
        signers[2] = signerC;

        T.MaxAges memory ages = T.MaxAges({
            marketOpen: 180,
            marketClosed: 1800,
            program: 1800,
            primary: 900,
            valuationLive: 180,
            valuationIdle: 1800
        });

        vm.warp(1_000_000);
        hub = new BellstateHub(owner, operator, signers, 2, 1, ages);

        vm.prank(operator);
        listingId = hub.registerListing(bytes32("XNAS"), bytes16("NVDAx"), T.DOMAIN_US_MARKETS);
        bytes32[] memory home = new bytes32[](0);
        vm.prank(operator);
        programId = hub.registerProgram("NVDAx", listingId, home, false);

        manager = new PoolManager(address(this));

        // Mine a hook address with exactly the beforeInitialize + beforeSwap flags via HookDeployer.
        deployer = new HookDeployer();
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory creationCode =
            abi.encodePacked(type(HaltGateHook).creationCode, abi.encode(manager, hub, owner));
        (address hookAddr, bytes32 salt) = _mine(address(deployer), flags, creationCode);
        deployer.deploy(salt, creationCode);
        hook = HaltGateHook(hookAddr);

        wrappedToken = makeAddr("nvdaxWrapped");
        vm.etch(wrappedToken, hex"00"); // give it code so Currency treats it as a token address consistently

        vm.prank(owner);
        hub.grantOperator(address(this));
        hub.registerToken(wrappedToken, programId, T.KIND_WRAPPED, true, address(0x1));

        _submitProgram(2 /* ACTIVE */, 1 /* NORMAL */);
    }

    function _submitProgram(uint8 lifecycle, uint8 programStatus) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.ProgramUpdate memory u = T.ProgramUpdate({
            programId: programId,
            seq: 1,
            epoch: epoch,
            lifecycle: lifecycle,
            programStatus: programStatus,
            programReason: 0
        });
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Bellstate")),
                keccak256(bytes("1")),
                block.chainid,
                address(hub)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(PROGRAM_UPDATE_TYPEHASH, u.programId, u.seq, u.epoch, u.lifecycle, u.programStatus, u.programReason)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address[2] memory addrs = [signerA, signerB];
        uint256[2] memory keys = [signerAKey, signerBKey];
        if (addrs[1] < addrs[0]) {
            (addrs[0], addrs[1]) = (addrs[1], addrs[0]);
            (keys[0], keys[1]) = (keys[1], keys[0]);
        }
        bytes[] memory sigs = new bytes[](2);
        for (uint256 i = 0; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }

        T.ProgramUpdate[] memory updates = new T.ProgramUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitProgramUpdates(updates, sigsArr);
    }

    function _mine(address deployerAddr, uint160 flags, bytes memory creationCodeWithArgs)
        internal
        view
        returns (address, bytes32)
    {
        uint160 mask = Hooks.ALL_HOOK_MASK;
        for (uint256 salt; salt < 200_000; salt++) {
            address candidate = address(
                uint160(
                    uint256(
                        keccak256(abi.encodePacked(bytes1(0xFF), deployerAddr, bytes32(salt), keccak256(creationCodeWithArgs)))
                    )
                )
            );
            if (uint160(candidate) & mask == flags && candidate.code.length == 0) {
                return (candidate, bytes32(salt));
            }
        }
        revert("mining failed");
    }

    function _poolKey() internal view returns (PoolKey memory) {
        (Currency c0, Currency c1) = wrappedToken < quoteToken
            ? (Currency.wrap(wrappedToken), Currency.wrap(quoteToken))
            : (Currency.wrap(quoteToken), Currency.wrap(wrappedToken));
        return PoolKey({
            currency0: c0,
            currency1: c1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: hook
        });
    }

    function _initPool() internal returns (PoolKey memory key) {
        key = _poolKey();
        manager.initialize(key, 79228162514264337593543950336); // sqrtPriceX96 = 1.0
    }

    function _signAndSort(T.MarketUpdate memory u) internal view returns (bytes[] memory sigs) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Bellstate")),
                keccak256(bytes("1")),
                block.chainid,
                address(hub)
            )
        );
        bytes32 structHash = keccak256(
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
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        address[2] memory addrs = [signerA, signerB];
        uint256[2] memory keys = [signerAKey, signerBKey];
        if (addrs[1] < addrs[0]) {
            (addrs[0], addrs[1]) = (addrs[1], addrs[0]);
            (keys[0], keys[1]) = (keys[1], keys[0]);
        }
        sigs = new bytes[](2);
        for (uint256 i = 0; i < 2; i++) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            sigs[i] = abi.encodePacked(r, s, v);
        }
    }

    function _submitMarket(uint8 session, uint8 interruption, uint8 reasonCategory) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.MarketUpdate memory u = T.MarketUpdate({
            listingId: listingId,
            seq: hub.marketView(listingId).seq + 1,
            epoch: epoch,
            session: session,
            interruption: interruption,
            reasonCategory: reasonCategory,
            reasonCode: bytes8("T1"),
            sessionSince: uint64(block.timestamp),
            interruptionSince: interruption == 3 || interruption == 4 ? uint64(block.timestamp) : 0,
            nextScheduledTransition: uint64(block.timestamp) + 3600,
            expectedResumption: 0,
            calendarVersion: 1
        });
        bytes[] memory sigs = _signAndSort(u);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function test_beforeInitialize_registersPool() public {
        PoolKey memory key = _initPool();
        (bytes32 pid,,, bool registered) = hook.poolConfigs(key.toId());
        assertTrue(registered);
        assertEq(pid, programId);
    }

    function test_beforeInitialize_revertsOnStaticFee() public {
        PoolKey memory key = _poolKey();
        key.fee = 3000; // static fee, not DYNAMIC_FEE_FLAG
        vm.expectRevert();
        manager.initialize(key, 79228162514264337593543950336);
    }

    function test_swap_regularSession_appliesRegularFee() public {
        PoolKey memory key = _initPool();
        _submitMarket(1 /* REGULAR */, 1 /* NONE */, 0);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 4295128740});

        vm.prank(address(manager));
        (, , uint24 fee) = hook.beforeSwap(address(this), key, params, "");
        assertEq(fee & LPFeeLibrary.REMOVE_OVERRIDE_MASK, 1000); // REGULAR default fee (10 bps)
    }

    function test_swap_haltedMarket_reverts() public {
        PoolKey memory key = _initPool();
        _submitMarket(1, 3 /* ASSET_HALTED */, 1 /* NEWS */);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 4295128740});
        vm.prank(address(manager));
        vm.expectRevert(
            abi.encodeWithSelector(
                HaltGateHook.MarketHalted.selector, listingId, uint8(3), uint8(1), bytes8("T1"), uint64(block.timestamp), uint64(0)
            )
        );
        hook.beforeSwap(address(this), key, params, "");
    }

    function test_swap_closedSession_higherFeeThanRegular() public {
        PoolKey memory key = _initPool();
        _submitMarket(4 /* CLOSED */, 1 /* NONE */, 0);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 4295128740});
        vm.prank(address(manager));
        (, , uint24 fee) = hook.beforeSwap(address(this), key, params, "");
        assertEq(fee & LPFeeLibrary.REMOVE_OVERRIDE_MASK, 5000); // CLOSED default fee
    }

    function test_swap_unknownWithinGrace_reverts() public {
        PoolKey memory key = _initPool();
        _submitMarket(1 /* REGULAR */, 1 /* NONE */, 0);

        // REGULAR session => marketOpen maxAge = 180s. Warp just past maxAge (now stale/UNKNOWN)
        // but well within degradeAfter (1800s) of going stale => must revert StatusUnknown.
        vm.warp(block.timestamp + 200);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 4295128740});
        vm.prank(address(manager));
        vm.expectRevert(); // StatusUnknown(listingId, unknownSince, degradesAt)
        hook.beforeSwap(address(this), key, params, "");
    }

    function test_swap_unknownPastDegradeAfter_allowsWithDegradedFee() public {
        PoolKey memory key = _initPool();
        _submitMarket(1 /* REGULAR */, 1 /* NONE */, 0);

        // Past maxAge (180s) AND past degradeAfter (1800s) from when it went stale.
        vm.warp(block.timestamp + 180 + 1800 + 1);

        SwapParams memory params = SwapParams({zeroForOne: true, amountSpecified: -1, sqrtPriceLimitX96: 4295128740});
        vm.prank(address(manager));
        (, , uint24 fee) = hook.beforeSwap(address(this), key, params, "");
        assertEq(fee & LPFeeLibrary.REMOVE_OVERRIDE_MASK, 10_000); // DEGRADED default fee (1.00%)
    }

    function test_setPoolParams_rejectsOutOfBoundsFee() public {
        PoolKey memory key = _initPool();
        HaltGatePolicy.Params memory params = HaltGatePolicy.defaultParams();
        params.feeRegular = 50; // below 100 pip floor

        vm.prank(owner);
        vm.expectRevert(HaltGateHook.ParamsOutOfBounds.selector);
        hook.setPoolParams(key, params);
    }

    function test_liquidityHooksNotSet() public view {
        Hooks.Permissions memory perms = hook.getHookPermissions();
        assertTrue(perms.beforeInitialize);
        assertTrue(perms.beforeSwap);
        assertFalse(perms.beforeAddLiquidity);
        assertFalse(perms.afterAddLiquidity);
        assertFalse(perms.beforeRemoveLiquidity);
        assertFalse(perms.afterRemoveLiquidity);
    }
}
