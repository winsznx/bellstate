import { createPublicClient, http, parseAbi } from "viem";

const XLAYER_RPC = "https://rpc.xlayer.tech";

const client = createPublicClient({
  chain: { id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [XLAYER_RPC] } } },
  transport: http(XLAYER_RPC),
});

// PRD §2.1 verified examples
const NVDAX_RAW = "0xc845b2894dbddd03858fd2d643b4ef725fe0849d" as `0x${string}`;
const NVDAX_WRAPPED = "0xa8ddb5cd96b5222afe198316e9a57caa642850d5" as `0x${string}`;

const abi = parseAbi(["function isPaused() view returns (bool)"]);

async function main() {
  const results: Record<string, unknown> = {};
  for (const [label, address] of Object.entries({ raw: NVDAX_RAW, wrapped: NVDAX_WRAPPED })) {
    try {
      const result = await client.readContract({ address, abi, functionName: "isPaused" });
      results[label] = { address, isPaused: result, pass: typeof result === "boolean" };
    } catch (err) {
      results[label] = { address, error: (err as Error).message, pass: false };
    }
  }
  console.log(JSON.stringify(results, null, 2));
  const pass = Object.values(results).every((r: any) => r.pass);
  console.log(pass ? "\nGATE G13: PASS" : "\nGATE G13: FAIL");
  process.exit(pass ? 0 : 1);
}

main();
