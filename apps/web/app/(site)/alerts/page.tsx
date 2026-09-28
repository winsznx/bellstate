// PRD §11.5 S13. Telegram linking (F12) and webhooks (F13, SIWE) both need the API service and
// Supabase, neither deployed yet. Shells showing the spec's own not-connected states.

export default function AlertsPage() {
  return (
    <main className="mx-auto max-w-[700px] px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold text-ink">Alerts</h1>

      <section aria-label="Telegram" className="mb-8 rounded-panel border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Telegram</h2>
        <p className="mb-3 text-sm text-ink-secondary">
          Get alerts for assets, venues and event types you choose.
        </p>
        <button type="button" disabled className="rounded-control bg-surface-strong px-4 py-2 text-sm text-ink-muted">
          Connect Telegram
        </button>
        <p className="mt-2 text-xs text-ink-muted">
          Needs the API service and a Telegram bot token (blocked, see internal/NEEDS.md) — not
          wired yet.
        </p>
      </section>

      <section aria-label="Webhooks" className="rounded-panel border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">Webhooks</h2>
        <p className="text-sm text-ink-secondary">Sign in to manage webhooks.</p>
        <p className="mt-2 text-xs text-ink-muted">
          Needs SIWE and a deployed API/Supabase — not wired yet.
        </p>
      </section>
    </main>
  );
}
