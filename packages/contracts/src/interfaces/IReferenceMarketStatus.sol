// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice ERC-8392 §A.1 — verbatim from ERCS/erc-8391.md (ethereum/ERCs PR #1964).
/// Interface ID: 0xfe1d1980
interface IReferenceMarketStatus {
    /// @dev Scheduled session state of the reference market.
    enum Session {
        UNKNOWN, // 0
        REGULAR, // continuous trading in the venue's primary session
        EXTENDED, // any scheduled non-primary trading session
        AUCTION, // scheduled or triggered auction/call phase; orders accepted,
            // matching deferred to an uncrossing
        CLOSED // any scheduled non-trading period, including intraday breaks,
            // nights, weekends, and holidays

    }

    /// @dev Unscheduled interruption state, orthogonal to Session.
    enum Interruption {
        UNKNOWN, // 0
        NONE, // no known interruption
        PRICE_CONSTRAINED, // trading continues but is materially constrained by a
            // price-limit mechanism (limit-up/limit-down lock, special
            // quote, or partial constraint such as a program-trading
            // sidecar)
        ASSET_HALTED, // this asset specifically halted by the venue
        VENUE_HALTED // the venue/market as a whole halted

    }

    /// @notice Session and interruption state of the reference market.
    /// @return session scheduled session state
    /// @return interruption unscheduled interruption state
    /// @return sessionAsOf unix time session state last affirmed
    /// @return interruptionAsOf unix time interruption state last affirmed
    /// @return nextScheduledTransition unix time of next scheduled session change
    /// (0 = unknown); covers scheduled transitions
    /// only — halt lifts are unscheduled and are not
    /// represented here
    /// @return marketId identifier of the designated reference market:
    /// the ISO 10383 MIC as uppercase ASCII,
    /// right-padded with zero bytes (bytes32(0) =
    /// unknown or no listed venue)
    function referenceMarketStatus()
        external
        view
        returns (
            Session session,
            Interruption interruption,
            uint64 sessionAsOf,
            uint64 interruptionAsOf,
            uint64 nextScheduledTransition,
            bytes32 marketId
        );
}
