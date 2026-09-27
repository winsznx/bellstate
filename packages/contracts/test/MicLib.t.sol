// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MicLib} from "../src/libraries/MicLib.sol";

/// @notice PRD §2.3: listingId = keccak256(utf8("<MIC>:<SYMBOL>")). Locks in the exact formula
/// against the PRD's own worked examples so any future refactor can't silently drift it.
contract MicLibTest is Test {
    function test_listingId_matchesUtf8ColonJoin_nvda() public pure {
        bytes32 mic = MicLib.toBytes32("XNAS");
        bytes16 symbol = MicLib.toBytes16("NVDA");
        bytes32 expected = keccak256("XNAS:NVDA");
        assertEq(MicLib.listingId(mic, symbol), expected);
    }

    function test_listingId_matchesUtf8ColonJoin_krHomeListing() public pure {
        bytes32 mic = MicLib.toBytes32("XKRX");
        bytes16 symbol = MicLib.toBytes16("000660");
        bytes32 expected = keccak256("XKRX:000660");
        assertEq(MicLib.listingId(mic, symbol), expected);
    }

    function test_listingId_matchesUtf8ColonJoin_hkFivDigit() public pure {
        bytes32 mic = MicLib.toBytes32("XHKG");
        bytes16 symbol = MicLib.toBytes16("00700");
        bytes32 expected = keccak256("XHKG:00700");
        assertEq(MicLib.listingId(mic, symbol), expected);
    }

    function test_listingId_differsFromRawWordEncoding() public pure {
        bytes32 mic = MicLib.toBytes32("XNAS");
        bytes16 symbol = MicLib.toBytes16("NVDA");
        bytes32 wrongWayHash = keccak256(abi.encode(mic, symbol));
        assertTrue(MicLib.listingId(mic, symbol) != wrongWayHash);
    }
}
