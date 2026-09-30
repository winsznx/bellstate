import { describe, expect, it } from "vitest";
import { matchesFilters } from "../src/filters.js";

describe("matchesFilters — PRD §10.5: AND across groups, empty group means all", () => {
  it("returns true when #given an empty filter object #when matched against any event", () => {
    // #given
    const filters = {};
    // #when
    const result = matchesFilters(filters, { type: "halt.opened", symbol: "NVDAx" });
    // #then
    expect(result).toBe(true);
  });

  it("excludes non-matching event types when #given a types filter", () => {
    // #given
    const filters = { types: ["halt.opened"] };
    // #when / #then
    expect(matchesFilters(filters, { type: "halt.resumed" })).toBe(false);
    expect(matchesFilters(filters, { type: "halt.opened" })).toBe(true);
  });

  it("applies multiple non-empty groups as AND", () => {
    // #given
    const filters = { types: ["halt.opened"], mics: ["XNAS"] };
    // #when / #then
    expect(matchesFilters(filters, { type: "halt.opened", mic: "XNAS" })).toBe(true);
    expect(matchesFilters(filters, { type: "halt.opened", mic: "XHKG" })).toBe(false);
  });

  it("rejects an event with no symbol when #given a symbols filter", () => {
    // #given
    const filters = { symbols: ["NVDAx"] };
    // #when
    const result = matchesFilters(filters, { type: "status.market.changed" });
    // #then
    expect(result).toBe(false);
  });

  it("matches when the event shares at least one family with the filter", () => {
    // #given
    const filters = { families: ["NVDAx", "TSLAx"] };
    // #when / #then
    expect(matchesFilters(filters, { type: "halt.opened", families: ["NVDAx"] })).toBe(true);
    expect(matchesFilters(filters, { type: "halt.opened", families: ["TSLAx", "AAPLx"] })).toBe(true);
    expect(matchesFilters(filters, { type: "halt.opened", families: ["AAPLx"] })).toBe(false);
  });

  it("rejects an event with no families when #given a families filter", () => {
    // #given
    const filters = { families: ["NVDAx"] };
    // #when
    const result = matchesFilters(filters, { type: "halt.opened" });
    // #then
    expect(result).toBe(false);
  });
});
