import { notFound } from "next/navigation";
import { getAssetDetail } from "../../../asset/[symbol]/fixtures";

/** PRD §11.5 S06. Same "no pool yet" reality as S05 — needs a deployed HaltGate pool and
 * PositionManager reads, neither exist yet. */
export default async function LiquidityPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const asset = getAssetDetail(symbol);
  if (!asset) notFound();

  return (
    <main className="mx-auto max-w-[600px] px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-ink">Liquidity · {asset.symbol}</h1>
      <div className="rounded-panel border border-dashed border-border-strong bg-surface p-6 text-sm text-ink-muted">
        No HaltGate pool yet for {asset.symbol}. Pool terms, positions, and add/remove liquidity
        need a deployed pool — not available yet.
      </div>
    </main>
  );
}
