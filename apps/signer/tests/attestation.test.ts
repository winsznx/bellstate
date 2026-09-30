import { describe, expect, it } from "vitest";
import { serializeMessage } from "../src/core/attestation.js";

describe("serializeMessage", () => {
  it("stringifies bigint fields and leaves everything else untouched", () => {
    const result = serializeMessage({
      listingId: "0xabc",
      seq: 1,
      epoch: 123_456_789_012_345n,
      session: 4,
      sessionSince: 0n,
      calendarVersion: 1,
    });

    expect(result).toEqual({
      listingId: "0xabc",
      seq: 1,
      epoch: "123456789012345",
      session: 4,
      sessionSince: "0",
      calendarVersion: 1,
    });
  });

  it("round-trips through JSON.stringify without throwing", () => {
    const message = serializeMessage({ epoch: 999n });
    expect(() => JSON.stringify(message)).not.toThrow();
  });
});
