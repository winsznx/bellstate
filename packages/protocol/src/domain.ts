import type { TypedDataDomain } from "viem";

/** PRD §6.2. */
export function bellstateDomain(verifyingContract: `0x${string}`, chainId = 196): TypedDataDomain {
  return { name: "Bellstate", version: "1", chainId, verifyingContract };
}
