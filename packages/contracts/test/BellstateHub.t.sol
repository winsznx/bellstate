// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BellstateHub} from "../src/BellstateHub.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";
import {IBellstateHub} from "../src/interfaces/IBellstateHub.sol";

contract BellstateHubTest is Test {
    BellstateHub hub;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");

    uint256 signerAKey = 0xA11CE;
    uint256 signerBKey = 0xB0B;
    uint256 signerCKey = 0xC0FFEE;
    address signerA;
    address signerB;
    address signerC;

    bytes32 listingId;
    bytes32 programId;

    bytes32 constant MARKET_UPDATE_TYPEHASH = keccak256(
        "MarketUpdate(bytes32 listingId,uint32 seq,uint64 epoch,uint8 session,uint8 interruption,uint8 reasonCategory,bytes8 reasonCode,uint64 sessionSince,uint64 interruptionSince,uint64 nextScheduledTransition,uint64 expectedResumption,uint32 calendarVersion)"
    );

    function setUp() public {
        signerA = vm.addr(signerAKey);
        signerB = vm.addr(signerBKey);
        signerC = vm.addr(signerCKey);
        // Ensure ascending order for signature-sort tests convenience isn't required here;
        // hub sorts by recovered address at call time regardless of key order.

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

    function _signMarketUpdate(T.MarketUpdate memory u, uint256 key) internal view returns (bytes memory) {
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
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sortedQuorumSigs(T.MarketUpdate memory u) internal view returns (bytes[] memory) {
        // Sign with all three, then sort by recovered address ascending (hub requirement).
        address[3] memory addrs = [signerA, signerB, signerC];
        uint256[3] memory keys = [signerAKey, signerBKey, signerCKey];

        // simple bubble sort by address
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = i + 1; j < 3; j++) {
                if (addrs[j] < addrs[i]) {
                    (addrs[i], addrs[j]) = (addrs[j], addrs[i]);
                    (keys[i], keys[j]) = (keys[j], keys[i]);
                }
            }
        }
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _signMarketUpdate(u, keys[0]);
        sigs[1] = _signMarketUpdate(u, keys[1]);
        return sigs;
    }

    function _baseMarketUpdate() internal view returns (T.MarketUpdate memory) {
        uint64 epoch = uint64(block.timestamp) / 15;
        return T.MarketUpdate({
            listingId: listingId,
            seq: 1,
            epoch: epoch,
            session: 1, // REGULAR
            interruption: 1, // NONE
            reasonCategory: 0,
            reasonCode: bytes8(0),
            sessionSince: uint64(block.timestamp),
            interruptionSince: 0,
            nextScheduledTransition: uint64(block.timestamp) + 3600,
            expectedResumption: 0,
            calendarVersion: 1
        });
    }

    function test_marketUpdate_quorumAccepted() public {
        T.MarketUpdate memory u = _baseMarketUpdate();
        bytes[] memory sigs = _sortedQuorumSigs(u);

        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;

        hub.submitMarketUpdates(updates, sigsArr);

        T.MarketView memory v = hub.marketView(listingId);
        assertEq(v.session, 1);
        assertEq(v.interruption, 1);
        assertFalse(v.stale);
    }

    function test_marketUpdate_revertsOnStaleSeq() public {
        T.MarketUpdate memory u = _baseMarketUpdate();
        u.seq = 2; // expected 1
        bytes[] memory sigs = _sortedQuorumSigs(u);

        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;

        vm.expectRevert(abi.encodeWithSelector(IBellstateHub.StaleSeq.selector, listingId, uint32(1), uint32(2)));
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function test_marketUpdate_revertsWithoutQuorum() public {
        T.MarketUpdate memory u = _baseMarketUpdate();
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _signMarketUpdate(u, signerAKey);

        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;

        vm.expectRevert();
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function test_marketView_goesUnknownAfterMaxAge() public {
        T.MarketUpdate memory u = _baseMarketUpdate();
        bytes[] memory sigs = _sortedQuorumSigs(u);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitMarketUpdates(updates, sigsArr);

        // REGULAR session => marketOpen maxAge = 180s
        vm.warp(block.timestamp + 181);
        T.MarketView memory v = hub.marketView(listingId);
        assertEq(v.session, 0); // UNKNOWN
        assertTrue(v.stale);
    }

    function test_freeze_blocksSubmission() public {
        vm.prank(owner);
        hub.freeze(3600);

        T.MarketUpdate memory u = _baseMarketUpdate();
        bytes[] memory sigs = _sortedQuorumSigs(u);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;

        vm.expectRevert(abi.encodeWithSelector(IBellstateHub.HubFrozen.selector, block.timestamp + 3600));
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function test_setSigners_rejectsQuorumAboveActiveCount() public {
        address[] memory addNone = new address[](0);
        address[] memory removeNone = new address[](0);
        vm.prank(owner);
        vm.expectRevert(IBellstateHub.InvalidQuorum.selector);
        hub.setSigners(addNone, removeNone, 4);
    }

    function test_onlyOperator_canRegisterListing() public {
        vm.expectRevert();
        hub.registerListing(bytes32("XHKG"), bytes16("TCENTx"), T.DOMAIN_HK_MARKETS);
    }

    function test_transitionHistory_recordsAppended() public {
        T.MarketUpdate memory u = _baseMarketUpdate();
        bytes[] memory sigs = _sortedQuorumSigs(u);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitMarketUpdates(updates, sigsArr);

        T.Transition[] memory hist = hub.historyOf(listingId);
        assertEq(hist.length, 1);
        assertEq(hist[0].session, 1);
    }
}
