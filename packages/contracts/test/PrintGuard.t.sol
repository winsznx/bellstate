// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BellstateHub} from "../src/BellstateHub.sol";
import {PrintGuard} from "../src/PrintGuard.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";

contract PrintGuardTest is Test {
    BellstateHub hub;
    PrintGuard guard;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");

    uint256 signerAKey = 0xA11CE;
    uint256 signerBKey = 0xB0B;
    address signerA;
    address signerB;

    bytes32 nxteListingId; // secondary venue (Nextrade)
    bytes32 xkrxListingId; // primary venue (KRX)

    bytes32 constant MARKET_UPDATE_TYPEHASH = keccak256(
        "MarketUpdate(bytes32 listingId,uint32 seq,uint64 epoch,uint8 session,uint8 interruption,uint8 reasonCategory,bytes8 reasonCode,uint64 sessionSince,uint64 interruptionSince,uint64 nextScheduledTransition,uint64 expectedResumption,uint32 calendarVersion)"
    );

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

        // Jul 28, 2026 08:00:02 KST == Jul 27, 2026 23:00:02 UTC.
        vm.warp(1785196802);
        hub = new BellstateHub(owner, operator, signers, 2, 1, ages);

        vm.prank(operator);
        nxteListingId = hub.registerListing(bytes32("NXTE"), bytes16("000660"), T.DOMAIN_KR_MARKETS);
        vm.prank(operator);
        xkrxListingId = hub.registerListing(bytes32("XKRX"), bytes16("000660"), T.DOMAIN_KR_MARKETS);

        guard = new PrintGuard(hub);
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

    function _submitMarket(bytes32 listingId, uint8 session, uint8 interruption, uint64 sessionSince) internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.MarketUpdate memory u = T.MarketUpdate({
            listingId: listingId,
            seq: hub.marketView(listingId).seq + 1,
            epoch: epoch,
            session: session,
            interruption: interruption,
            reasonCategory: 0,
            reasonCode: bytes8(0),
            sessionSince: sessionSince,
            interruptionSince: 0,
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

    /// @dev PRD §7.6 worked example: Jul 28 08:00:02 KST, NXTE EXTENDED + FIRST_MINUTE,
    /// XKRX CLOSED => REJECT.
    function test_worked_example_skHynix_secondaryReject() public {
        uint64 printTs = uint64(block.timestamp);
        // NXTE pre-market session started exactly at printTs - 2s (within FIRST_MINUTE window).
        _submitMarket(nxteListingId, 2 /* EXTENDED */, 1 /* NONE */, printTs - 2);
        // XKRX is closed (KRX doesn't open until 09:00 KST).
        _submitMarket(xkrxListingId, 4 /* CLOSED */, 1 /* NONE */, printTs - 3600);

        (uint8 verdict,) = guard.checkSecondaryPrint(nxteListingId, xkrxListingId, printTs);
        assertEq(verdict, 3 /* REJECT */); // FIRST_MINUTE + PRIMARY_NOT_REGULAR both set
    }

    function test_checkPrint_regularSession_accepts() public {
        uint64 printTs = uint64(block.timestamp);
        _submitMarket(nxteListingId, 1 /* REGULAR */, 1 /* NONE */, printTs - 3600);

        (uint8 verdict, uint16 flags,,) = guard.checkPrint(nxteListingId, printTs);
        assertEq(verdict, 1 /* ACCEPT */);
        assertEq(flags, 0);
    }

    function test_checkPrint_venueHalted_rejects() public {
        uint64 printTs = uint64(block.timestamp);
        _submitMarket(nxteListingId, 1, 3 /* ASSET_HALTED */, printTs - 3600);

        (uint8 verdict,,,) = guard.checkPrint(nxteListingId, printTs);
        assertEq(verdict, 3 /* REJECT */);
    }

    function test_checkPrint_venueClosed_rejects() public {
        uint64 printTs = uint64(block.timestamp);
        _submitMarket(nxteListingId, 4 /* CLOSED */, 1, printTs - 3600);

        (uint8 verdict,,,) = guard.checkPrint(nxteListingId, printTs);
        assertEq(verdict, 3 /* REJECT */);
    }

    function test_checkPrint_extendedSession_flags() public {
        uint64 printTs = uint64(block.timestamp);
        _submitMarket(nxteListingId, 2 /* EXTENDED */, 1, printTs - 3600); // well past FIRST_MINUTE

        (uint8 verdict, uint16 flags,,) = guard.checkPrint(nxteListingId, printTs);
        assertEq(verdict, 2 /* FLAG */);
        assertTrue(flags & (1 << 2) != 0); // VENUE_EXTENDED
    }

    function test_checkPrint_outOfHistory_unknown() public view {
        uint64 farPast = uint64(block.timestamp) - 100_000;
        (uint8 verdict, uint16 flags,,) = guard.checkPrint(nxteListingId, farPast);
        assertEq(verdict, 0 /* UNKNOWN */);
        assertTrue(flags & (1 << 7) != 0); // OUT_OF_HISTORY
    }

    function test_checkPrint_futureTs_rejects() public {
        _submitMarket(nxteListingId, 1, 1, uint64(block.timestamp) - 3600);
        uint64 future = uint64(block.timestamp) + 1000;

        (uint8 verdict,,,) = guard.checkPrint(nxteListingId, future);
        assertEq(verdict, 3 /* REJECT */);
    }
}
