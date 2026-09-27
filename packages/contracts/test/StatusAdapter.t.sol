// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BellstateHub} from "../src/BellstateHub.sol";
import {StatusAdapter} from "../src/StatusAdapter.sol";
import {AdapterFactory} from "../src/AdapterFactory.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";
import {IAssetStatus} from "../src/interfaces/IAssetStatus.sol";
import {IReferenceMarketStatus} from "../src/interfaces/IReferenceMarketStatus.sol";
import {IAssetPrimaryStatus} from "../src/interfaces/IAssetPrimaryStatus.sol";
import {IReferenceValuationStatus} from "../src/interfaces/IReferenceValuationStatus.sol";

contract StatusAdapterTest is Test {
    BellstateHub hub;
    StatusAdapter implementation;
    AdapterFactory factory;

    address owner = makeAddr("owner");
    address operator = makeAddr("operator");
    address token = makeAddr("nvdaxWrapped");

    uint256 signerAKey = 0xA11CE;
    uint256 signerBKey = 0xB0B;
    address signerA;
    address signerB;

    bytes32 listingId;
    bytes32 programId;

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

        vm.warp(1_000_000);
        hub = new BellstateHub(owner, operator, signers, 2, 1, ages);

        vm.prank(operator);
        listingId = hub.registerListing(bytes32("XNAS"), bytes16("NVDAx"), T.DOMAIN_US_MARKETS);

        bytes32[] memory home = new bytes32[](0);
        vm.prank(operator);
        programId = hub.registerProgram("NVDAx", listingId, home, false);

        implementation = new StatusAdapter();
        factory = new AdapterFactory(address(hub), address(implementation), owner);

        vm.prank(owner);
        hub.grantOperator(address(factory));
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

    function _submitMarketUpdate() internal {
        uint64 epoch = uint64(block.timestamp) / 15;
        T.MarketUpdate memory u = T.MarketUpdate({
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
        bytes[] memory sigs = _signAndSort(u);
        T.MarketUpdate[] memory updates = new T.MarketUpdate[](1);
        updates[0] = u;
        bytes[][] memory sigsArr = new bytes[][](1);
        sigsArr[0] = sigs;
        hub.submitMarketUpdates(updates, sigsArr);
    }

    function test_deployAdapter_registersInHub() public {
        vm.prank(owner);
        address adapter = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);

        T.TokenConfig memory cfg = hub.tokenInfo(token);
        assertEq(cfg.adapter, adapter);
        assertEq(cfg.programId, programId);
        assertEq(cfg.kind, T.KIND_WRAPPED);
        assertTrue(cfg.poolEligible);
    }

    function test_adapter_referenceMarketStatus_reflectsHub() public {
        vm.prank(owner);
        address adapterAddr = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);
        StatusAdapter adapter = StatusAdapter(adapterAddr);

        _submitMarketUpdate();

        (
            IReferenceMarketStatus.Session session,
            IReferenceMarketStatus.Interruption interruption,
            ,
            ,
            ,
            bytes32 marketId
        ) = adapter.referenceMarketStatus();

        assertEq(uint8(session), 1); // REGULAR
        assertEq(uint8(interruption), 1); // NONE
        assertEq(marketId, bytes32("XNAS"));
    }

    function test_adapter_referenceMarketStatus_goesUnknownWhenStale() public {
        vm.prank(owner);
        address adapterAddr = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);
        StatusAdapter adapter = StatusAdapter(adapterAddr);

        _submitMarketUpdate();
        vm.warp(block.timestamp + 200); // past marketOpen maxAge (180s)

        (IReferenceMarketStatus.Session session, IReferenceMarketStatus.Interruption interruption,,,,) =
            adapter.referenceMarketStatus();

        assertEq(uint8(session), 0); // UNKNOWN
        assertEq(uint8(interruption), 0); // UNKNOWN
    }

    function test_adapter_neverReverts_evenForUnregisteredProgram() public {
        // Deploy an adapter for a programId that was never registered in the hub.
        vm.prank(owner);
        address adapterAddr = factory.deployAdapter(token, bytes32("ghost"), T.KIND_RAW, false);
        StatusAdapter adapter = StatusAdapter(adapterAddr);

        // Must not revert; must degrade to UNKNOWN/zero.
        (IAssetStatus.Lifecycle lifecycle, IAssetStatus.ProgramStatus programStatus,,) = adapter.assetStatus();
        assertEq(uint8(lifecycle), 0);
        assertEq(uint8(programStatus), 0);

        (IReferenceMarketStatus.Session session,,,,,) = adapter.referenceMarketStatus();
        assertEq(uint8(session), 0);
    }

    function test_adapter_supportsInterface() public {
        vm.prank(owner);
        address adapterAddr = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);
        StatusAdapter adapter = StatusAdapter(adapterAddr);

        assertTrue(adapter.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(adapter.supportsInterface(0xfecd6b9b)); // IAssetStatus
        assertTrue(adapter.supportsInterface(0xfe1d1980)); // IReferenceMarketStatus (has reference listing)
        assertFalse(adapter.supportsInterface(0x4ba96385)); // IAssetPrimaryStatus (hasPrimary = false)
        assertFalse(adapter.supportsInterface(0x7d9b41ad)); // IReferenceValuationStatus (hasValuation = false)
    }

    function test_adapter_gasCeiling_50000PerView() public {
        vm.prank(owner);
        address adapterAddr = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);
        StatusAdapter adapter = StatusAdapter(adapterAddr);
        _submitMarketUpdate();

        uint256 gasBefore = gasleft();
        adapter.referenceMarketStatus();
        uint256 used = gasBefore - gasleft();
        assertLt(used, 50_000);
    }

    function test_predict_matchesDeployedAddress() public {
        address predicted = factory.predict(token);
        vm.prank(owner);
        address deployed = factory.deployAdapter(token, programId, T.KIND_WRAPPED, true);
        assertEq(predicted, deployed);
    }
}
