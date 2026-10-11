import { BrandMark } from "../../_components/BrandMark";
import { AssetIcon } from "../../_components/AssetIcon";
import { embedShortForm } from "@winsznx/bellstate-ui";
import type { Mic } from "@winsznx/bellstate-calendars";
import { loadAssetDetail } from "../../(site)/asset/[symbol]/data";

export const dynamic = "force-dynamic";

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { symbol } = await params;
  const { size = "compact" } = await searchParams;
  const { asset, error } = await loadAssetDetail(symbol);
  if (error || !asset)
    return (
      <div className="flex h-full items-center justify-center bg-surface p-3 text-sm text-ink-muted">
        {error ? "Live status unavailable" : "Asset not tracked"}
      </div>
    );
  const shortForm =
    asset.market && asset.mic
      ? embedShortForm({
          venue: asset.venueName ?? asset.mic,
          symbol: asset.symbol,
          mic: asset.mic as Mic,
          state: asset.market,
        })
      : "Status not indexed";
  const freshness = asset.facets.market
    ? `Effective ${new Date(asset.facets.market.effectiveAsOf).toLocaleString()}`
    : "No onchain market status";
  if (size === "full")
    return (
      <div className="flex h-full flex-col justify-between bg-surface p-4">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-ink">
            <AssetIcon symbol={asset.symbol} size={28} />
            {asset.symbol}
          </div>
          <div className="mt-1 text-sm text-ink-secondary">{shortForm}</div>
          <div className="mt-1 text-xs text-ink-muted">{freshness}</div>
        </div>
        <a
          href={`/asset/${encodeURIComponent(asset.symbol)}`}
          className="text-xs text-ink-muted underline"
        >
          <span className="inline-flex items-center gap-1.5">
            <BrandMark size={16} />
            Bellstate
          </span>
        </a>
      </div>
    );
  return (
    <div className="flex h-full items-center gap-2 bg-surface px-3 py-2 text-sm">
      <AssetIcon symbol={asset.symbol} size={22} />
      <span className="font-medium text-ink">{asset.symbol}</span>
      <span className="text-ink-secondary">{shortForm}</span>
      <span className="sr-only">{freshness}</span>
    </div>
  );
}
