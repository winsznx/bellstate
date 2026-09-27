// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PolicyLens} from "../src/PolicyLens.sol";
import {BellstateTypes as T} from "../src/libraries/BellstateTypes.sol";
import {HaltGatePolicy} from "../src/libraries/HaltGatePolicy.sol";
import {PrintPolicy} from "../src/libraries/PrintPolicy.sol";

/// @notice PRD §7.7 — PolicyLens must produce the exact same results as the underlying policy
/// libraries the live contracts link, since it's the source of truth the TS mirror (packages/policy)
/// is fork-tested against on 10,000 random inputs.
contract PolicyLensTest is Test {
    PolicyLens lens;

    function setUp() public {
        lens = new PolicyLens();
    }

    function test_haltGateDecide_regularSession_matchesDirectCall() public view {
        T.MarketView memory m;
        m.session = 1; // REGULAR
        m.interruption = 1; // NONE
        m.effectiveAsOf = 1000;

        T.ProgramView memory p;
        p.lifecycle = 2; // ACTIVE
        p.programStatus = 1; // NORMAL

        T.Resumption memory r;
        HaltGatePolicy.Params memory params = HaltGatePolicy.defaultParams();

        HaltGatePolicy.Decision memory viaLens = lens.haltGateDecide(m, p, r, params, 2000);
        HaltGatePolicy.Decision memory direct = HaltGatePolicy.decide(m, p, r, params, 2000);

        assertEq(uint8(viaLens.verdict), uint8(direct.verdict));
        assertEq(viaLens.fee, direct.fee);
        assertEq(viaLens.mode, direct.mode);
    }

    function testFuzz_haltGateDecide_matchesDirectCall(uint8 session, uint8 interruption, uint8 lifecycle, uint8 programStatus, uint64 nowTs) public view {
        session = uint8(bound(session, 0, 4));
        interruption = uint8(bound(interruption, 0, 4));
        lifecycle = uint8(bound(lifecycle, 0, 4));
        programStatus = uint8(bound(programStatus, 0, 2));
        nowTs = uint64(bound(nowTs, 0, type(uint64).max - 100_000));

        T.MarketView memory m;
        m.session = session;
        m.interruption = interruption;
        m.effectiveAsOf = nowTs > 500 ? nowTs - 500 : 0;
        m.reasonCategory = 4; // MARKET_WIDE, exercises the surge path when halted

        T.ProgramView memory p;
        p.lifecycle = lifecycle;
        p.programStatus = programStatus;

        T.Resumption memory r;
        r.at = nowTs > 1000 ? nowTs - 1000 : 0;
        r.category = 4;

        HaltGatePolicy.Params memory params = HaltGatePolicy.defaultParams();

        HaltGatePolicy.Decision memory viaLens = lens.haltGateDecide(m, p, r, params, nowTs);
        HaltGatePolicy.Decision memory direct = HaltGatePolicy.decide(m, p, r, params, nowTs);

        assertEq(uint8(viaLens.verdict), uint8(direct.verdict));
        assertEq(viaLens.fee, direct.fee);
        assertEq(viaLens.mode, direct.mode);
    }

    function test_printVerdict_matchesDirectCall() public view {
        PrintPolicy.VenueState memory venue =
            PrintPolicy.VenueState({found: true, outOfHistory: false, session: 1, interruption: 1, sessionStartedAt: 100});

        (uint8 verdictLens, uint16 flagsLens,,) = lens.printVerdict(venue, 200, 300);
        (uint8 verdictDirect, uint16 flagsDirect,,) = PrintPolicy.verdictSingle(venue, 200, 300);

        assertEq(verdictLens, verdictDirect);
        assertEq(flagsLens, flagsDirect);
    }
}
