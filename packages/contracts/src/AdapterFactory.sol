// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {StatusAdapter} from "./StatusAdapter.sol";
import {IBellstateHub} from "./interfaces/IBellstateHub.sol";

/// @notice PRD §7.3 — deterministic (CREATE2, salt = token address) clone deployment of
/// StatusAdapter, and hub token registration. Operator-only.
contract AdapterFactory is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    address public immutable hub;
    address public immutable implementation;

    event AdapterDeployed(address indexed token, address indexed adapter, bytes32 programId, uint8 kind, bool poolEligible);

    constructor(address hub_, address implementation_, address owner_) {
        hub = hub_;
        implementation = implementation_;
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        _grantRole(OPERATOR_ROLE, owner_);
        _setRoleAdmin(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function predict(address token) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(token), address(this));
    }

    function deployAdapter(address token, bytes32 programId, uint8 kind, bool poolEligible)
        external
        onlyRole(OPERATOR_ROLE)
        returns (address adapter)
    {
        adapter = Clones.cloneDeterministic(implementation, _salt(token));
        StatusAdapter(adapter).initialize(hub, token, programId, kind);
        IBellstateHub(hub).registerToken(token, programId, kind, poolEligible, adapter);
        emit AdapterDeployed(token, adapter, programId, kind, poolEligible);
    }

    function _salt(address token) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(token)));
    }
}
