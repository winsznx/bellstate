import { recoverAddress } from "viem";

export async function recoverSigner(digest: `0x${string}`, signature: `0x${string}`): Promise<`0x${string}`> {
  return recoverAddress({ hash: digest, signature });
}

/** PRD §6.2: "Sort signature arrays by recovered signer address ascending; the hub rejects
 * duplicates and non-members." Throws on a duplicate recovered signer. */
export async function sortSignaturesByRecoveredAddress(
  digest: `0x${string}`,
  signatures: readonly `0x${string}`[],
): Promise<{ signer: `0x${string}`; signature: `0x${string}` }[]> {
  const recovered = await Promise.all(
    signatures.map(async (signature) => ({ signer: await recoverSigner(digest, signature), signature })),
  );
  recovered.sort((a, b) => (a.signer.toLowerCase() < b.signer.toLowerCase() ? -1 : 1));
  for (let i = 1; i < recovered.length; i++) {
    if (recovered[i]!.signer.toLowerCase() === recovered[i - 1]!.signer.toLowerCase()) {
      throw new Error(`duplicate signer: ${recovered[i]!.signer}`);
    }
  }
  return recovered;
}
