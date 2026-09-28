import type { MarketSnapshot, MarketState } from "@winsznx/bellstate-engine";
import { describe, expect, it } from "vitest";
import { tick, type ListingSubject } from "../src/core/tick.js";

const LISTING_A = { listingId: `0x${"11".repeat(32)}` as `0x${string}`, mic: "XNAS", symbol: "NVDA", aliases: [] };
const LISTING_B = { listingId: `0x${"22".repeat(32)}` as `0x${string}`, mic: "XNAS", symbol: "AAPL", aliases: [] };

const T = 1_700_000_000;

function snapshot(): MarketSnapshot {
  return {
    sourceHealthy: true,
    sessionWindow: { session: "REGULAR", sessionSince: T - 5000, nextScheduledTransition: T + 5000 },
    halts: [],
  };
}

const NO_DIFF_STATE: MarketState = {
  session: "REGULAR",
  interruption: "NONE",
  reasonCategory: "NONE",
  reasonCode: "NONE",
  sessionSince: T - 5000,
  nextScheduledTransition: T + 5000,
  interruptionSince: 0,
  expectedResumption: 0,
};

const domainVersions = {
  US_MARKETS: { version: 5n },
  HK_MARKETS: { version: 0n },
  KR_MARKETS: { version: 0n },
  PROGRAMS: { version: 0n },
  PRIMARY: { version: 0n },
  VALUATION: { version: 0n },
};

describe("tick — §8.1 Core", () => {
  it("a subject matching the onchain state produces no update and a domain heartbeat", () => {
    const subject: ListingSubject = {
      listing: LISTING_A,
      domain: "US_MARKETS",
      snapshot: snapshot(),
      onchainSeq: 3,
      onchainState: NO_DIFF_STATE,
    };
    const result = tick({
      t: T,
      calendarVersion: 1,
      listings: [subject],
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions,
    });

    expect(result.marketUpdates).toHaveLength(0);
    expect(result.heartbeats).toHaveLength(1);
    expect(result.heartbeats[0]).toEqual({
      domain: "US_MARKETS",
      message: { domain: 1, version: 5n, epoch: expect.any(BigInt), calendarVersion: 1 },
    });
  });

  it("a never-attested subject (onchainState null) always diffs, seq = 0 + 1", () => {
    const subject: ListingSubject = {
      listing: LISTING_A,
      domain: "US_MARKETS",
      snapshot: snapshot(),
      onchainSeq: 0,
      onchainState: null,
    };
    const result = tick({
      t: T,
      calendarVersion: 1,
      listings: [subject],
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions,
    });

    expect(result.marketUpdates).toHaveLength(1);
    expect(result.marketUpdates[0]!.message.seq).toBe(1);
    expect(result.heartbeats).toHaveLength(0);
  });

  it("a real diff (source unhealthy -> UNKNOWN) produces an update with seq = onchain + 1, no heartbeat for that domain", () => {
    const subject: ListingSubject = {
      listing: LISTING_A,
      domain: "US_MARKETS",
      snapshot: { ...snapshot(), sourceHealthy: false },
      onchainSeq: 7,
      onchainState: NO_DIFF_STATE,
    };
    const result = tick({
      t: T,
      calendarVersion: 1,
      listings: [subject],
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions,
    });

    expect(result.marketUpdates).toHaveLength(1);
    expect(result.marketUpdates[0]!.message.seq).toBe(8);
    expect(result.marketUpdates[0]!.message.interruption).toBe(0); // UNKNOWN index
    expect(result.heartbeats).toHaveLength(0);
  });

  it("one differing subject in a domain suppresses that domain's heartbeat even if a sibling subject matches", () => {
    const matching: ListingSubject = {
      listing: LISTING_A,
      domain: "US_MARKETS",
      snapshot: snapshot(),
      onchainSeq: 3,
      onchainState: NO_DIFF_STATE,
    };
    const differing: ListingSubject = {
      listing: LISTING_B,
      domain: "US_MARKETS",
      snapshot: { ...snapshot(), sourceHealthy: false },
      onchainSeq: 3,
      onchainState: NO_DIFF_STATE,
    };
    const result = tick({
      t: T,
      calendarVersion: 1,
      listings: [matching, differing],
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions,
    });

    expect(result.marketUpdates).toHaveLength(1);
    expect(result.marketUpdates[0]!.listingId).toBe(LISTING_B.listingId);
    expect(result.heartbeats).toHaveLength(0);
  });

  it("a domain with no subjects at all produces no heartbeat", () => {
    const result = tick({
      t: T,
      calendarVersion: 1,
      listings: [],
      programs: [],
      primaries: [],
      valuations: [],
      domainVersions,
    });
    expect(result.heartbeats).toHaveLength(0);
  });
});
