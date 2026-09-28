import { compareBySeverity, formatVenueTime, PROGRAM_LIFECYCLE_LABELS, PRIMARY_LEG_LABELS, VALUATION_LABELS, VALUATION_NOT_PROVIDED_LABEL } from "@winsznx/bellstate-ui";
import type { Mic } from "@winsznx/bellstate-calendars";
import { InterruptionChip, SessionChip } from "./_components/StatusChip";
import { VenueTile } from "./_components/VenueTile";
import { BOARD_ROWS } from "./fixtures";

// PRD §11.5 S01. Fixture-backed for now — see fixtures.ts for why. Structure and states follow
// the spec's region order (venue strip → summary → filter bar → asset table → live feed);
// visual polish beyond design/tokens.md's tokens is intentionally withheld per gate G15 (no
// Bellstate-specific screen mockups exist yet in design/reference/).

const VENUES: { mic: Mic; venueName: string }[] = [
  { mic: "XNAS", venueName: "Nasdaq" },
  { mic: "XNYS", venueName: "NYSE" },
  { mic: "XHKG", venueName: "HKEX" },
  { mic: "XKRX", venueName: "KRX" },
  { mic: "NXTE", venueName: "Nextrade" },
];

function summarize(rows: typeof BOARD_ROWS) {
  const counts: Record<string, number> = { REGULAR: 0, EXTENDED: 0, AUCTION: 0, CLOSED: 0, UNKNOWN: 0 };
  let halted = 0;
  for (const row of rows) {
    if (row.market.interruption === "ASSET_HALTED" || row.market.interruption === "VENUE_HALTED") {
      halted++;
    } else {
      counts[row.market.session] = (counts[row.market.session] ?? 0) + 1;
    }
  }
  return { counts, halted };
}

export default function BoardPage() {
  const sorted = [...BOARD_ROWS].sort((a, b) => compareBySeverity(a.market, b.market));
  const summary = summarize(BOARD_ROWS);

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-ink">Board</h1>
        <p className="mt-1 text-sm text-ink-secondary">Real-market status of every tracked onchain stock.</p>
      </header>

      {/* Region 1: venue strip */}
      <section aria-label="Venues" className="mb-8 flex gap-4 overflow-x-auto pb-2">
        {VENUES.map((v) => {
          const rowsForVenue = BOARD_ROWS.filter((r) => r.mic === v.mic);
          const representative = rowsForVenue[0];
          return (
            <VenueTile
              key={v.mic}
              mic={v.mic}
              venueName={v.venueName}
              session={representative?.market.session ?? "UNKNOWN"}
              nextTransition={representative ? formatVenueTime(representative.market.nextScheduledTransition, v.mic, false) : "—"}
              openHalts={rowsForVenue.filter((r) => r.market.interruption === "ASSET_HALTED").length}
              sourceHealthy={representative?.market.interruption !== "UNKNOWN"}
            />
          );
        })}
      </section>

      {/* Region 2: summary */}
      <section aria-label="Summary" className="mb-8 flex flex-wrap gap-6 border-y border-border py-4 text-sm">
        <span className="text-ink-secondary">
          Regular <strong className="text-ink">{summary.counts.REGULAR}</strong>
        </span>
        <span className="text-ink-secondary">
          Extended <strong className="text-ink">{summary.counts.EXTENDED}</strong>
        </span>
        <span className="text-ink-secondary">
          Auction <strong className="text-ink">{summary.counts.AUCTION}</strong>
        </span>
        <span className="text-ink-secondary">
          Closed <strong className="text-ink">{summary.counts.CLOSED}</strong>
        </span>
        <span className="text-ink-secondary">
          Unknown <strong className="text-ink">{summary.counts.UNKNOWN}</strong>
        </span>
        <span className="text-status-halted">
          Open halts <strong>{summary.halted}</strong>
        </span>
      </section>

      {/* Region 3: filter bar — static placeholder; search/chips/sort need client state + the
          URL-query round-trip the spec requires, not built yet. */}
      <section aria-label="Filters" className="mb-4 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search symbol, name, ISIN or token address"
          className="w-full max-w-md rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
          disabled
        />
        <span className="text-xs text-ink-muted">Filters not yet wired — static snapshot only</span>
      </section>

      {/* Region 4: asset table — ruled rows, hairlines only, no card shadow per row (design
          system §7/§20: bounded-object-as-card vs. row-in-a-register). */}
      <section aria-label="Assets" className="mb-8 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="py-2 pr-4">Symbol</th>
              <th className="py-2 pr-4">Reference listing</th>
              <th className="py-2 pr-4">Session</th>
              <th className="py-2 pr-4">Interruption</th>
              <th className="py-2 pr-4">Valuation</th>
              <th className="py-2 pr-4">Primary</th>
              <th className="py-2 pr-4">Program</th>
              <th className="py-2 pr-4">Next transition</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.symbol} className="border-b border-border hover:bg-surface-muted">
                <td className="py-3 pr-4">
                  <div className="font-medium text-ink">{row.symbol}</div>
                  <div className="text-xs text-ink-muted">{row.name}</div>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-ink-secondary">
                  {row.mic}:{row.symbol.replace(/x$/, "")}
                </td>
                <td className="py-3 pr-4">
                  <SessionChip session={row.market.session} />
                </td>
                <td className="py-3 pr-4">
                  <InterruptionChip
                    interruption={row.market.interruption}
                    reasonText={row.market.reasonCode !== "NONE" ? row.market.reasonCode : undefined}
                  />
                </td>
                <td className="py-3 pr-4 text-ink-secondary">
                  {row.valuationCondition === "NOT_PROVIDED"
                    ? VALUATION_NOT_PROVIDED_LABEL
                    : VALUATION_LABELS[row.valuationCondition]}
                </td>
                <td className="py-3 pr-4 text-ink-secondary">{PRIMARY_LEG_LABELS[row.primaryIssuance]}</td>
                <td className="py-3 pr-4 text-ink-secondary">{PROGRAM_LIFECYCLE_LABELS[row.programLifecycle]}</td>
                <td className="py-3 pr-4 text-ink-muted">
                  {formatVenueTime(row.market.nextScheduledTransition, row.mic as Mic, false)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Region 5: live feed — needs Realtime on status_current/halt_events, not wired yet. */}
      <section aria-label="Live feed">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Live feed</h2>
        <p className="text-sm text-ink-muted">Realtime feed not yet connected — no backend deployed.</p>
      </section>
    </main>
  );
}
