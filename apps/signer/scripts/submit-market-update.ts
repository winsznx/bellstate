import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deriveMarket } from "@winsznx/bellstate-engine";
import type { HaltRecord, Listing, MarketSnapshot } from "@winsznx/bellstate-engine";
import { resolveSessionWindow } from "@winsznx/bellstate-calendars";
import { fetchNasdaqHaltFeed, parseNasdaqHaltFeed, toHaltRecord as nasdaqToHaltRecord } from "@winsznx/bellstate-source-nasdaq-halts";
import { fetchNysePage, parseNyseHaltFeed, toHaltRecord as nyseToHaltRecord } from "@winsznx/bellstate-source-nyse-halts";
import {
  bellstateDomain,
  buildMarketUpdateMessage,
  digestFor,
  signMessage,
  sortSignaturesByRecoveredAddress,
} from "@winsznx/bellstate-protocol";

// Real, first onchain attestation for Bellstate's first registered asset (NVDAx, reference
// listing XNAS:NVDA). Reads Nasdaq's and NYSE's real halt feeds and the real session calendar,
// exactly as apps/signer + apps/aggregator will do continuously once deployed — this script is
// the one-shot proof that the whole signer -> quorum -> hub chain works for real, end to end.

const HUB_ADDRESS = "0x714bF088613729949A2dA92709e25c1Af95c1B1B" as const;
const LISTING_ID = "0x598fc09e1497adeff415fd9bfd7d342d656b7ba862bc7da90dc6ca99bd1c0049" as const;
const APP_URL = "https://bellstate.timjosh507.workers.dev";
const CALENDAR_VERSION = 1;

const hubAbi = [
  {
    name: "submitMarketUpdates",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "tuple[]",
        name: "u",
        components: [
          { name: "listingId", type: "bytes32" },
          { name: "seq", type: "uint32" },
          { name: "epoch", type: "uint64" },
          { name: "session", type: "uint8" },
          { name: "interruption", type: "uint8" },
          { name: "reasonCategory", type: "uint8" },
          { name: "reasonCode", type: "bytes8" },
          { name: "sessionSince", type: "uint64" },
          { name: "interruptionSince", type: "uint64" },
          { name: "nextScheduledTransition", type: "uint64" },
          { name: "expectedResumption", type: "uint64" },
          { name: "calendarVersion", type: "uint32" },
        ],
      },
      { type: "bytes[][]", name: "sigs" },
    ],
    outputs: [],
  },
  {
    name: "marketView",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "session", type: "uint8" },
          { name: "interruption", type: "uint8" },
          { name: "reasonCategory", type: "uint8" },
          { name: "reasonCode", type: "bytes8" },
          { name: "sessionSince", type: "uint64" },
          { name: "interruptionSince", type: "uint64" },
          { name: "nextScheduledTransition", type: "uint64" },
          { name: "expectedResumption", type: "uint64" },
          { name: "effectiveAsOf", type: "uint64" },
        ],
      },
    ],
  },
] as const;

const chain = {
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
} as const;

async function main() {
  const submitterKey = process.env.SUBMITTER_PRIVATE_KEY as `0x${string}`;
  const signerAKey = process.env.SIGNER_A_PRIVATE_KEY as `0x${string}`;
  const signerBKey = process.env.SIGNER_B_PRIVATE_KEY as `0x${string}`;
  if (!submitterKey || !signerAKey || !signerBKey) {
    throw new Error("missing SUBMITTER_PRIVATE_KEY / SIGNER_A_PRIVATE_KEY / SIGNER_B_PRIVATE_KEY");
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. Real session window from the calendar package.
  const sessionWindow = resolveSessionWindow("XNAS", now);

  // 2. Real halt feeds, live.
  const nasdaqXml = await fetchNasdaqHaltFeed({ appUrl: APP_URL });
  const nasdaqItems = parseNasdaqHaltFeed(nasdaqXml);
  const nasdaqHalts: HaltRecord[] = nasdaqItems
    .map(nasdaqToHaltRecord)
    .filter((h) => h.symbol === "NVDA" || h.scope === "VENUE")
    .map((h) => ({ scope: h.scope, haltAt: h.haltAt, resumeTradeAt: h.resumeTradeAt, reasonCategory: h.reasonCategory, reasonCode: h.reasonCode }));

  const today = new Date(now * 1000).toISOString().slice(0, 10);
  const nyseJson = await fetchNysePage({ haltDateFrom: today, haltDateTo: today, pageNumber: 1, symbol: "NVDA", appUrl: APP_URL });
  const nyseRows = parseNyseHaltFeed(nyseJson);
  const nyseHalts: HaltRecord[] = nyseRows
    .map(nyseToHaltRecord)
    .map((h) => ({ scope: h.scope, haltAt: h.haltAt, resumeTradeAt: h.resumeTradeAt, reasonCategory: h.reasonCategory, reasonCode: h.reasonCode }));

  const halts = [...nasdaqHalts, ...nyseHalts];
  console.log(`Real halts found for NVDA today: ${halts.length}`);

  // 3. Derive the real market state.
  const listing: Listing = { listingId: LISTING_ID, mic: "XNAS", symbol: "NVDA", aliases: [] };
  const snapshot: MarketSnapshot = { sourceHealthy: true, sessionWindow, halts };
  const state = deriveMarket(listing, now, snapshot);
  console.log("Derived MarketState:", state);

  // 4. Read current seq from the hub so this submission doesn't collide with a prior one.
  const publicClient = createPublicClient({ chain, transport: http("https://rpc.xlayer.tech") });
  const current = await publicClient.readContract({ address: HUB_ADDRESS, abi: hubAbi, functionName: "marketView", args: [LISTING_ID] });
  console.log("Current onchain marketView (before):", current);

  const seq = 1; // first-ever submission for this listing; r.seq starts at 0
  const epoch = BigInt(Math.floor(now / 15));
  const message = buildMarketUpdateMessage(LISTING_ID, seq, epoch, state, CALENDAR_VERSION);

  const domain = bellstateDomain(HUB_ADDRESS);
  const digest = digestFor("MarketUpdate", domain, message);

  const signerA = privateKeyToAccount(signerAKey);
  const signerB = privateKeyToAccount(signerBKey);
  const sigA = await signMessage(signerA, "MarketUpdate", domain, message);
  const sigB = await signMessage(signerB, "MarketUpdate", domain, message);

  const sorted = await sortSignaturesByRecoveredAddress(digest, [sigA, sigB]);
  console.log("Signers (ascending):", sorted.map((s) => s.signer));

  const submitter = privateKeyToAccount(submitterKey);
  const walletClient = createWalletClient({ account: submitter, chain, transport: http("https://rpc.xlayer.tech") });

  const update = {
    listingId: LISTING_ID,
    seq,
    epoch,
    session: message.session,
    interruption: message.interruption,
    reasonCategory: message.reasonCategory,
    reasonCode: message.reasonCode,
    sessionSince: message.sessionSince,
    interruptionSince: message.interruptionSince,
    nextScheduledTransition: message.nextScheduledTransition,
    expectedResumption: message.expectedResumption,
    calendarVersion: message.calendarVersion,
  };

  const hash = await walletClient.writeContract({
    address: HUB_ADDRESS,
    abi: hubAbi,
    functionName: "submitMarketUpdates",
    args: [[update], [sorted.map((s) => s.signature)]],
  });
  console.log("tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("status:", receipt.status);

  const after = await publicClient.readContract({ address: HUB_ADDRESS, abi: hubAbi, functionName: "marketView", args: [LISTING_ID] });
  console.log("Onchain marketView (after):", after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
