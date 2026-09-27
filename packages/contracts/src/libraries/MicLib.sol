// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice PRD §2.3 line 183/190 — `listingId = keccak256(utf8("<MIC>:<SYMBOL>"))`, uppercase,
/// where MIC and SYMBOL are ISO 10383 / catalog ASCII strings, zero-right-padded into bytes32
/// (MIC, per ERC-8392's marketId encoding) and bytes16 (symbol) for cheap onchain storage, but
/// hashed as their *trimmed* UTF-8 strings joined by a colon — not as the padded words directly.
library MicLib {
    /// @dev Right-pads an ASCII string into bytes32 (used for `marketId` / listing `mic`).
    function toBytes32(string memory s) internal pure returns (bytes32 out) {
        bytes memory b = bytes(s);
        require(b.length <= 32, "MicLib: too long");
        assembly ("memory-safe") {
            out := mload(add(b, 32))
        }
    }

    /// @dev Right-pads an ASCII string into bytes16 (used for listing `symbol`).
    function toBytes16(string memory s) internal pure returns (bytes16 out) {
        bytes memory b = bytes(s);
        require(b.length <= 16, "MicLib: too long");
        assembly ("memory-safe") {
            out := mload(add(b, 32))
        }
    }

    /// @dev Strips trailing zero bytes from a fixed-width word back into a tightly-packed byte string.
    function trim(bytes32 word, uint256 maxLen) internal pure returns (bytes memory out) {
        uint256 len = maxLen;
        while (len > 0 && word[len - 1] == 0) {
            len--;
        }
        out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = word[i];
        }
    }

    /// @notice `keccak256(utf8("<MIC>:<SYMBOL>"))` per PRD §2.3, MIC and SYMBOL right-trimmed to
    /// their real ASCII length before joining.
    function listingId(bytes32 mic, bytes16 symbol) internal pure returns (bytes32) {
        bytes memory micStr = trim(mic, 32);
        bytes memory symbolStr = trim(bytes32(symbol), 16);
        return keccak256(abi.encodePacked(micStr, ":", symbolStr));
    }
}
