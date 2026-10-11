import { describe, expect, it } from "vitest";
import { decryptWebhookSecret, encryptWebhookSecret } from "../src/webhookSecret.js";

const key = Buffer.alloc(32, 5).toString("base64");

describe("webhook secret encryption", () => {
  it("recovers the secret only with the matching key and subscription ID", () => {
    const ciphertext = encryptWebhookSecret("whsec_example", "sub-1", key);
    expect(ciphertext).not.toContain("whsec_example");
    expect(decryptWebhookSecret(ciphertext, "sub-1", key)).toBe("whsec_example");
    expect(() => decryptWebhookSecret(ciphertext, "sub-2", key)).toThrow();
    expect(() => decryptWebhookSecret(ciphertext, "sub-1", Buffer.alloc(32, 6).toString("base64"))).toThrow();
  });
});
