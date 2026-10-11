import deployment from "../../../deployments/xlayer-mainnet.json" with { type: "json" };

const apply = process.argv.includes("--apply");
const listingId = deployment.assets.NVDAx.listingId.toLowerCase();
const marketName = "NVDA";
const dex = "xyz";

async function main(): Promise<void> {
  const marketResponse = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex }),
    signal: AbortSignal.timeout(8000),
  });
  if (!marketResponse.ok) throw new Error(`Hyperliquid returned HTTP ${marketResponse.status}`);
  const payload: unknown = await marketResponse.json();
  if (!Array.isArray(payload) || payload.length !== 2 || !Array.isArray(payload[0]?.universe) ||
    !payload[0].universe.some((item: unknown) => typeof item === "object" && item !== null && "name" in item && item.name === `${dex}:${marketName}`)) {
    throw new Error(`Hyperliquid did not list ${dex}:${marketName}`);
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase URL and service role key are required");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const listingResponse = await fetch(`${base}/rest/v1/listings?listing_id=eq.${listingId}&select=listing_id,mic,symbol,active`, { headers });
  if (!listingResponse.ok) throw new Error(`Listing read returned HTTP ${listingResponse.status}`);
  const listings = await listingResponse.json() as { listing_id: string; mic: string; symbol: string; active: boolean }[];
  if (listings.length !== 1 || listings[0]?.mic !== "XNAS" || listings[0].symbol !== marketName || !listings[0].active) {
    throw new Error("The verified NVDA reference listing is absent or inactive");
  }

  const existingResponse = await fetch(`${base}/rest/v1/perp_markets?dex=eq.${dex}&name=eq.${marketName}&select=dex,name,primary_listing_id,underlying_listing_ids`, { headers });
  if (!existingResponse.ok) throw new Error(`Mapping read returned HTTP ${existingResponse.status}`);
  const existing = await existingResponse.json() as { primary_listing_id: string | null; underlying_listing_ids: string[] }[];
  if (existing.length > 1 || (existing.length === 1 &&
    (existing[0]?.primary_listing_id?.toLowerCase() !== listingId || JSON.stringify(existing[0].underlying_listing_ids.map((id) => id.toLowerCase())) !== JSON.stringify([listingId])))) {
    throw new Error("An existing NVDA Watch mapping conflicts with the verified listing");
  }
  process.stdout.write(`${apply ? "apply" : "dry-run"}: ${dex}:${marketName} → XNAS:${marketName} (${listingId}); ${existing.length ? "already present" : "missing"}\n`);
  if (!apply || existing.length) return;
  const written = await fetch(`${base}/rest/v1/perp_markets`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ dex, name: marketName, primary_listing_id: listingId, underlying_listing_ids: [listingId], spec_url: "https://trade.xyz" }),
  });
  if (!written.ok) throw new Error(`Mapping insert returned HTTP ${written.status}: ${await written.text()}`);
  process.stdout.write(`Inserted ${dex}:${marketName} mapping\n`);
}

await main();
