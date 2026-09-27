import { createPublicClient, http } from "viem";

const XLAYER_RPC = "https://rpc.xlayer.tech";

const client = createPublicClient({
  chain: { id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [XLAYER_RPC] } } },
  transport: http(XLAYER_RPC),
});

// Source: developers.uniswap.org/docs/protocols/v4/deployments, "X Layer: 196" table
// (linked to verified OKLink contract pages), plus canonical Permit2/Multicall3 addresses
// (mds1/multicall3 README; Permit2 deployed identically across EVM chains).
const CONTRACTS: Record<string, `0x${string}`> = {
  PoolManager: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
  PositionManager: "0xcF1EAFC6928dC385A342E7C6491d371d2871458b",
  V4Quoter: "0x8928074CA1b241D8Ec02815881c1Af11E8bC5219",
  UniversalRouter: "0x8B844f885672f333Bc0042cB669255f93a4C1E6b",
  Permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  Multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
};

async function main() {
  const results: Record<string, { address: string; hasCode: boolean }> = {};
  for (const [name, address] of Object.entries(CONTRACTS)) {
    const code = await client.getBytecode({ address });
    results[name] = { address, hasCode: !!code && code !== "0x" };
  }
  console.log(JSON.stringify(results, null, 2));
  const missing = Object.entries(results).filter(([, r]) => !r.hasCode);
  const pass = missing.length === 0;
  if (!pass) {
    console.error(`\nMISSING (no bytecode): ${missing.map(([n]) => n).join(", ")}`);
  }
  console.log(pass ? "\nGATE G12: PASS" : "\nGATE G12: FAIL");
  process.exit(pass ? 0 : 1);
}

main();
