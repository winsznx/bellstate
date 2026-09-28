import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, defineChain, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as haltGate from "../src/haltGate.js";
import * as lending from "../src/lending.js";
import * as print from "../src/print.js";
import type { MarketView, ProgramView, Resumption, ValuationView } from "../src/types.js";

/**
 * PRD §7.7/§14.2: "packages/policy equals PolicyLens on 10,000 random inputs." Requires a local
 * anvil + the compiled PolicyLens artifact from packages/contracts — both fully local, no
 * mainnet/credentials needed, but skipped by default since `pnpm test` shouldn't require anvil
 * on PATH. Run with `RUN_FORK_TESTS=1 pnpm test:fork` (packages/policy/package.json).
 * ITERATIONS controls the count per function; default 200 for a fast run, set to 10000 to match
 * the PRD's own gate exactly:
 *
 *   RUN_FORK_TESTS=1 ITERATIONS=10000 pnpm --filter @winsznx/bellstate-policy test:fork
 */
const RUN = process.env.RUN_FORK_TESTS === "1";
const ITERATIONS = Number(process.env.ITERATIONS ?? 200);
const ANVIL_PORT = 8547;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const ANVIL_DEFAULT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

const ARTIFACT_PATH = join(
  import.meta.dirname,
  "..",
  "..",
  "contracts",
  "out",
  "PolicyLens.sol",
  "PolicyLens.json",
);

const describeIfFork = RUN ? describe : describe.skip;

function rand(max: number): number {
  return Math.floor(Math.random() * max);
}
function randBig(max: bigint): bigint {
  return BigInt(Math.floor(Math.random() * Number(max)));
}
function randBool(): boolean {
  return Math.random() < 0.5;
}
function randBytes8(): `0x${string}` {
  const bytes = Array.from({ length: 8 }, () => rand(256).toString(16).padStart(2, "0")).join("");
  return `0x${bytes}` as `0x${string}`;
}
function randBytes32(): `0x${string}` {
  const bytes = Array.from({ length: 32 }, () => rand(256).toString(16).padStart(2, "0")).join("");
  return `0x${bytes}` as `0x${string}`;
}

function randMarketView(nowTs: bigint): MarketView {
  return {
    session: rand(5),
    interruption: rand(5),
    reasonCategory: rand(11),
    reasonCode: randBytes8(),
    sessionSince: randBig(nowTs),
    interruptionSince: randBig(nowTs),
    nextScheduledTransition: randBig(nowTs + 10_000n),
    expectedResumption: randBig(nowTs + 10_000n),
    seq: rand(1000),
    writtenAt: randBig(nowTs),
    effectiveAsOf: randBig(nowTs),
    unknownSince: randBig(nowTs),
    stale: randBool(),
    mic: randBytes32(),
  };
}
function randProgramView(): ProgramView {
  return {
    lifecycle: rand(5),
    programStatus: rand(3),
    programReason: rand(5),
    seq: rand(1000),
    writtenAt: 0n,
    effectiveAsOf: 0n,
    stale: randBool(),
  };
}
function randValuationView(): ValuationView {
  return {
    condition: rand(7),
    sourceMarketStatus: rand(3),
    conditionSince: 0n,
    valueAsOf: 0n,
    nextExpectedUpdate: 0n,
    seq: rand(1000),
    writtenAt: 0n,
    effectiveAsOf: 0n,
    stale: randBool(),
  };
}
function randResumption(nowTs: bigint): Resumption {
  return { at: randBool() ? 0n : randBig(nowTs), category: rand(11) };
}

describeIfFork("packages/policy parity vs PolicyLens.sol (anvil, local-only)", () => {
  let anvil: ChildProcess;
  let policyLensAddress: Address;
  let abi: unknown[];
  const anvilChain = defineChain({
    id: 31337,
    name: "anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  });
  const account = privateKeyToAccount(ANVIL_DEFAULT_KEY);
  const publicClient = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: anvilChain, transport: http(RPC_URL) });

  beforeAll(async () => {
    anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"]);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf-8"));
    abi = artifact.abi;
    const hash = await walletClient.deployContract({
      abi,
      bytecode: artifact.bytecode.object as `0x${string}`,
      account,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    policyLensAddress = receipt.contractAddress!;
  }, 30_000);

  afterAll(() => {
    anvil?.kill();
  });

  it(`haltGateDecide matches PolicyLens on ${ITERATIONS} random inputs`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const nowTs = 1_800_000_000n + randBig(100_000n);
      const m = randMarketView(nowTs);
      const p = randProgramView();
      const r = randResumption(nowTs);
      const params = haltGate.defaultParams();

      const tsResult = haltGate.decide(m, p, r, params, nowTs);
      const onchain = (await publicClient.readContract({
        address: policyLensAddress,
        abi,
        functionName: "haltGateDecide",
        args: [m, p, r, params, nowTs],
      })) as haltGate.HaltGateDecision;

      expect(tsResult.verdict, `iteration ${i}`).toBe(onchain.verdict);
      expect(tsResult.mode, `iteration ${i}`).toBe(onchain.mode);
      expect(tsResult.fee, `iteration ${i}`).toBe(onchain.fee);
    }
  }, 120_000);

  it(`lendingCanLiquidate matches PolicyLens on ${ITERATIONS} random inputs`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const nowTs = 1_800_000_000n + randBig(100_000n);
      const seqStartedAt = randBig(nowTs);
      const market = randMarketView(nowTs);
      const program = randProgramView();
      const valuation = randValuationView();
      const hasValuation = randBool();
      const profile = rand(3) as lending.LendingProfile;
      const seqUp = randBool();

      const tsResult = lending.canLiquidate({ market, program, valuation, hasValuation, profile, nowTs, seqUp, seqStartedAt });
      const [ok, reason] = (await publicClient.readContract({
        address: policyLensAddress,
        abi,
        functionName: "lendingCanLiquidate",
        args: [market, program, valuation, hasValuation, profile, nowTs, seqUp, seqStartedAt],
      })) as [boolean, number];

      expect(tsResult.ok, `iteration ${i}`).toBe(ok);
      expect(tsResult.reason, `iteration ${i}`).toBe(reason);
    }
  }, 120_000);

  it(`lendingMaxLtv matches PolicyLens on ${ITERATIONS} random inputs`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const nowTs = 1_800_000_000n + randBig(100_000n);
      const seqStartedAt = randBig(nowTs);
      const market = randMarketView(nowTs);
      const valuation = randValuationView();
      const hasValuation = randBool();
      const baseLtvBps = rand(10_000);
      const seqUp = randBool();

      const tsResult = lending.maxLtvBps(market, valuation, hasValuation, baseLtvBps, seqUp, nowTs, seqStartedAt);
      const onchain = (await publicClient.readContract({
        address: policyLensAddress,
        abi,
        functionName: "lendingMaxLtv",
        args: [market, valuation, hasValuation, baseLtvBps, seqUp, nowTs, seqStartedAt],
      })) as number;

      expect(tsResult, `iteration ${i}`).toBe(onchain);
    }
  }, 120_000);

  it(`printVerdict/printVerdictSecondary match PolicyLens on ${ITERATIONS} random inputs`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const nowTs = 1_800_000_000n + randBig(100_000n);
      const printTs = randBig(nowTs + 10_000n);
      const venue: print.PrintVenueState = {
        found: randBool(),
        outOfHistory: randBool(),
        session: rand(5),
        interruption: rand(5),
        sessionStartedAt: randBig(nowTs),
      };
      const primary: print.PrintVenueState = {
        found: randBool(),
        outOfHistory: randBool(),
        session: rand(5),
        interruption: rand(5),
        sessionStartedAt: randBig(nowTs),
      };

      const tsSingle = print.verdictSingle(venue, printTs, nowTs);
      const onchainSingle = (await publicClient.readContract({
        address: policyLensAddress,
        abi,
        functionName: "printVerdict",
        args: [venue, printTs, nowTs],
      })) as [number, number, number, number];
      expect(tsSingle.verdict, `single iteration ${i}`).toBe(onchainSingle[0]);
      expect(tsSingle.flags, `single iteration ${i}`).toBe(onchainSingle[1]);

      const tsSecondary = print.verdictSecondary(venue, primary, printTs, nowTs);
      const onchainSecondary = (await publicClient.readContract({
        address: policyLensAddress,
        abi,
        functionName: "printVerdictSecondary",
        args: [venue, primary, printTs, nowTs],
      })) as [number, number];
      expect(tsSecondary.verdict, `secondary iteration ${i}`).toBe(onchainSecondary[0]);
      expect(tsSecondary.flags, `secondary iteration ${i}`).toBe(onchainSecondary[1]);
    }
  }, 120_000);
});
