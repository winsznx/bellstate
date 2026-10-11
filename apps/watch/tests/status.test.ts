import { describe, expect, it, vi } from "vitest";
import { decodeMarketStatus } from "../src/status.js";

describe("decodeMarketStatus", () => {
  it("does not treat an expired attestation as a current market state", () => {
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    try {
      const listingId = `0x${"ab".repeat(32)}`;
      const record = { session: 4, interruption: 3, sessionSince: 1_760_000_000, nextScheduledTransition: 1_760_000_100 };
      expect(decodeMarketStatus({ record }, listingId)).toEqual({ listingId, session: "UNKNOWN", interruption: "UNKNOWN", sessionSince: 0 });
      expect(decodeMarketStatus({ record: { ...record, nextScheduledTransition: 1_860_000_100 } }, listingId).session).toBe("CLOSED");
    } finally {
      vi.useRealTimers();
    }
  });
});
