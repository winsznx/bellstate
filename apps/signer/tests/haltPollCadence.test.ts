import { describe, expect, it } from "vitest";
import {
  isUsTradingWindow,
  nasdaqPollPeriodSeconds,
  nysePollPeriodSeconds,
} from "../src/scheduling/haltPollCadence.js";

describe("isUsTradingWindow — PRD §4.1/§4.2's 04:00–20:00 ET window", () => {
  it("is true for every non-CLOSED session (REGULAR, EXTENDED, AUCTION)", () => {
    expect(isUsTradingWindow("REGULAR")).toBe(true);
    expect(isUsTradingWindow("EXTENDED")).toBe(true);
    expect(isUsTradingWindow("AUCTION")).toBe(true);
  });

  it("is false when CLOSED (nights, weekends, holidays, and after a half day's 17:00 close)", () => {
    expect(isUsTradingWindow("CLOSED")).toBe(false);
  });

  it("is true for UNKNOWN — resolveSessionWindow's calendar math never actually returns UNKNOWN in practice, but if it ever did, the safe default for a polling-cadence decision is to poll faster, not slower", () => {
    expect(isUsTradingWindow("UNKNOWN")).toBe(true);
  });
});

describe("nasdaqPollPeriodSeconds — PRD §4.1", () => {
  it("polls every 60s inside the trading window", () => {
    expect(nasdaqPollPeriodSeconds("REGULAR")).toBe(60);
    expect(nasdaqPollPeriodSeconds("EXTENDED")).toBe(60);
  });

  it("backs off to every 300s outside it", () => {
    expect(nasdaqPollPeriodSeconds("CLOSED")).toBe(300);
  });
});

describe("nysePollPeriodSeconds — PRD §4.2", () => {
  it("polls every 30s inside the trading window — faster than Nasdaq's 60s, and decoupled from it", () => {
    expect(nysePollPeriodSeconds("REGULAR")).toBe(30);
    expect(nysePollPeriodSeconds("EXTENDED")).toBe(30);
  });

  it("backs off to every 300s outside it, same as Nasdaq's off-hours period", () => {
    expect(nysePollPeriodSeconds("CLOSED")).toBe(300);
  });
});
