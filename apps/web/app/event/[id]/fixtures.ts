import {
  bellstateDomain,
  buildMarketUpdateMessage,
  digestFor,
  epochOf,
  privateKeyToAccount,
  recoverSigner,
  signMessage,
} from "@winsznx/bellstate-protocol";
import type { MarketState } from "@winsznx/bellstate-engine";

/**
 * PRD §11.5 S04's evidence region needs a real EIP-712 message, real signatures and real
 * signature-recovery — this fixture actually signs with packages/protocol and recovers the
 * signers at request time, rather than hand-writing fake-looking hex strings. No live hub or
 * aggregator exists yet (see internal/NEEDS.md), so the underlying "event" itself is
 * constructed, not read from a real submission — but everything cryptographic about it is real.
 */

const DEMO_KEYS = [
  `0x${"01".repeat(32)}`,
  `0x${"02".repeat(32)}`,
  `0x${"03".repeat(32)}`,
] as const;
const HUB_ADDRESS = `0x${"00".repeat(19)}01` as `0x${string}`;

export interface EventEvidence {
  id: string;
  listingId: `0x${string}`;
  symbol: string;
  venue: string;
  mic: string;
  before: MarketState;
  after: MarketState;
  digest: `0x${string}`;
  signatures: { signer: `0x${string}`; signature: `0x${string}` }[];
  txHash: `0x${string}`;
  blockNumber: number;
  gasUsed: number;
  latency: {
    tSource: number | null;
    tFirstSeen: number | null;
    tQuorum: number | null;
    tSubmitted: number | null;
    tIncluded: number | null;
    tIndexed: number | null;
  };
}

const NOW = Math.floor(Date.now() / 1000);

export async function getEventEvidence(id: string): Promise<EventEvidence | null> {
  if (id !== "demo-1") return null;

  const listingId = `0x${"11".repeat(32)}` as `0x${string}`;
  const before: MarketState = {
    session: "REGULAR",
    interruption: "NONE",
    reasonCategory: "NONE",
    reasonCode: "NONE",
    sessionSince: NOW - 5000,
    nextScheduledTransition: NOW + 5000,
    interruptionSince: 0,
    expectedResumption: 0,
  };
  const after: MarketState = {
    ...before,
    interruption: "ASSET_HALTED",
    reasonCategory: "NEWS",
    reasonCode: "T1",
    interruptionSince: NOW - 45,
  };

  const domain = bellstateDomain(HUB_ADDRESS, 196);
  const message = buildMarketUpdateMessage(listingId, 5, epochOf(NOW), after, 1);

  const digest = digestFor("MarketUpdate", domain, message);
  const signatures = await Promise.all(
    DEMO_KEYS.slice(0, 2).map(async (key) => {
      const account = privateKeyToAccount(key);
      const signature = await signMessage(account, "MarketUpdate", domain, message);
      const recovered = await recoverSigner(digest, signature);
      return { signer: recovered, signature };
    }),
  );

  return {
    id,
    listingId,
    symbol: "CTNTx",
    venue: "Nasdaq",
    mic: "XNAS",
    before,
    after,
    digest,
    signatures,
    txHash: `0x${"ab".repeat(32)}` as `0x${string}`,
    blockNumber: 12_345_678,
    gasUsed: 187_432,
    latency: {
      tSource: NOW - 60,
      tFirstSeen: NOW - 55,
      tQuorum: NOW - 50,
      tSubmitted: NOW - 48,
      tIncluded: NOW - 46,
      tIndexed: null,
    },
  };
}
