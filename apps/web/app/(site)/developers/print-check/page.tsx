// PRD §11.5 S12. Form fields and the two real presets from the PRD are built. "Pay and run"
// needs x402 (OKX Web3 API keys, gate G11 — blocked, see internal/NEEDS.md) and a wallet
// connection, neither wired — the button renders the PRD's own "wallet not connected" state.

const PRESETS = [
  {
    label: "Jul 28, 2026 · SK hynix on Nextrade",
    listing: "NXTE:000660",
    timestamp: "2026-07-28T08:00:00+09:00",
    price: "₩1,272,000",
    size: "1 share",
    prevClose: "₩1,816,000",
  },
  {
    label: "Aug 6, 2026 · SK hynix on Nextrade",
    listing: "NXTE:000660",
    timestamp: "2026-08-06T08:00:00+09:00",
    price: "₩1,168,000",
    size: "11 shares",
    prevClose: "₩1,668,000",
  },
];

export default function PrintCheckPage() {
  return (
    <main className="mx-auto max-w-[700px] px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Print Check console</h1>
      <p className="mb-6 text-sm text-ink-secondary">Run the paid print check with a real x402 payment.</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-control border border-border bg-surface px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-muted"
            disabled
          >
            {p.label}
          </button>
        ))}
      </div>

      <form className="space-y-4">
        {[
          { label: "Listing", placeholder: "NXTE:000660" },
          { label: "Timestamp (venue local)", placeholder: "2026-07-28T08:00:00+09:00" },
          { label: "Price", placeholder: "1272000" },
          { label: "Size", placeholder: "1" },
          { label: "Currency", placeholder: "KRW" },
          { label: "Previous close", placeholder: "1816000" },
        ].map((field) => (
          <div key={field.label}>
            <label className="mb-1 block text-xs text-ink-muted">{field.label}</label>
            <input
              type="text"
              placeholder={field.placeholder}
              disabled
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted"
            />
          </div>
        ))}
        <button
          type="button"
          disabled
          className="w-full rounded-control bg-surface-strong px-4 py-2 text-sm font-medium text-ink-muted"
        >
          Wallet not connected
        </button>
        <p className="text-xs text-ink-muted">
          Requires x402 payment (0.002 USDT0) and a connected wallet — x402 isn&apos;t wired yet
          (blocked on OKX Web3 API credentials, gate G11).
        </p>
      </form>
    </main>
  );
}
