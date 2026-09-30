import { describe, expect, it } from "vitest";
import { isSourceHealthy } from "../src/domains/sourceHealth.js";

const T = 1_700_000_000;

describe("isSourceHealthy — §3.3 rule 1", () => {
  it("is unhealthy when there has never been a successful poll", () => {
    expect(isSourceHealthy(T, null, "REGULAR")).toBe(false);
  });

  it("is healthy within 180s while the session is non-CLOSED", () => {
    expect(isSourceHealthy(T, T - 179, "REGULAR")).toBe(true);
    expect(isSourceHealthy(T, T - 180, "REGULAR")).toBe(true);
  });

  it("is unhealthy past 180s while the session is non-CLOSED", () => {
    expect(isSourceHealthy(T, T - 181, "REGULAR")).toBe(false);
  });

  it("is healthy up to 1800s while the session is CLOSED", () => {
    expect(isSourceHealthy(T, T - 1800, "CLOSED")).toBe(true);
  });

  it("is unhealthy past 1800s while the session is CLOSED", () => {
    expect(isSourceHealthy(T, T - 1801, "CLOSED")).toBe(false);
  });
});
