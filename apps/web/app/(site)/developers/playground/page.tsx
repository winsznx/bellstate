// PRD §11.5 S11. Needs a deployed hub/adapters to call (none exist — no funded wallets, no
// mainnet deploy yet) and wallet connect (not wired). Structure only.

export default function PlaygroundPage() {
  return (
    <main className="mx-auto max-w-[900px] px-6 py-8">
      <h1 className="mb-2 text-3xl font-semibold text-ink">Contract playground</h1>
      <p className="mb-6 text-sm text-ink-secondary">Call the live contracts without writing code.</p>
      <div className="rounded-panel border border-dashed border-border-strong bg-surface p-6 text-sm text-ink-muted">
        No hub is deployed yet — there is nothing to call. This screen will let you invoke
        adapter views, LendingGuard, PrintGuard, hub reads and a PolicyLens what-if runner once a
        hub exists on X Layer mainnet.
      </div>
    </main>
  );
}
