/** PRD §11.5 S02 region 2: "Four facet cards (Market, Valuation, Primary, Program). Each shows
 * the ERC-8392 values plus as-of, since, next transition or expected resumption, and its source
 * link." Source-link / "Read onchain eth_call" toggle needs a live adapter, not built yet. */
export function FacetCard({
  title,
  rows,
  notProvidedReason,
}: {
  title: string;
  rows: { label: string; value: string }[];
  notProvidedReason?: string;
}) {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-elevated">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      {notProvidedReason ? (
        <p className="text-sm text-ink-muted">Not provided for this asset: {notProvidedReason}</p>
      ) : (
        <dl className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="text-right font-mono text-xs text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
