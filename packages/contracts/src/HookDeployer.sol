// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice PRD §7.4 — the team's own CREATE2 deployer used to mine and deploy HaltGateHook,
/// so the hook's deployment doesn't depend on a third-party CREATE2 proxy. `HookMiner` (used
/// offchain, in scripts/tests) computes a salt against `address(this)` as the deployer, then
/// `deploy` is called with that exact salt.
contract HookDeployer {
    event Deployed(address indexed addr, bytes32 salt);

    function deploy(bytes32 salt, bytes memory creationCodeWithArgs) external returns (address addr) {
        assembly ("memory-safe") {
            addr := create2(0, add(creationCodeWithArgs, 0x20), mload(creationCodeWithArgs), salt)
        }
        require(addr != address(0), "HookDeployer: deploy failed");
        emit Deployed(addr, salt);
    }
}
