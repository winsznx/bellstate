import { describe, expect, it } from "vitest";
import {
  generateWebhookSecret,
  hashWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../src/webhookSignature.js";

describe("webhook secret generation/hashing", () => {
  it("generates a unique secret each time", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });

  it("hashes deterministically (same secret -> same hash)", () => {
    const secret = "whsec_abc123";
    expect(hashWebhookSecret(secret)).toBe(hashWebhookSecret(secret));
  });

  it("never stores the raw secret in the hash", () => {
    const secret = "whsec_abc123";
    expect(hashWebhookSecret(secret)).not.toContain(secret);
  });
});

describe("signWebhookPayload / verifyWebhookSignature — PRD §10.5 round trip", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", type: "halt.opened" });

  it("a freshly signed payload verifies", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, now, body);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
    expect(verifyWebhookSignature(secret, header, body, now)).toEqual({ valid: true });
  });

  it("rejects a tampered body", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, now, body);
    const result = verifyWebhookSignature(secret, header, body + "tampered", now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects the wrong secret", () => {
    const now = Math.floor(Date.now() / 1000);
    const header = signWebhookPayload(secret, now, body);
    const result = verifyWebhookSignature("wrong-secret", header, body, now);
    expect(result.reason).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a malformed header", () => {
    const result = verifyWebhookSignature(secret, "not-a-valid-header", body, Math.floor(Date.now() / 1000));
    expect(result.reason).toBe("MALFORMED_HEADER");
  });

  it("rejects a replayed old timestamp", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const header = signWebhookPayload(secret, old, body);
    const result = verifyWebhookSignature(secret, header, body, Math.floor(Date.now() / 1000));
    expect(result.reason).toBe("TIMESTAMP_TOO_OLD");
  });
});
