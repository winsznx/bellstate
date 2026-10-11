const INFO_URL = "https://api.hyperliquid.xyz/info";

export interface PublicMarket {
  name: string;
  oracle: number | null;
  mark: number | null;
  funding: number | null;
  dayVolume: number | null;
  dayChange: number | null;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadPublicMarkets(): Promise<{ markets: PublicMarket[]; fetchedAt: string }> {
  const response = await fetch(INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Hyperliquid returned HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || payload.length !== 2) throw new Error("Invalid Hyperliquid response");
  const [meta, contexts] = payload;
  if (!isRecord(meta) || !Array.isArray(meta.universe) || !Array.isArray(contexts) || meta.universe.length !== contexts.length) {
    throw new Error("Invalid Hyperliquid market list");
  }
  const markets: PublicMarket[] = [];
  for (let index = 0; index < meta.universe.length; index += 1) {
    const asset: unknown = meta.universe[index];
    const context: unknown = contexts[index];
    if (!isRecord(asset) || !isRecord(context) || typeof asset.name !== "string" || !asset.name.startsWith("xyz:")) continue;
    const oracle = decimal(context.oraclePx);
    const previous = decimal(context.prevDayPx);
    markets.push({
      name: asset.name,
      oracle,
      mark: decimal(context.markPx),
      funding: decimal(context.funding),
      dayVolume: decimal(context.dayNtlVlm),
      dayChange: oracle !== null && previous !== null && previous > 0 ? (oracle / previous - 1) * 100 : null,
    });
  }
  return { markets: markets.sort((a, b) => a.name.localeCompare(b.name)), fetchedAt: new Date().toISOString() };
}
