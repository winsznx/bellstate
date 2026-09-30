import { describe, expect, it } from "vitest";
import {
  checkClosedMove,
  checkHaltedMove,
  checkThinOpenMove,
  computePriceDelta,
  HALTED_MOVE_THRESHOLD,
  OPEN_MOVE_THRESHOLD,
  type OracleSample,
} from "../src/flags.js";
import type { Interruption, ListingStatus, Session } from "../src/status.js";

const NOW = 1_800_000_060;

function samples(startPx: number, endPx: number, windowSeconds = 60): OracleSample[] {
  return [
    { t: NOW - windowSeconds, oraclePx: startPx },
    { t: NOW, oraclePx: endPx },
  ];
}

function status(overrides: Partial<ListingStatus> = {}): ListingStatus {
  return { listingId: "0xlisting", session: "REGULAR" as Session, interruption: "NONE" as Interruption, sessionSince: 0, ...overrides };
}

describe("computePriceDelta", () => {
  it("returns null when fewer than two samples are available", () => {
    // #given a series with a single sample
    const single: OracleSample[] = [{ t: NOW, oraclePx: 100 }];

    // #when computing the delta
    const delta = computePriceDelta(single);

    // #then there is not enough history to compute a move
    expect(delta).toBeNull();
  });

  it("computes the signed percentage move between the oldest in-window and latest sample", () => {
    // #given a price that rose from 100 to 103 over the 60s window
    const series = samples(100, 103);

    // #when computing the delta
    const delta = computePriceDelta(series);

    // #then the move is +3%, anchored to the window's start and end timestamps
    expect(delta).toEqual({ movePct: 0.03, windowStart: NOW - 60, windowEnd: NOW });
  });
});

describe("checkThinOpenMove", () => {
  const secondaryFreshlyExtended = status({ listingId: "0xsecondary", session: "EXTENDED", sessionSince: NOW - 10 });
  const primaryNotRegular = status({ listingId: "0xprimary", session: "CLOSED" });

  it("fires on a >=3% move while a secondary venue just opened EXTENDED and the primary isn't REGULAR", () => {
    // #given a 4% move, a primary that's CLOSED, and a secondary 10s into EXTENDED
    const delta = computePriceDelta(samples(100, 104));

    // #when checking THIN_OPEN_MOVE
    const match = checkThinOpenMove(delta, primaryNotRegular, [secondaryFreshlyExtended], NOW);

    // #then the rule matches
    expect(match?.flag).toBe("THIN_OPEN_MOVE");
  });

  it("does not fire when the secondary's EXTENDED session opened well outside the first 60s", () => {
    // #given the same 4% move and non-REGULAR primary, but the secondary opened 10 minutes ago
    const delta = computePriceDelta(samples(100, 104));
    const staleExtended = status({ listingId: "0xsecondary", session: "EXTENDED", sessionSince: NOW - 600 });

    // #when checking THIN_OPEN_MOVE
    const match = checkThinOpenMove(delta, primaryNotRegular, [staleExtended], NOW);

    // #then the "first 60s of the session" condition fails, so it doesn't match
    expect(match).toBeNull();
  });

  it("fires at exactly the 3% boundary", () => {
    // #given a move of precisely 3%
    const delta = computePriceDelta(samples(100, 103));

    // #when checking THIN_OPEN_MOVE
    const match = checkThinOpenMove(delta, primaryNotRegular, [secondaryFreshlyExtended], NOW);

    // #then the threshold is inclusive, so it matches
    expect(match?.movePct).toBe(OPEN_MOVE_THRESHOLD);
  });
});

describe("checkClosedMove", () => {
  it("fires on a >=3% move while every mapped listing is CLOSED", () => {
    // #given a 5% move and two mapped listings, both CLOSED
    const delta = computePriceDelta(samples(100, 105));
    const listings = [status({ listingId: "0xa", session: "CLOSED" }), status({ listingId: "0xb", session: "CLOSED" })];

    // #when checking CLOSED_MOVE
    const match = checkClosedMove(delta, listings);

    // #then the rule matches
    expect(match?.flag).toBe("CLOSED_MOVE");
  });

  it("does not fire when at least one mapped listing is not CLOSED", () => {
    // #given the same 5% move, but one of the two listings is REGULAR
    const delta = computePriceDelta(samples(100, 105));
    const listings = [status({ listingId: "0xa", session: "CLOSED" }), status({ listingId: "0xb", session: "REGULAR" })];

    // #when checking CLOSED_MOVE
    const match = checkClosedMove(delta, listings);

    // #then "every mapped listing" fails, so it doesn't match
    expect(match).toBeNull();
  });

  it("fires at exactly the 3% boundary", () => {
    // #given a move of precisely 3% and every listing CLOSED
    const delta = computePriceDelta(samples(100, 103));
    const listings = [status({ listingId: "0xa", session: "CLOSED" })];

    // #when checking CLOSED_MOVE
    const match = checkClosedMove(delta, listings);

    // #then the threshold is inclusive, so it matches
    expect(match?.movePct).toBe(OPEN_MOVE_THRESHOLD);
  });
});

describe("checkHaltedMove", () => {
  it("fires on a >=1% move while the primary listing is ASSET_HALTED", () => {
    // #given a 2% move and a primary listing that's asset-halted
    const delta = computePriceDelta(samples(100, 102));
    const primary = status({ interruption: "ASSET_HALTED" });

    // #when checking HALTED_MOVE
    const match = checkHaltedMove(delta, primary);

    // #then the rule matches
    expect(match?.flag).toBe("HALTED_MOVE");
  });

  it("does not fire when the primary listing has no interruption", () => {
    // #given the same 2% move, but the primary listing is interruption-free
    const delta = computePriceDelta(samples(100, 102));
    const primary = status({ interruption: "NONE" });

    // #when checking HALTED_MOVE
    const match = checkHaltedMove(delta, primary);

    // #then there's no halt to react to, so it doesn't match
    expect(match).toBeNull();
  });

  it("fires at exactly the 1% boundary", () => {
    // #given a move of precisely 1% while the primary is venue-halted
    const delta = computePriceDelta(samples(100, 101));
    const primary = status({ interruption: "VENUE_HALTED" });

    // #when checking HALTED_MOVE
    const match = checkHaltedMove(delta, primary);

    // #then the threshold is inclusive, so it matches
    expect(match?.movePct).toBe(HALTED_MOVE_THRESHOLD);
  });
});
