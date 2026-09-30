/** EIP-712 messages carry bigint fields (epoch, sessionSince, ...); JSON.stringify throws on
 * bigint directly, so every signed message is converted through this before it goes in a POST
 * body. Pure and total: every field is either a bigint (stringified) or already JSON-safe. */
export function serializeMessage(message: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message)) {
    out[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return out;
}
