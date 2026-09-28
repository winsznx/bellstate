// PRD §11.5 S16 — SIWE + operator allowlist. "Not an operator -> 403" is the correct state here
// since no wallet connect / SIWE / operator allowlist exists yet.

export default function OpsPage() {
  return (
    <main className="mx-auto flex max-w-[600px] flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold text-ink">403 — Operators only</h1>
      <p className="text-sm text-ink-secondary">
        This console needs SIWE sign-in and an operator allowlist, neither of which are wired up
        yet (no deployed hub, no Safe, no API service).
      </p>
    </main>
  );
}
