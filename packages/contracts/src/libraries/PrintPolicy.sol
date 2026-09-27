// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BellstateTypes as T} from "./BellstateTypes.sol";

/// @notice PRD §7.6 — PrintGuard's print-time venue-check logic, extracted as a pure library so
/// PolicyLens (replays) and packages/policy (TS mirror) match the exact same logic.
library PrintPolicy {
    uint8 constant SESSION_UNKNOWN = 0;
    uint8 constant SESSION_REGULAR = 1;
    uint8 constant SESSION_EXTENDED = 2;
    uint8 constant SESSION_AUCTION = 3;
    uint8 constant SESSION_CLOSED = 4;

    uint8 constant INTERRUPTION_UNKNOWN = 0;
    uint8 constant INTERRUPTION_ASSET_HALTED = 3;
    uint8 constant INTERRUPTION_VENUE_HALTED = 4;

    uint8 constant VERDICT_UNKNOWN = 0;
    uint8 constant VERDICT_ACCEPT = 1;
    uint8 constant VERDICT_FLAG = 2;
    uint8 constant VERDICT_REJECT = 3;

    uint16 constant FLAG_VENUE_CLOSED = 1 << 0;
    uint16 constant FLAG_VENUE_HALTED = 1 << 1;
    uint16 constant FLAG_VENUE_EXTENDED = 1 << 2;
    uint16 constant FLAG_VENUE_AUCTION = 1 << 3;
    uint16 constant FLAG_FIRST_MINUTE = 1 << 4;
    uint16 constant FLAG_PRIMARY_NOT_REGULAR = 1 << 5;
    uint16 constant FLAG_PRIMARY_HALTED = 1 << 6;
    uint16 constant FLAG_OUT_OF_HISTORY = 1 << 7;
    uint16 constant FLAG_FUTURE_TS = 1 << 8;

    struct VenueState {
        bool found;
        bool outOfHistory;
        uint8 session;
        uint8 interruption;
        uint64 sessionStartedAt;
    }

    /// @dev `checkPrint`: single-venue verdict from the venue's own state at printTs.
    function verdictSingle(VenueState memory venue, uint64 printTs, uint64 nowTs)
        internal
        pure
        returns (uint8 verdict, uint16 flags, uint8 session, uint8 interruption)
    {
        if (printTs > nowTs) flags |= FLAG_FUTURE_TS;

        if (venue.outOfHistory) {
            flags |= FLAG_OUT_OF_HISTORY;
            return (VERDICT_UNKNOWN, flags, 0, 0);
        }
        if (!venue.found) {
            return (VERDICT_UNKNOWN, flags, 0, 0);
        }

        session = venue.session;
        interruption = venue.interruption;

        if (session == SESSION_CLOSED) flags |= FLAG_VENUE_CLOSED;
        if (interruption == INTERRUPTION_ASSET_HALTED || interruption == INTERRUPTION_VENUE_HALTED) {
            flags |= FLAG_VENUE_HALTED;
        }
        if (session == SESSION_EXTENDED) flags |= FLAG_VENUE_EXTENDED;
        if (session == SESSION_AUCTION) flags |= FLAG_VENUE_AUCTION;
        if (venue.sessionStartedAt != 0 && printTs >= venue.sessionStartedAt && printTs - venue.sessionStartedAt < 60) {
            flags |= FLAG_FIRST_MINUTE;
        }

        verdict = _verdictFromFlags(flags, session, interruption);
    }

    /// @dev `checkSecondaryPrint`: adds the primary listing's state at printTs to the flag set.
    function verdictSecondary(VenueState memory venue, VenueState memory primary, uint64 printTs, uint64 nowTs)
        internal
        pure
        returns (uint8 verdict, uint16 flags)
    {
        uint8 session;
        uint8 interruption;
        (verdict, flags, session, interruption) = verdictSingle(venue, printTs, nowTs);

        if (flags & FLAG_OUT_OF_HISTORY != 0) return (verdict, flags);

        if (primary.outOfHistory || !primary.found) {
            // Primary state unknown doesn't add flags beyond what venue-only produced; the
            // print stands on the venue's own state per the PRD's worked example.
            return (verdict, flags);
        }

        if (primary.session != SESSION_REGULAR) flags |= FLAG_PRIMARY_NOT_REGULAR;
        if (primary.interruption == INTERRUPTION_ASSET_HALTED || primary.interruption == INTERRUPTION_VENUE_HALTED) {
            flags |= FLAG_PRIMARY_HALTED;
        }

        verdict = _verdictFromFlags(flags, session, interruption);
    }

    function _verdictFromFlags(uint16 flags, uint8 session, uint8 interruption) internal pure returns (uint8) {
        if (flags & FLAG_FUTURE_TS != 0) return VERDICT_REJECT;
        if (flags & FLAG_VENUE_CLOSED != 0) return VERDICT_REJECT;
        if (flags & FLAG_VENUE_HALTED != 0) return VERDICT_REJECT;
        if (flags & FLAG_FIRST_MINUTE != 0 && flags & FLAG_PRIMARY_NOT_REGULAR != 0) return VERDICT_REJECT;

        if (session == SESSION_UNKNOWN || interruption == INTERRUPTION_UNKNOWN) return VERDICT_UNKNOWN;

        // FUTURE_TS already rejected above; any other flag set (extended/auction/first-minute/
        // primary-not-regular/primary-halted, none of which triggered REJECT) means FLAG.
        if (flags != 0) return VERDICT_FLAG;

        return VERDICT_ACCEPT;
    }
}
