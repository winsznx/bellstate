const BASE = "https://api.xstocks.fi/api/v2/public/assets";

async function fetchCatalog() {
  const all: any[] = [];
  let page = 0;
  while (true) {
    const url = `${BASE}?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const body = await res.json();
    if (!Array.isArray(body.nodes)) throw new Error(`unexpected shape at page ${page}: keys=${Object.keys(body).join(",")}`);
    all.push(...body.nodes);
    if (!body.page?.hasNextPage) break;
    page += 1;
    if (page > 50) throw new Error("pagination runaway guard hit");
  }
  return all;
}

async function main() {
  const assets = await fetchCatalog();
  const symbols = assets.map((a) => a.symbol);
  const required = ["NVDAx", "SKHYx", "TCENTx"];
  const present = required.filter((r) => symbols.some((s) => String(s).toLowerCase() === r.toLowerCase()));
  const missing = required.filter((r) => !present.includes(r));

  const xlayerAsset = assets.find((a) => a.symbol?.toLowerCase() === "nvdax");
  const xlayerDeployment = xlayerAsset?.deployments?.find((d: any) => d.network === "XLayer");

  console.log(
    JSON.stringify(
      {
        totalAssets: assets.length,
        requiredPresent: present,
        requiredMissing: missing,
        sampleAssetShapeKeys: xlayerAsset ? Object.keys(xlayerAsset) : [],
        sampleTradingExchangeShape: xlayerAsset?.trading?.exchange ?? null,
        sampleLimitsPerPeriodShape: xlayerAsset?.trading?.limitsPerPeriod ?? null,
        sampleXLayerDeployment: xlayerDeployment ?? null,
      },
      null,
      2
    )
  );
  const pass = missing.length === 0;
  console.log(pass ? "\nGATE G16: PASS" : "\nGATE G16: FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("GATE G16: FAIL —", err.message);
  process.exit(1);
});
