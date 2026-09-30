// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

import {BellstateHub} from "../src/BellstateHub.sol";
import {StatusAdapter} from "../src/StatusAdapter.sol";
import {AdapterFactory} from "../src/AdapterFactory.sol";
import {HookDeployer} from "../src/HookDeployer.sol";
import {HaltGateHook} from "../src/HaltGateHook.sol";
import {LendingGuard} from "../src/LendingGuard.sol";
import {PrintGuard} from "../src/PrintGuard.sol";
import {PolicyLens} from "../src/PolicyLens.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";

/// @notice Mainnet X Layer deploy, PRD §7.9 hackathon-stage variant: `owner_` is the deployer EOA
/// directly rather than a Safe (BellstateHub's constructor takes a plain address for
/// DEFAULT_ADMIN_ROLE regardless — see BellstateHub.sol:86-96 — so this is a config choice, not a
/// contract change; upgrading to a real 2-of-3 Safe later is `grantRole(DEFAULT_ADMIN_ROLE, safe)`
/// + revoke on the EOA, no redeploy).
///
/// Registers exactly one real asset end to end, per PRD §2.1's own verified example: NVDAx,
/// reference listing XNAS:NVDA. Both the raw and wrapped tokens get adapters; only the wrapped
/// token is pool-eligible (§2.1 — rebasing balances break pool accounting).
contract Deploy is Script {
    // Real, verified mainnet addresses (see internal/NEEDS.md gates G12/G13/G17 and PRD §2.1).
    address constant POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant SEQUENCER_UPTIME_FEED = 0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9;
    address constant NVDAX_RAW = 0xc845b2894dBddd03858fd2D643B4eF725fE0849d;
    address constant NVDAX_WRAPPED = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address signerA = vm.envAddress("SIGNER_A_ADDRESS");
        address signerB = vm.envAddress("SIGNER_B_ADDRESS");
        address signerC = vm.envAddress("SIGNER_C_ADDRESS");

        address[] memory signers = new address[](3);
        signers[0] = signerA;
        signers[1] = signerB;
        signers[2] = signerC;

        // PRD §6.6's own staleness table, verbatim.
        T.MaxAges memory maxAges = T.MaxAges({
            marketOpen: 180,
            marketClosed: 1800,
            program: 1800,
            primary: 900,
            valuationLive: 180,
            valuationIdle: 1800
        });

        vm.startBroadcast(deployerKey);

        BellstateHub hub = new BellstateHub(deployer, operator, signers, 2, 1, maxAges);
        console2.log("BellstateHub:", address(hub));

        StatusAdapter implementation = new StatusAdapter();
        console2.log("StatusAdapter implementation:", address(implementation));

        AdapterFactory factory = new AdapterFactory(address(hub), address(implementation), deployer);
        console2.log("AdapterFactory:", address(factory));

        // Owner-only: let the factory register tokens on the hub, and let the deployer act as an
        // operator directly for the registration calls below (deployer already holds
        // DEFAULT_ADMIN_ROLE, so self-granting OPERATOR_ROLE is not a privilege escalation).
        hub.grantOperator(address(factory));
        hub.grantOperator(deployer);

        HookDeployer hookDeployer = new HookDeployer();
        console2.log("HookDeployer:", address(hookDeployer));

        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG);
        bytes memory creationCode = abi.encodePacked(
            type(HaltGateHook).creationCode, abi.encode(IPoolManager(POOL_MANAGER), hub, deployer)
        );
        (address hookAddr, bytes32 salt) = _mine(address(hookDeployer), flags, creationCode);
        hookDeployer.deploy(salt, creationCode);
        console2.log("HaltGateHook:", hookAddr);

        LendingGuard lendingGuard = new LendingGuard(hub, IAggregatorV3(SEQUENCER_UPTIME_FEED));
        console2.log("LendingGuard:", address(lendingGuard));

        PrintGuard printGuard = new PrintGuard(hub);
        console2.log("PrintGuard:", address(printGuard));

        PolicyLens policyLens = new PolicyLens();
        console2.log("PolicyLens:", address(policyLens));

        // Register the one real asset per PRD §2.1's verified example: NVDAx, reference XNAS:NVDA.
        bytes32 listingId = hub.registerListing(bytes32("XNAS"), bytes16("NVDA"), T.DOMAIN_US_MARKETS);
        console2.log("listingId (XNAS:NVDA):");
        console2.logBytes32(listingId);

        bytes32[] memory homeListings = new bytes32[](1);
        homeListings[0] = listingId;
        bytes32 programId = hub.registerProgram("xstocks:NVDAx", listingId, homeListings, false);
        console2.log("programId (xstocks:NVDAx):");
        console2.logBytes32(programId);

        address rawAdapter = factory.deployAdapter(NVDAX_RAW, programId, T.KIND_RAW, false);
        console2.log("NVDAx raw adapter:", rawAdapter);

        address wrappedAdapter = factory.deployAdapter(NVDAX_WRAPPED, programId, T.KIND_WRAPPED, true);
        console2.log("NVDAx wrapped adapter:", wrappedAdapter);

        vm.stopBroadcast();
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
                        keccak256(
                            abi.encodePacked(bytes1(0xFF), deployerAddr, bytes32(salt), keccak256(creationCodeWithArgs))
                        )
                    )
                )
            );
            if (uint160(candidate) & mask == flags && candidate.code.length == 0) {
                return (candidate, bytes32(salt));
            }
        }
        revert("mining failed");
    }
}
