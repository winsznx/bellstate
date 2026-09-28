import { describe, expect, it } from "vitest";
import { matchesFilters } from "../src/filters.js";

describe("matchesFilters — PRD §10.5: AND across groups, empty group means all", () => {
  it("an empty filter object matches everything", () => {
    expect(matchesFilters({}, { type: "halt.opened", symbol: "NVDAx" })).toBe(true);
  });

  it("a types filter excludes non-matching event types", () => {
    expect(matchesFilters({ types: ["halt.opened"] }, { type: "halt.resumed" })).toBe(false);
    expect(matchesFilters({ types: ["halt.opened"] }, { type: "halt.opened" })).toBe(true);
  });

  it("multiple non-empty groups apply as AND", () => {
    const filters = { types: ["halt.opened"], mics: ["XNAS"] };
    expect(matchesFilters(filters, { type: "halt.opened", mic: "XNAS" })).toBe(true);
    expect(matchesFilters(filters, { type: "halt.opened", mic: "XHKG" })).toBe(false);
  });

  it("a symbols filter rejects an event with no symbol", () => {
    expect(matchesFilters({ symbols: ["NVDAx"] }, { type: "status.market.changed" })).toBe(false);
  });

  it("a families filter matches on family", () => {
    expect(matchesFilters({ families: ["KR"] }, { type: "halt.opened", family: "KR" })).toBe(true);
    expect(matchesFilters({ families: ["KR"] }, { type: "halt.opened", family: "US" })).toBe(false);
  });
});
