// PRD §11.5 S14 — "The page is fully live." Every region needs a deployed hub, running signers,
// and an indexer, none of which exist yet. Structure only, each region labeled with what it
// needs so this isn't mistaken for real data once it's wired up.

const REGIONS = [
  { title: "Hub", needs: "a deployed BellstateHub" },
  { title: "Signers", needs: "at least one running signer Worker" },
  { title: "Heartbeats", needs: "a deployed hub with accepted heartbeats" },
  { title: "Sources", needs: "a running signer polling each source" },
  { title: "Submitter", needs: "a deployed aggregator with a funded submitter EOA" },
  { title: "Latency", needs: "an indexer with status_history rows" },
  { title: "Drift", needs: "the API's calendar-drift cron" },
  { title: "Catalog", needs: "the API's catalog-sync cron" },
  { title: "Incidents", needs: "the ops console (S16) to have posted any" },
];

export default function NetworkPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Network</h1>
      <p className="mb-6 text-sm text-ink-secondary">Signer, hub and source health.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REGIONS.map((r) => (
          <div key={r.title} className="rounded-panel border border-dashed border-border-strong bg-surface p-4">
            <h2 className="mb-1 text-sm font-semibold text-ink">{r.title}</h2>
            <p className="text-xs text-ink-muted">Needs {r.needs} — not available yet.</p>
          </div>
        ))}
      </div>
    </main>
  );
}
