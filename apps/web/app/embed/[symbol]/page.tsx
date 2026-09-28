import { embedShortForm } from "@winsznx/bellstate-ui";
import type { Mic } from "@winsznx/bellstate-calendars";
import { getAssetDetail } from "../../(site)/asset/[symbol]/fixtures";

// PRD §11.5 S17. Live through Supabase Realtime (anon), no wallet, no cookies — not wired yet
// (no Supabase project exists; see internal/NEEDS.md), so this reads the same asset fixture the
// Asset screen uses. `frame-ancestors *` needs to be set at the routing layer (middleware or
// next.config headers), not per-page — not configured yet.

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { symbol } = await params;
  const { size = "compact" } = await searchParams;
  const asset = getAssetDetail(symbol);

  if (!asset) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-3 text-sm text-ink-muted">
        Asset not tracked
      </div>
    );
  }

  const shortForm = embedShortForm({ venue: asset.venueName, symbol: asset.symbol, mic: asset.mic as Mic, state: asset.market });

  if (size === "full") {
    return (
      <div className="flex h-full flex-col justify-between bg-surface p-4">
        <div>
          <div className="text-lg font-semibold text-ink">{asset.symbol}</div>
          <div className="mt-1 text-sm text-ink-secondary">{shortForm}</div>
        </div>
        <a href={`https://bellstate.app/asset/${asset.symbol}`} className="text-xs text-ink-muted underline">
          Bellstate
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center gap-2 bg-surface px-3 py-2 text-sm">
      <span className="font-medium text-ink">{asset.symbol}</span>
      <span className="text-ink-secondary">{shortForm}</span>
    </div>
  );
}
