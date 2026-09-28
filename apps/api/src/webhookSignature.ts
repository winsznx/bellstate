import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** PRD §10.5: "Secret. Returned once, then stored as a SHA-256 hash." */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

export function hashWebhookSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** PRD §10.5: "Bellstate-Signature: t=<unix>,v1=<hex(hmac_sha256(secret, t + "." + rawBody))>" */
export function signWebhookPayload(secret: string, timestamp: number, rawBody: string): string {
  const signed = `${timestamp}.${rawBody}`;
  const v1 = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export interface VerifyResult {
  valid: boolean;
  reason?: "MALFORMED_HEADER" | "SIGNATURE_MISMATCH" | "TIMESTAMP_TOO_OLD";
}

/**
 * PRD §10 and the "docs (S10) include a verification snippet (Node and Python)" requirement —
 * this IS that Node reference implementation, not just a signer. `maxAgeSeconds` guards against
 * a replayed old payload; 300s (5 min) is a conventional webhook-replay window.
 */
export function verifyWebhookSignature(
  secret: string,
  header: string,
  rawBody: string,
  nowSeconds: number,
  maxAgeSeconds = 300,
): VerifyResult {
  const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header);
  if (!match) return { valid: false, reason: "MALFORMED_HEADER" };

  const timestamp = Number(match[1]);
  const providedSig = match[2]!;

  if (Math.abs(nowSeconds - timestamp) > maxAgeSeconds) {
    return { valid: false, reason: "TIMESTAMP_TOO_OLD" };
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(providedSig, "hex");
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false, reason: "SIGNATURE_MISMATCH" };
  }

  return { valid: true };
}
