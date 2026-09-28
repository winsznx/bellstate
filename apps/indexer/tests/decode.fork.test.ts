import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hash,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { bellstateDomain, epochOf, signMessage, sortSignaturesByRecoveredAddress, digestFor } from "@winsznx/bellstate-protocol";
import type { MarketUpdateMessage } from "@winsznx/bellstate-protocol";
import { decodeHubLog } from "../src/decodeHubLog.js";
import { deriveDomainEvents } from "../src/domainEvents.js";
import { toStatusCurrentRow, toStatusHistoryRow } from "../src/rows.js";

/**
 * Real integration test: deploys the actual compiled BellstateHub to a local anvil, submits a
 * genuinely quorum-signed MarketUpdate through it (using packages/protocol for the EIP-712
 * signing, exactly as the signer would), and decodes the real emitted log — not a synthetic
 * viem Log object. Skipped by default (needs anvil on PATH); run with:
 *
 *   RUN_FORK_TESTS=1 pnpm --filter @winsznx/bellstate-indexer test:fork
 */
const RUN = process.env.RUN_FORK_TESTS === "1";
const ANVIL_PORT = 8548;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const ANVIL_DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ANVIL_CHAIN_ID = 31337;

const HUB_ARTIFACT_PATH = join(import.meta.dirname, "..", "..", "..", "packages", "contracts", "out", "BellstateHub.sol", "BellstateHub.json");

const describeIfFork = RUN ? describe : describe.skip;

describeIfFork("apps/indexer decoding — real events from a deployed BellstateHub (anvil)", () => {
  let anvil: ChildProcess;
  let hubAddress: Address;
  const deployer = privateKeyToAccount(ANVIL_DEFAULT_KEY);
  const signerKeys = [generatePrivateKey(), generatePrivateKey(), generatePrivateKey()] as const;
  const signerAccounts = signerKeys.map((key) => privateKeyToAccount(key));

  const anvilChain = defineChain({
    id: ANVIL_CHAIN_ID,
    name: "anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });
  const publicClient = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: deployer, chain: anvilChain, transport: http(RPC_URL) });

  let hubAbi: unknown[];
  let listingId: `0x${string}`;

  beforeAll(async () => {
    anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const artifact = JSON.parse(readFileSync(HUB_ARTIFACT_PATH, "utf-8"));
    hubAbi = artifact.abi;

    const deployHash = await walletClient.deployContract({
      abi: hubAbi,
      bytecode: artifact.bytecode.object as `0x${string}`,
      account: deployer,
      args: [
        deployer.address,
        deployer.address,
        signerAccounts.map((a) => a.address),
        2,
        1,
        { marketOpen: 180, marketClosed: 1800, program: 1800, primary: 900, valuationLive: 180, valuationIdle: 1800 },
      ],
    });
    const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    hubAddress = deployReceipt.contractAddress!;

    const mic = `0x${Buffer.from("XNAS").toString("hex").padEnd(64, "0")}` as `0x${string}`;
    const symbol = `0x${Buffer.from("NVDA").toString("hex").padEnd(32, "0")}` as `0x${string}`;
    const registerHash = await walletClient.writeContract({
      address: hubAddress,
      abi: hubAbi,
      functionName: "registerListing",
      args: [mic, symbol, 1 /* DOMAIN_US_MARKETS */],
    });
    const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
    const registerLog = decodeHubLog(registerReceipt.logs[0]!) ?? null;
    // ListingRegistered isn't in HUB_EVENTS_ABI (indexer doesn't decode it yet) — read listingId
    // back via the topic directly instead.
    listingId = registerReceipt.logs[0]!.topics[1] as `0x${string}`;
    expect(registerLog).toBeNull(); // documents that registration events aren't decoded yet
  }, 30_000);

  afterAll(() => {
    anvil?.kill();
  });

  async function submitMarketUpdate(overrides: Partial<MarketUpdateMessage>, seq: number): Promise<Hash> {
    const domain = bellstateDomain(hubAddress, ANVIL_CHAIN_ID);
    const nowTs = BigInt(Math.floor(Date.now() / 1000));
    const message: MarketUpdateMessage = {
      listingId,
      seq,
      epoch: epochOf(Number(nowTs)),
      session: 1,
      interruption: 1,
      reasonCategory: 0,
      reasonCode: "0x0000000000000000",
      sessionSince: nowTs - 100n,
      interruptionSince: 0n,
      nextScheduledTransition: nowTs + 3600n,
      expectedResumption: 0n,
      calendarVersion: 1,
      ...overrides,
    };

    const digest = digestFor("MarketUpdate", domain, message);
    const sigs = await Promise.all(signerAccounts.slice(0, 2).map((_, i) => signMessage(signerAccounts[i]!, "MarketUpdate", domain, message)));
    const sorted = await sortSignaturesByRecoveredAddress(digest, sigs);

    return walletClient.writeContract({
      address: hubAddress,
      abi: hubAbi,
      functionName: "submitMarketUpdates",
      args: [[message], [sorted.map((s) => s.signature)]],
    });
  }

  it("decodes a real MarketUpdated log emitted by a genuinely quorum-signed submission", async () => {
    const hash = await submitMarketUpdate({}, 1);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    const found = receipt.logs.map(decodeHubLog).find((d) => d?.eventName === "MarketUpdated");
    expect(found).toBeDefined();
    if (found?.eventName !== "MarketUpdated") throw new Error("expected a MarketUpdated event");
    const decoded = found;
    expect(decoded.args.listingId.toLowerCase()).toBe(listingId.toLowerCase());
    expect(decoded.args.seq).toBe(1);
    expect(decoded.args.session).toBe(1);
    expect(decoded.args.interruption).toBe(1);

    const domainEvents = deriveDomainEvents(decoded);
    expect(domainEvents).toEqual([{ name: "status.market.changed", subjectId: listingId }]);

    const historyLog = receipt.logs.find((l) => decodeHubLog(l)?.eventName === "MarketUpdated")!;
    const historyRow = toStatusHistoryRow(decoded, historyLog);
    expect(historyRow.facet).toBe("market");
    expect(historyRow.seq).toBe(1);
    expect(historyRow.tx_hash).toBe(hash);
    expect(historyRow.record).not.toHaveProperty("listingId");
    expect(historyRow.record).not.toHaveProperty("seq");

    const currentRow = toStatusCurrentRow(decoded, historyLog);
    expect(currentRow.subject_id.toLowerCase()).toBe(listingId.toLowerCase());
  });

  it("a transition into ASSET_HALTED produces halt.opened when given the prior interruption", async () => {
    const hash = await submitMarketUpdate({ interruption: 3 /* ASSET_HALTED */, interruptionSince: BigInt(Math.floor(Date.now() / 1000)) }, 2);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const found = receipt.logs.map(decodeHubLog).find((d) => d?.eventName === "MarketUpdated");
    if (found?.eventName !== "MarketUpdated") throw new Error("expected a MarketUpdated event");

    const domainEvents = deriveDomainEvents(found, 1 /* prior NONE */);
    expect(domainEvents.map((e) => e.name)).toEqual(["status.market.changed", "halt.opened"]);
  });

  it("a transition out of ASSET_HALTED produces halt.resumed", async () => {
    const hash = await submitMarketUpdate({ interruption: 1 /* NONE */ }, 3);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const found = receipt.logs.map(decodeHubLog).find((d) => d?.eventName === "MarketUpdated");
    if (found?.eventName !== "MarketUpdated") throw new Error("expected a MarketUpdated event");

    const domainEvents = deriveDomainEvents(found, 3 /* prior ASSET_HALTED */);
    expect(domainEvents.map((e) => e.name)).toEqual(["status.market.changed", "halt.resumed"]);
  });
});
