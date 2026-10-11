import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const apply = process.argv.includes("--apply");
const outDir = new URL("../public/assets/watch/", import.meta.url);
const excluded = new Set([
  "GOLD", "SILVER", "OIL", "COPPER", "ALUMINIUM", "JPY", "EUR", "KRW", "XYZ100",
  "SPX", "NDX", "US500", "DXY", "VIX", "NIKKEI", "KR200", "BTC", "ETH", "SOL", "HYPE",
]);

async function json(response, source) {
  if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
  return response.json();
}

const exchange = await json(await fetch("https://api.hyperliquid.xyz/info", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
  signal: AbortSignal.timeout(12_000),
}), "Hyperliquid");
if (!Array.isArray(exchange) || !Array.isArray(exchange[0]?.universe)) throw new Error("Invalid Hyperliquid universe");
const marketSymbols = new Set(exchange[0].universe
  .map((market) => typeof market?.name === "string" ? market.name.replace(/^xyz:/, "") : "")
  .filter(Boolean));

const issuerAssets = [];
for (let page = 0; page < 30; page += 1) {
  const payload = await json(await fetch(`https://api.xstocks.fi/api/v2/public/assets?page=${page}`, {
    signal: AbortSignal.timeout(12_000),
  }), "xStocks issuer catalog");
  if (!Array.isArray(payload.nodes) || typeof payload.page?.hasNextPage !== "boolean") throw new Error("Invalid issuer catalog page");
  issuerAssets.push(...payload.nodes);
  if (!payload.page.hasNextPage) break;
  if (page === 29) throw new Error("Issuer pagination exceeded 30 pages");
}

const matches = new Map();
for (const asset of issuerAssets) {
  const symbol = asset?.underlyingSymbol;
  if (typeof symbol !== "string" || !marketSymbols.has(symbol) || excluded.has(symbol)) continue;
  if (asset.symbol !== `${symbol}x` || asset.underlying?.symbol !== symbol) continue;
  if (!Array.isArray(asset.deployments) || !asset.deployments.some((deployment) => deployment.network === "XLayer")) continue;
  const mic = asset.underlying?.exchange?.mic;
  if (!["XNAS", "XNYS", "ARCX", "XASE", "XHKG", "XKRX"].includes(mic)) continue;
  if (typeof asset.logo !== "string" || !asset.logo.startsWith("https://xstocks-metadata.backed.fi/logos/tokens/")) continue;
  matches.set(symbol, { logo: asset.logo, issuerSymbol: asset.symbol, mic });
}

const summary = { exchangeMarkets: marketSymbols.size, issuerAssets: issuerAssets.length, matched: matches.size, symbols: [...matches.keys()].sort() };
process.stdout.write(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }, null, 2) + "\n");
if (!apply) process.exit(0);

await mkdir(outDir, { recursive: true });
const manifest = {};
const provenance = {};
for (const [symbol, asset] of [...matches.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const response = await fetch(asset.logo, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) continue;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100 || bytes.length > 250_000 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) continue;
  await writeFile(new URL(`${symbol}.png`, outDir), bytes);
  manifest[symbol] = `/assets/watch/${symbol}.png`;
  provenance[symbol] = { issuerSymbol: asset.issuerSymbol, mic: asset.mic, source: asset.logo, sha256: createHash("sha256").update(bytes).digest("hex") };
}
await writeFile(new URL("manifest.json", outDir), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(new URL("sources.json", outDir), JSON.stringify(provenance, null, 2) + "\n");
process.stdout.write(`Saved ${Object.keys(manifest).length} verified issuer icons\n`);
