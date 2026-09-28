import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { bellstateDomain } from "../src/domain.js";
import { buildMarketUpdateMessage } from "../src/build.js";
import { decodeReasonCode, encodeReasonCode } from "../src/reasonCode.js";
import { epochOf, epochStart, isFresh } from "../src/epoch.js";
import { digestFor } from "../src/hash.js";
import { signMessage } from "../src/sign.js";
import { recoverSigner, sortSignaturesByRecoveredAddress } from "../src/verify.js";
import type { MarketState } from "@winsznx/bellstate-engine";

const VERIFYING_CONTRACT = `0x${"11".repeat(20)}` as `0x${string}`;
const domain = bellstateDomain(VERIFYING_CONTRACT);

const KEY_A = `0x${"01".repeat(32)}` as `0x${string}`;
const KEY_B = `0x${"02".repeat(32)}` as `0x${string}`;

describe("reasonCode", () => {
  it('encodes the "NONE" sentinel to the zero bytes8', () => {
    expect(encodeReasonCode("NONE")).toBe("0x0000000000000000");
  });

  it("right-pads ASCII to 8 bytes and round-trips", () => {
    const encoded = encodeReasonCode("T1");
    expect(encoded).toBe("0x5431000000000000");
    expect(decodeReasonCode(encoded)).toBe("T1");
  });

  it("round-trips an 8-byte code with no padding", () => {
    const encoded = encodeReasonCode("N:LULD");
    expect(decodeReasonCode(encoded)).toBe("N:LULD");
  });

  it("rejects a code longer than 8 bytes", () => {
    expect(() => encodeReasonCode("TOOLONGCODE")).toThrow();
  });
});

describe("epoch — §6.3", () => {
  it("floors to 15-second boundaries", () => {
    const epoch = epochOf(1_700_000_000);
    const start = Number(epochStart(epoch));
    expect(epochOf(start + 14)).toBe(epoch);
    expect(epochOf(start + 15)).toBe(epoch + 1n);
  });

  it("is fresh within [epoch*15 - 15, epoch*15 + 60]", () => {
    const epoch = epochOf(1_700_000_000);
    const start = epochStart(epoch);
    expect(isFresh(epoch, start - 15n)).toBe(true);
    expect(isFresh(epoch, start - 16n)).toBe(false);
    expect(isFresh(epoch, start + 60n)).toBe(true);
    expect(isFresh(epoch, start + 61n)).toBe(false);
  });
});

describe("EIP-712 sign/verify roundtrip — §6.1/§6.2", () => {
  const listingId = `0x${"aa".repeat(32)}` as `0x${string}`;
  const market: MarketState = {
    session: "REGULAR",
    interruption: "ASSET_HALTED",
    reasonCategory: "NEWS",
    reasonCode: "T1",
    sessionSince: 1_700_000_000,
    nextScheduledTransition: 1_700_005_000,
    interruptionSince: 1_700_000_500,
    expectedResumption: 0,
  };
  const message = buildMarketUpdateMessage(listingId, 1, epochOf(1_700_000_500), market, 1);

  it("recovers the signing address from a signed message", async () => {
    const account = privateKeyToAccount(KEY_A);
    const signature = await signMessage(account, "MarketUpdate", domain, message);
    const digest = digestFor("MarketUpdate", domain, message);
    const recovered = await recoverSigner(digest, signature);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("two independent signers over identical inputs produce the same digest (§3.9-style determinism)", () => {
    const digest1 = digestFor("MarketUpdate", domain, message);
    const digest2 = digestFor("MarketUpdate", domain, { ...message });
    expect(digest1).toBe(digest2);
  });

  it("a bit-for-bit different message produces a different digest", () => {
    const digest1 = digestFor("MarketUpdate", domain, message);
    const digest2 = digestFor("MarketUpdate", domain, { ...message, seq: 2 });
    expect(digest1).not.toBe(digest2);
  });

  it("sorts recovered signers ascending and rejects duplicates", async () => {
    const accountA = privateKeyToAccount(KEY_A);
    const accountB = privateKeyToAccount(KEY_B);
    const digest = digestFor("MarketUpdate", domain, message);
    const sigA = await signMessage(accountA, "MarketUpdate", domain, message);
    const sigB = await signMessage(accountB, "MarketUpdate", domain, message);

    const [low, high] = accountA.address.toLowerCase() < accountB.address.toLowerCase() ? [sigA, sigB] : [sigB, sigA];
    const sorted = await sortSignaturesByRecoveredAddress(digest, [high, low]);
    expect(sorted[0]!.signature).toBe(low);
    expect(sorted[1]!.signature).toBe(high);

    await expect(sortSignaturesByRecoveredAddress(digest, [sigA, sigA])).rejects.toThrow(/duplicate signer/);
  });
});
