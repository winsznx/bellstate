import type { MarketState } from "@winsznx/bellstate-engine";
import { describe, expect, it } from "vitest";
import { embedShortForm, marketSentence, type MarketSentenceContext } from "../src/copyDeck.js";

const T = Date.parse("2026-06-15T14:00:00Z") / 1000; // 10:00 ET

function ctx(state: Partial<MarketState>, overrides: Partial<MarketSentenceContext> = {}): MarketSentenceContext {
  const base: MarketState = {
    session: "REGULAR",
    interruption: "NONE",
    reasonCategory: "NONE",
    reasonCode: "NONE",
    sessionSince: T - 5000,
    nextScheduledTransition: T + 5000,
    interruptionSince: 0,
    expectedResumption: 0,
    ...state,
  };
  return { venue: "Nasdaq", symbol: "NVDA", mic: "XNAS", state: base, ...overrides };
}

describe("marketSentence — PRD §11.4 Market table", () => {
  it("Regular · None", () => {
    expect(marketSentence(ctx({}))).toBe("Nasdaq is open. NVDA is trading normally.");
  });

  it("Extended · None", () => {
    expect(marketSentence(ctx({ session: "EXTENDED" }, { extendedPeriod: "pre-market" }))).toBe(
      "Nasdaq pre-market session. Liquidity is thinner than regular hours.",
    );
  });

  it("Auction · None", () => {
    const result = marketSentence(ctx({ session: "AUCTION" }, { auctionPhase: "opening" }));
    expect(result).toMatch(/^Nasdaq opening auction\. Orders collect; the price sets at /);
  });

  it("Closed · None", () => {
    const result = marketSentence(ctx({ session: "CLOSED" }));
    expect(result).toMatch(/^Nasdaq is closed until .+\. Onchain prices can move while the real market can't\.$/);
  });

  it("Closed (lunch)", () => {
    expect(marketSentence(ctx({ session: "CLOSED" }, { closedReason: "lunch" }))).toBe(
      "HKEX lunch break until 13:00 HKT.",
    );
  });

  it("Unknown session", () => {
    const result = marketSentence(ctx({ session: "UNKNOWN" }, { unknownSessionReason: "closing-auction random end" }));
    expect(result).toBe("Bellstate can't confirm Nasdaq's session right now: closing-auction random end.");
  });

  it("Halted, with a resumption time", () => {
    const result = marketSentence(
      ctx({ interruption: "ASSET_HALTED", interruptionSince: T - 120, expectedResumption: T + 300, reasonCode: "T1" }),
    );
    expect(result).toMatch(/^Nasdaq halted NVDA at .+: T1\. Resumes at .+\.$/);
  });

  it("Halted, no resumption time yet", () => {
    const result = marketSentence(ctx({ interruption: "ASSET_HALTED", interruptionSince: T - 120, reasonCode: "T1" }));
    expect(result).toMatch(/No resumption time yet\.$/);
  });

  it("Venue halted", () => {
    const result = marketSentence(
      ctx({ interruption: "VENUE_HALTED", reasonCode: "MWC1" }, { venueGroup: "US markets" }),
    );
    expect(result).toMatch(/^All trading on US markets is halted: MWC1\./);
  });

  it("Price-limited", () => {
    expect(marketSentence(ctx({ interruption: "PRICE_CONSTRAINED" }))).toBe(
      "NVDA is trading at a price limit on Nasdaq.",
    );
  });

  it("Unknown interruption", () => {
    const result = marketSentence(ctx({ interruption: "UNKNOWN" }, { haltFeedFamily: "US" }));
    expect(result).toMatch(/^The US halt feed has been unavailable since .+\. Bellstate can't confirm NVDA isn't halted\.$/);
  });
});

describe("embedShortForm — PRD §11.4, <= 40 chars", () => {
  it("every generated form stays within 40 characters", () => {
    const cases: MarketSentenceContext[] = [
      ctx({}),
      ctx({ session: "EXTENDED" }, { extendedPeriod: "pre-market" }),
      ctx({ session: "EXTENDED" }, { extendedPeriod: "after-hours" }),
      ctx({ session: "CLOSED" }),
      ctx({ session: "CLOSED" }, { closedReason: "lunch" }),
      ctx({ interruption: "ASSET_HALTED", reasonCode: "T1" }),
      ctx({ session: "UNKNOWN" }),
    ];
    for (const c of cases) {
      expect(embedShortForm(c).length).toBeLessThanOrEqual(40);
    }
  });

  it("matches the PRD's own examples where the inputs are unambiguous", () => {
    expect(embedShortForm(ctx({}))).toBe("Open");
    expect(embedShortForm(ctx({ session: "EXTENDED" }, { extendedPeriod: "pre-market" }))).toBe("Pre-market");
    expect(embedShortForm(ctx({ session: "EXTENDED" }, { extendedPeriod: "after-hours" }))).toBe("After-hours");
    expect(embedShortForm(ctx({ session: "CLOSED" }, { closedReason: "lunch" }))).toBe("Lunch · reopens 13:00 HKT");
    expect(embedShortForm(ctx({ interruption: "ASSET_HALTED", reasonCode: "T1" }))).toBe("Halted · T1");
    expect(embedShortForm(ctx({ session: "UNKNOWN" }))).toBe("Status unknown");
  });
});
