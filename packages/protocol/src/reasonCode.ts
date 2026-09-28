const ZERO_BYTES8 = "0x0000000000000000" as const;

/** PRD §3.3/§6.2: "reasonCode is ASCII right-padded to 8 bytes." "NONE → category NONE, code
 * 0x0" — the engine's "NONE" sentinel string maps to the zero bytes8, not literal ASCII "NONE". */
export function encodeReasonCode(code: string): `0x${string}` {
  if (code === "NONE") return ZERO_BYTES8;
  const bytes = new TextEncoder().encode(code);
  if (bytes.length > 8) throw new Error(`reasonCode "${code}" exceeds 8 bytes`);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(16, "0")}` as `0x${string}`;
}

export function decodeReasonCode(hex: `0x${string}`): string {
  if (hex.toLowerCase() === ZERO_BYTES8) return "NONE";
  const body = hex.slice(2);
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i += 2) {
    const byte = Number.parseInt(body.slice(i, i + 2), 16);
    if (byte === 0) break;
    bytes.push(byte);
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}
