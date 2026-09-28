import { describe, expect, it } from "vitest";
import { deriveDomainEvents } from "../src/domainEvents.js";
import type { MarketUpdatedEvent, ProgramUpdatedEvent } from "../src/decodeHubLog.js";

const LISTING_ID = `0x${"11".repeat(32)}` as const;
const PROGRAM_ID = `0x${"22".repeat(32)}` as const;

function marketEvent(interruption: number): MarketUpdatedEvent {
  return {
    eventName: "MarketUpdated",
    facet: "market",
    args: {
      listingId: LISTING_ID,
      seq: 1,
      session: 1,
      interruption,
      reasonCategory: 0,
      reasonCode: "0x0000000000000000",
      sessionSince: 0n,
      interruptionSince: 0n,
      nextScheduledTransition: 0n,
      expectedResumption: 0n,
      epoch: 0n,
    },
  };
}

describe("deriveDomainEvents", () => {
  it("always emits status.market.changed for a MarketUpdated event", () => {
    const events = deriveDomainEvents(marketEvent(1));
    expect(events).toContainEqual({ name: "status.market.changed", subjectId: LISTING_ID });
  });

  it("NONE -> ASSET_HALTED emits halt.opened", () => {
    const events = deriveDomainEvents(marketEvent(3), 1 /* prior NONE */);
    expect(events.map((e) => e.name)).toEqual(["status.market.changed", "halt.opened"]);
  });

  it("VENUE_HALTED -> NONE emits halt.resumed", () => {
    const events = deriveDomainEvents(marketEvent(1), 4 /* prior VENUE_HALTED */);
    expect(events.map((e) => e.name)).toEqual(["status.market.changed", "halt.resumed"]);
  });

  it("staying halted (ASSET_HALTED -> VENUE_HALTED) emits neither halt event", () => {
    const events = deriveDomainEvents(marketEvent(4), 3 /* prior ASSET_HALTED */);
    expect(events.map((e) => e.name)).toEqual(["status.market.changed"]);
  });

  it("no prior interruption known (first-ever update) never emits halt.resumed", () => {
    const events = deriveDomainEvents(marketEvent(1));
    expect(events.map((e) => e.name)).toEqual(["status.market.changed"]);
  });

  it("a first-ever update that's already halted still emits halt.opened", () => {
    const events = deriveDomainEvents(marketEvent(3));
    expect(events.map((e) => e.name)).toEqual(["status.market.changed", "halt.opened"]);
  });

  it("ProgramUpdated maps to status.program.changed keyed by programId", () => {
    const event: ProgramUpdatedEvent = {
      eventName: "ProgramUpdated",
      facet: "program",
      args: { programId: PROGRAM_ID, seq: 1, lifecycle: 2, programStatus: 1, programReason: 0, epoch: 0n },
    };
    expect(deriveDomainEvents(event)).toEqual([{ name: "status.program.changed", subjectId: PROGRAM_ID }]);
  });
});
