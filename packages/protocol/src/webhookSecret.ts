import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyBytes(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error("WEBHOOK_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

/** AES-256-GCM; the subscription ID binds ciphertext to its row. */
export function encryptWebhookSecret(secret: string, subscriptionId: string, encodedKey: string): string {
  const nonce = Buffer.from(randomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", keyBytes(encodedKey), nonce);
  cipher.setAAD(Buffer.from(subscriptionId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [VERSION, nonce.toString("base64url"), ciphertext.toString("base64url"), Buffer.from(cipher.getAuthTag()).toString("base64url")].join(".");
}

export function decryptWebhookSecret(value: string, subscriptionId: string, encodedKey: string): string {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION || !parts[1] || !parts[2] || !parts[3]) {
    throw new Error("invalid webhook secret ciphertext");
  }
  const nonce = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("invalid webhook secret ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(encodedKey), nonce);
  decipher.setAAD(Buffer.from(subscriptionId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8");
}

export function signWebhookPayload(secret: string, timestamp: number, rawBody: string): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
