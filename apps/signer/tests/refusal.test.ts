import { describe, expect, it } from "vitest";
import { computeRefusalReasons } from "../src/core/refusal.js";

const T = 1_700_000_000;

function baseInput() {
  return {
    localCalendarVersion: 1,
    hubCalendarVersion: 1,
    nowSeconds: T,
    frozenUntil: 0,
    latestBlockTimestamp: T,
    maxClockSkewSeconds: 5,
  };
}

describe("computeRefusalReasons — §8.1", () => {
  it("returns no reasons when everything lines up", () => {
    expect(computeRefusalReasons(baseInput())).toEqual([]);
  });

  it("refuses on a calendar version mismatch", () => {
    const reasons = computeRefusalReasons({ ...baseInput(), hubCalendarVersion: 2 });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/calendar_version_mismatch/);
  });

  it("refuses while the hub is frozen (now < frozenUntil)", () => {
    const reasons = computeRefusalReasons({ ...baseInput(), frozenUntil: T + 100 });
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/hub_frozen_until=/);
  });

  it("does not refuse once frozenUntil has passed", () => {
    expect(computeRefusalReasons({ ...baseInput(), frozenUntil: T - 1 })).toEqual([]);
  });

  it("refuses when the clock is more than 5s off the latest block timestamp, either direction", () => {
    expect(computeRefusalReasons({ ...baseInput(), latestBlockTimestamp: T - 6 })[0]).toMatch(/clock_skew/);
    expect(computeRefusalReasons({ ...baseInput(), latestBlockTimestamp: T + 6 })[0]).toMatch(/clock_skew/);
  });

  it("tolerates exactly 5s of skew", () => {
    expect(computeRefusalReasons({ ...baseInput(), latestBlockTimestamp: T - 5 })).toEqual([]);
  });

  it("reports every violated condition at once", () => {
    const reasons = computeRefusalReasons({
      localCalendarVersion: 1,
      hubCalendarVersion: 2,
      nowSeconds: T,
      frozenUntil: T + 10,
      latestBlockTimestamp: T + 60,
      maxClockSkewSeconds: 5,
    });
    expect(reasons).toHaveLength(3);
  });
});
