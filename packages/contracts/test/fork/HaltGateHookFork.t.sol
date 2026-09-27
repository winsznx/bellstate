// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/libraries/LPFeeLibrary.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

import {BellstateHub} from "../../src/BellstateHub.sol";
import {HaltGateHook} from "../../src/HaltGateHook.sol";
import {HookDeployer} from "../../src/HookDeployer.sol";
import {LendingGuard} from "../../src/LendingGuard.sol";
import {IAggregatorV3} from "../../src/interfaces/IAggregatorV3.sol";
import {BellstateTypes as T} from "../../src/libraries/BellstateTypes.sol";

/// @notice PRD §14.2 fork tests — full stack against real X Layer mainnet state: real
/// PoolManager, real wNVDAx and USDT0 balances, real sequencer feed. Run with:
///   forge test --match-contract HaltGateHookForkTest --fork-url https://rpc.xlayer.tech -vv
/// Skips gracefully (via a guard in setUp) if no fork RPC is reachable, so `forge test` without
/// --fork-url doesn't fail CI that has no network access.
contract HaltGateHookForkTest is Test {
    using PoolIdLibrary for PoolKey;

    // X Layer mainnet addresses (PRD §7.4, verified live in gate G12/G13).
    address constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant SEQUENCER_FEED = 0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9;
    address constant NVDAX_WRAPPED = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;

    BellstateHub hub;
    HaltGateHook hook;
    HookDeployer deployer;
    LendingGuard lendingGuard;
    PoolSwapTest swapRouter;
    PoolModifyLiquidityTest modifyLiquidityRouter;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");

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
        // Requires --fork-url; skip cleanly otherwise instead of failing the default `forge test` run.
        if (block.chainid != 196) {
            vm.skip(true);
            return;
        }

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

        hub = new BellstateHub(owner, operator, signers, 2, 1, ages);

        vm.prank(operator);
        listingId = hub.registerListing(bytes32("XNAS"), bytes16("NVDAx"), T.DOMAIN_US_MARKETS);
        bytes32[] memory home = new bytes32[](0);
        vm.prank(operator);
        programId = hub.registerProgram("xstocks:NVDAx", listingId, home, false);

        vm.prank(owner);
        hub.grantOperator(address(this));
        hub.registerToken(NVDAX_WRAPPED, programId, T.KIND_WRAPPED, true, address(0x1));

        deployer = new HookDeployer();
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory creationCode =
            abi.encodePacked(type(HaltGateHook).creationCode, abi.encode(IPoolManager(POOL_MANAGER), hub, owner));
        (address hookAddr, bytes32 salt) = _mine(address(deployer), flags, creationCode);
        deployer.deploy(salt, creationCode);
        hook = HaltGateHook(hookAddr);

        lendingGuard = new LendingGuard(hub, IAggregatorV3(SEQUENCER_FEED));

        swapRouter = new PoolSwapTest(IPoolManager(POOL_MANAGER));
        modifyLiquidityRouter = new PoolModifyLiquidityTest(IPoolManager(POOL_MANAGER));

        _submitProgram(2 /* ACTIVE */, 1 /* NORMAL */);
        _submitMarket(1 /* REGULAR */, 1 /* NONE */, 0, bytes8(0));

        // Real balances via storage manipulation (deal). Dealt generously: at sqrtPriceX96 = 1.0
        // (an arbitrary 1:1 price, not NVDAx's real market price) a narrow tick range demands a
        // lopsided amount of whichever token is "expensive" at that price, so both sides are
        // overfunded rather than trying to model a realistic price.
        deal(NVDAX_WRAPPED, address(this), 1_000_000e18);
        deal(USDT0, address(this), 100_000_000e6);

        // CurrencySettler.settle does transferFrom(payer=this, manager, amount), so approving the
        // manager is the documented requirement — but the real, live USDT0 contract on X Layer
        // (an upgradeable proxy) rejected transferFrom with "exceeds allowance" even with the
        // manager approved for type(uint256).max; isolating the failure against real fork state
        // showed it only succeeds once the calling router is *also* approved directly. Approving
        // both the manager and every router this test uses is the empirically verified fix.
        address[3] memory spenders = [POOL_MANAGER, address(swapRouter), address(modifyLiquidityRouter)];
        for (uint256 i = 0; i < spenders.length; i++) {
            IERC20Minimal(NVDAX_WRAPPED).approve(spenders[i], type(uint256).max);
            IERC20Minimal(USDT0).approve(spenders[i], type(uint256).max);
        }
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
        (Currency c0, Currency c1) = NVDAX_WRAPPED < USDT0
            ? (Currency.wrap(NVDAX_WRAPPED), Currency.wrap(USDT0))
            : (Currency.wrap(USDT0), Currency.wrap(NVDAX_WRAPPED));
        return PoolKey({currency0: c0, currency1: c1, fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, tickSpacing: 60, hooks: hook});
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Bellstate")),
                keccak256(bytes("1")),
                block.chainid,
                address(hub)
            )
        );
    }

    function _sortedSigs(bytes32 structHash) internal view returns (bytes[] memory sigs) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
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

    function _submitProgram(uint8 lifecycle, uint8 programStatus) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.ProgramUpdate memory u = T.ProgramUpdate({
            programId: programId,
            seq: hub.programView(programId).seq + 1,
            epoch: epoch,
            lifecycle: lifecycle,
            programStatus: programStatus,
            programReason: 0
        });
        bytes32 structHash =
            keccak256(abi.encode(PROGRAM_UPDATE_TYPEHASH, u.programId, u.seq, u.epoch, u.lifecycle, u.programStatus, u.programReason));
        bytes[] memory sigs = _sortedSigs(structHash);
        T.ProgramUpdate[] memory updates = new T.ProgramUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitProgramUpdates(updates, sigsArr);
    }

    function _submitMarket(uint8 session, uint8 interruption, uint8 reasonCategory, bytes8 reasonCode) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.MarketUpdate memory u = T.MarketUpdate({
            listingId: listingId,
            seq: hub.marketView(listingId).seq + 1,
            epoch: epoch,
            session: session,
            interruption: interruption,
            reasonCategory: reasonCategory,
            reasonCode: reasonCode,
            sessionSince: uint64(block.timestamp),
            interruptionSince: interruption == 3 || interruption == 4 ? uint64(block.timestamp) : 0,
            nextScheduledTransition: uint64(block.timestamp) + 3600,
            expectedResumption: 0,
            calendarVersion: 1
        });
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
        bytes[] memory sigs = _sortedSigs(structHash);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function _initAndSeedPool() internal returns (PoolKey memory key) {
        key = _poolKey();
        IPoolManager(POOL_MANAGER).initialize(key, 79228162514264337593543950336);

        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: 1e10, salt: bytes32(0)}),
            ""
        );
    }

    function test_fork_beforeInitialize_onRealPoolManager() public {
        if (block.chainid != 196) return;
        PoolKey memory key = _initAndSeedPool();
        (bytes32 pid,,, bool registered) = hook.poolConfigs(key.toId());
        assertTrue(registered);
        assertEq(pid, programId);
    }

    function test_fork_swap_regularSession_succeeds() public {
        if (block.chainid != 196) return;
        PoolKey memory key = _initAndSeedPool();

        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e10, sqrtPriceLimitX96: 4295128740}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        // No revert => real PoolManager accepted the hook's dynamic fee override in REGULAR mode.
    }

    function test_fork_swap_haltedMarket_reverts() public {
        if (block.chainid != 196) return;
        PoolKey memory key = _initAndSeedPool();
        _submitMarket(1, 3 /* ASSET_HALTED */, 1, bytes8("T1"));

        vm.expectRevert();
        swapRouter.swap(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -1e10, sqrtPriceLimitX96: 4295128740}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    /// @dev PRD §14.2: "remove liquidity during a halt" must never be blocked by the hook.
    function test_fork_removeLiquidity_duringHalt_neverBlocked() public {
        if (block.chainid != 196) return;
        PoolKey memory key = _initAndSeedPool();
        _submitMarket(1, 3 /* ASSET_HALTED */, 1, bytes8("T1"));

        // Removing liquidity (negative delta) must succeed even while the market is halted,
        // because HaltGateHook has no beforeRemoveLiquidity/afterRemoveLiquidity permission set.
        modifyLiquidityRouter.modifyLiquidity(
            key,
            ModifyLiquidityParams({tickLower: -600, tickUpper: 600, liquidityDelta: -1e9, salt: bytes32(0)}),
            ""
        );
    }

    function test_fork_lendingGuard_realSequencerFeed() public view {
        if (block.chainid != 196) return;
        // Just confirms the real feed answers and the guard doesn't revert reading it.
        (bool ok, uint8 reason,) = lendingGuard.canLiquidate(NVDAX_WRAPPED, 0);
        // No assertion on ok/reason value (depends on live market state at fork time) — the
        // guarantee under test is that a real external call to the live feed doesn't revert.
        ok; reason;
    }
}
