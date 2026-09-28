import { WATCH_ROWS } from "./fixtures";

// PRD §11.5 S07. Market table structure built against a fixture (no live Hyperliquid polling or
// stored perp_snapshots exist yet — see internal/NEEDS.md). Flag drawer (10-minute chart) and
// live flag feed need the same real data pipeline and aren't built.

const FLAG_LABEL: Record<string, string> = {
  NONE: "—",
  THIN_OPEN_MOVE: "Thin open move",
  CLOSED_MOVE: "Closed move",
};

export default function WatchPage() {
  const sorted = [...WATCH_ROWS].sort((a, b) => (b.lastFlagAt ?? 0) - (a.lastFlagAt ?? 0));

  return (
    <main className="mx-auto max-w-[1200px] px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Oracle Watch</h1>
      <p className="mb-6 text-sm text-ink-secondary">
        Hyperliquid HIP-3 equity perps against their reference venue.
      </p>

      <section aria-label="Market table" className="mb-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-2 pr-4">Market</th>
              <th className="py-2 pr-4">Underlying</th>
              <th className="py-2 pr-4">Oracle</th>
              <th className="py-2 pr-4">Mark</th>
              <th className="py-2 pr-4">5m</th>
              <th className="py-2 pr-4">Reference status</th>
              <th className="py-2 pr-4">Flag</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.dex} className="border-b border-border">
                <td className="py-3 pr-4 font-mono text-xs text-ink">{row.dex}</td>
                <td className="py-3 pr-4 text-ink-secondary">{row.underlyingListing}</td>
                <td className="py-3 pr-4 text-ink">{row.oraclePx.toLocaleString()}</td>
                <td className="py-3 pr-4 text-ink">{row.markPx.toLocaleString()}</td>
                <td className={`py-3 pr-4 ${row.change5m < 0 ? "text-status-halted" : "text-status-regular"}`}>
                  {row.change5m > 0 ? "+" : ""}
                  {row.change5m.toFixed(2)}%
                </td>
                <td className="py-3 pr-4 text-ink-secondary">{row.referenceStatus}</td>
                <td className="py-3 pr-4">
                  {row.flagState !== "NONE" ? (
                    <span className="rounded-control bg-close-soft px-2 py-0.5 text-xs text-close">
                      {FLAG_LABEL[row.flagState]}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Live flag feed" className="border-t border-border pt-6 text-sm text-ink-muted">
        Live flag feed and flag drawer need real Hyperliquid polling and stored perp_snapshots —
        not built yet.
      </section>
    </main>
  );
}
