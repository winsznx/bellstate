import { notFound } from "next/navigation";
import type { Mic } from "@winsznx/bellstate-calendars";
import { marketSentence } from "@winsznx/bellstate-ui";
import { getAssetDetail } from "../../asset/[symbol]/fixtures";

// PRD §11.5 S05. Status banner reuses the real marketSentence + fixture data (same as S02).
// Swap card, reference lines, "why this fee?", wrap/unwrap and wallet connect all need a
// deployed HaltGate pool and wallet integration (Permit2, UniversalRouter) — none of which
// exist yet (no hub/pools deployed, no funded wallets). Renders the PRD's own "No HaltGate pool
// yet" state instead of guessing at swap UI that can't be tested against anything real.

export default async function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const asset = getAssetDetail(symbol);
  if (!asset) notFound();

  return (
    <main className="mx-auto max-w-[600px] px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-ink">Trade {asset.symbol}</h1>
      <p className="mb-6 text-sm text-ink-secondary">
        {marketSentence({ venue: asset.venueName, symbol: asset.symbol, mic: asset.mic as Mic, state: asset.market })}
      </p>
      <div className="rounded-panel border border-dashed border-border-strong bg-surface p-6 text-sm text-ink-muted">
        No HaltGate pool yet. Swaps, wrap/unwrap and wallet connect need a deployed pool and
        onchain adapter — not available yet.
      </div>
    </main>
  );
}
