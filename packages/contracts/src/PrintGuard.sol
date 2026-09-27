// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBellstateHub} from "./interfaces/IBellstateHub.sol";
import {BellstateTypes as T} from "./libraries/BellstateTypes.sol";
import {PrintPolicy} from "./libraries/PrintPolicy.sol";

/// @notice PRD §7.6 — print-time venue checks from transition history.
contract PrintGuard {
    IBellstateHub public immutable hub;

    constructor(IBellstateHub hub_) {
        hub = hub_;
    }

    function checkPrint(bytes32 listingId, uint64 printTs)
        external
        view
        returns (uint8 verdict, uint16 flags, uint8 session, uint8 interruption)
    {
        PrintPolicy.VenueState memory venue = _venueStateAt(listingId, printTs);
        return PrintPolicy.verdictSingle(venue, printTs, uint64(block.timestamp));
    }

    function checkSecondaryPrint(bytes32 venueListingId, bytes32 primaryListingId, uint64 printTs)
        external
        view
        returns (uint8 verdict, uint16 flags)
    {
        PrintPolicy.VenueState memory venue = _venueStateAt(venueListingId, printTs);
        PrintPolicy.VenueState memory primary = _venueStateAt(primaryListingId, printTs);
        return PrintPolicy.verdictSecondary(venue, primary, printTs, uint64(block.timestamp));
    }

    function _venueStateAt(bytes32 listingId, uint64 printTs) internal view returns (PrintPolicy.VenueState memory state) {
        (bool found, T.Transition memory t, uint64 sessionStartedAt) = hub.stateAt(listingId, printTs);
        if (!found) {
            // Distinguish "no history at all before this ts" (OUT_OF_HISTORY) from a listing
            // whose earliest recorded transition is still after printTs — both come back as
            // found = false from the hub, so both are reported as out-of-history/UNKNOWN.
            state.outOfHistory = true;
            return state;
        }
        state.found = true;
        state.session = t.session;
        state.interruption = t.interruption;
        state.sessionStartedAt = sessionStartedAt;
    }
}
