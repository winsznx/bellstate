// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BellstateHub} from "../src/BellstateHub.sol";
import {LendingGuard} from "../src/LendingGuard.sol";
import {MockSequencerFeed} from "./mocks/MockSequencerFeed.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";
import {LendingPolicy} from "../src/libraries/LendingPolicy.sol";

contract LendingGuardTest is Test {
    BellstateHub hub;
    LendingGuard guard;
    MockSequencerFeed feed;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address token = makeAddr("nvdaxRaw");

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

        vm.warp(10_000_000);
        hub = new BellstateHub(owner, operator, signers, 2, 1, ages);

        vm.prank(operator);
        listingId = hub.registerListing(bytes32("XNAS"), bytes16("NVDAx"), T.DOMAIN_US_MARKETS);
        bytes32[] memory home = new bytes32[](0);
        vm.prank(operator);
        programId = hub.registerProgram("NVDAx", listingId, home, false);

        vm.prank(owner);
        hub.grantOperator(address(this));
        hub.registerToken(token, programId, T.KIND_RAW, false, address(0x1));

        // Sequencer up for well over the 3600s grace period.
        feed = new MockSequencerFeed(0, block.timestamp - 7200);
        guard = new LendingGuard(hub, feed);

        _submitProgram(2 /* ACTIVE */, 1 /* NORMAL */);
        _submitMarket(1 /* REGULAR */, 1 /* NONE */);
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

    function _submitMarket(uint8 session, uint8 interruption) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.MarketUpdate memory u = T.MarketUpdate({
            listingId: listingId,
            seq: hub.marketView(listingId).seq + 1,
            epoch: epoch,
            session: session,
            interruption: interruption,
            reasonCategory: 0,
            reasonCode: bytes8(0),
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

    function test_canLiquidate_strict_regularSession_ok() public view {
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 0 /* STRICT */);
        assertTrue(ok);
        assertEq(reason, 0 /* OK */);
    }

    function test_canLiquidate_sequencerDown_blocks() public {
        feed.set(1, block.timestamp); // down
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 0);
        assertFalse(ok);
        assertEq(reason, 1 /* SEQUENCER_DOWN */);
    }

    function test_canLiquidate_sequencerGrace_blocks() public {
        feed.set(0, block.timestamp - 100); // up but within grace (< 3600s)
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 0);
        assertFalse(ok);
        assertEq(reason, 2 /* SEQUENCER_GRACE */);
    }

    function test_canLiquidate_strict_blocksInExtendedSession() public {
        _submitMarket(2 /* EXTENDED */, 1 /* NONE */);
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 0 /* STRICT */);
        assertFalse(ok);
        assertEq(reason, 8 /* SESSION */);
    }

    function test_canLiquidate_extended_allowsExtendedSession() public {
        _submitMarket(2 /* EXTENDED */, 1 /* NONE */);
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 1 /* EXTENDED profile */);
        assertTrue(ok);
        assertEq(reason, 0);
    }

    function test_canLiquidate_haltOnly_blocksOnHalt() public {
        _submitMarket(1, 3 /* ASSET_HALTED */);
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 2 /* HALT_ONLY */);
        assertFalse(ok);
        assertEq(reason, 6 /* HALTED */);
    }

    function test_canLiquidate_haltOnly_allowsClosedSession() public {
        _submitMarket(4 /* CLOSED */, 1 /* NONE */);
        (bool ok, uint8 reason,) = guard.canLiquidate(token, 2 /* HALT_ONLY */);
        assertTrue(ok);
        assertEq(reason, 0);
    }

    function test_maxLtvBps_regular_returnsBase() public view {
        uint16 ltv = guard.maxLtvBps(token, 8000);
        assertEq(ltv, 8000);
    }

    function test_maxLtvBps_closedSession_reducesBy1000() public {
        _submitMarket(4 /* CLOSED */, 1);
        uint16 ltv = guard.maxLtvBps(token, 8000);
        assertEq(ltv, 7000);
    }

    function test_maxLtvBps_halted_returnsZero() public {
        _submitMarket(1, 3 /* ASSET_HALTED */);
        uint16 ltv = guard.maxLtvBps(token, 8000);
        assertEq(ltv, 0);
    }

    function test_assertDigest_revertsOnChange() public {
        bytes32 before = guard.statusDigest(token);
        _submitMarket(4 /* CLOSED */, 1);
        vm.expectRevert(abi.encodeWithSelector(LendingGuard.StatusChanged.selector, before, guard.statusDigest(token)));
        guard.assertDigest(token, before);
    }
}
