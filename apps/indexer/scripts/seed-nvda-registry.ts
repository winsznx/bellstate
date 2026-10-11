import { readFile } from "node:fs/promises";
import { createPublicClient, http } from "viem";
import deployment from "../../../deployments/xlayer-mainnet.json" with { type: "json" };

const apply = process.argv.includes("--apply");
const rpc = createPublicClient({ transport: http(process.env.XLAYER_RPC_URL ?? "https://rpc.xlayer.tech", { timeout: 10_000 }) });
const asset = deployment.assets.NVDAx;
const hub = deployment.contracts.BellstateHub as `0x${string}`;
const abi = (JSON.parse(await readFile(new URL("../../../packages/contracts/out/BellstateHub.sol/BellstateHub.json", import.meta.url), "utf8")) as { abi: readonly unknown[] }).abi;
const tokenAbi = [{ type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" }] as const;

interface IssuerAsset {
  symbol: string;
  name: string;
  isin: string;
  underlyingSymbol: string;
  underlyingIsin: string;
  deployments: { network: string; address: string; wrapperAddressV2?: string }[];
}

function cleanHex(value: string): string { return value.toLowerCase(); }

async function main(): Promise<void> {
  const response = await fetch("https://api.xstocks.fi/api/v2/public/assets/NVDAx", { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Issuer returned HTTP ${response.status}`);
  const issuer = await response.json() as IssuerAsset;
  const xlayer = issuer.deployments.find((item) => item.network === "XLayer");
  if (issuer.symbol !== "NVDAx" || issuer.underlyingSymbol !== "NVDA" || !xlayer ||
    cleanHex(xlayer.address) !== cleanHex(asset.rawToken) || cleanHex(xlayer.wrapperAddressV2 ?? "") !== cleanHex(asset.wrappedToken)) {
    throw new Error("Issuer catalog and deployed token addresses disagree");
  }
  const [chainId, listing, program, rawInfo, wrappedInfo, rawDecimals, wrappedDecimals] = await Promise.all([
    rpc.getChainId(),
    rpc.readContract({ address: hub, abi, functionName: "listingInfo", args: [asset.listingId] }),
    rpc.readContract({ address: hub, abi, functionName: "programInfo", args: [asset.programId] }),
    rpc.readContract({ address: hub, abi, functionName: "tokenInfo", args: [asset.rawToken] }),
    rpc.readContract({ address: hub, abi, functionName: "tokenInfo", args: [asset.wrappedToken] }),
    rpc.readContract({ address: asset.rawToken as `0x${string}`, abi: tokenAbi, functionName: "decimals" }),
    rpc.readContract({ address: asset.wrappedToken as `0x${string}`, abi: tokenAbi, functionName: "decimals" }),
  ]);
  if (chainId !== deployment.chainId) throw new Error(`Wrong chain ${chainId}`);
  const listingInfo = listing as { mic: `0x${string}`; symbol: `0x${string}`; domain: number; active: boolean };
  const [programInfo, homeListings] = program as [{ referenceListing: string; hasPrimary: boolean; hasValuation: boolean; active: boolean }, string[]];
  const raw = rawInfo as { programId: string; adapter: string; kind: number; poolEligible: boolean };
  const wrapped = wrappedInfo as typeof raw;
  if (!listingInfo.active || !programInfo.active || cleanHex(programInfo.referenceListing) !== cleanHex(asset.listingId) ||
    cleanHex(raw.programId) !== cleanHex(asset.programId) || cleanHex(wrapped.programId) !== cleanHex(asset.programId) ||
    raw.kind !== 1 || wrapped.kind !== 2 || cleanHex(raw.adapter) !== cleanHex(asset.rawAdapter) || cleanHex(wrapped.adapter) !== cleanHex(asset.wrappedAdapter)) {
    throw new Error("Onchain registry disagrees with deployment manifest");
  }
  const decode = (hex: `0x${string}`) => Buffer.from(hex.slice(2), "hex").toString("utf8").replace(/\0+$/, "");
  if (decode(listingInfo.mic) !== "XNAS" || decode(listingInfo.symbol) !== "NVDA" || listingInfo.domain !== 1) {
    throw new Error("Unexpected onchain listing identity");
  }
  const rows = [
    { table: "listings", key: "listing_id", value: asset.listingId, data: { listing_id: cleanHex(asset.listingId), mic: "XNAS", symbol: "NVDA", name: "NVIDIA Corporation", isin: issuer.underlyingIsin, currency: "USD", domain: listingInfo.domain, active: listingInfo.active } },
    { table: "programs", key: "program_id", value: asset.programId, data: { program_id: cleanHex(asset.programId), issuer: "xStocks by Backed", symbol: issuer.symbol, name: issuer.name, isin: issuer.isin, underlying_isin: issuer.underlyingIsin, reference_listing_id: cleanHex(asset.listingId), home_listing_ids: homeListings.map(cleanHex), has_primary: programInfo.hasPrimary, active: programInfo.active } },
    { table: "tokens", key: "address", value: asset.rawToken, data: { address: cleanHex(asset.rawToken), program_id: cleanHex(asset.programId), kind: "raw", decimals: rawDecimals, adapter: cleanHex(raw.adapter), pool_eligible: raw.poolEligible } },
    { table: "tokens", key: "address", value: asset.wrappedToken, data: { address: cleanHex(asset.wrappedToken), program_id: cleanHex(asset.programId), kind: "wrapped", decimals: wrappedDecimals, adapter: cleanHex(wrapped.adapter), pool_eligible: wrapped.poolEligible } },
  ];
  process.stdout.write(JSON.stringify({ mode: apply ? "apply" : "dry-run", rows }, null, 2) + "\n");
  if (!apply) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase URL and service role key are required for --apply");
  for (const row of rows) {
    const existing = await fetch(`${base}/rest/v1/${row.table}?${row.key}=eq.${cleanHex(row.value)}&select=${row.key}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!existing.ok) throw new Error(`Read ${row.table}: HTTP ${existing.status}`);
    const found = await existing.json() as unknown[];
    if (found.length) { process.stdout.write(`Skipped existing ${row.table} ${row.value}\n`); continue; }
    const written = await fetch(`${base}/rest/v1/${row.table}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row.data),
    });
    if (!written.ok) throw new Error(`Insert ${row.table}: HTTP ${written.status} ${await written.text()}`);
    process.stdout.write(`Inserted ${row.table} ${row.value}\n`);
  }
}

await main();
