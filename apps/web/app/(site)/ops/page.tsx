// PRD §11.5 S16 — this route remains unavailable until SIWE and operator authorization exist.

export default function OpsPage() {
  return (
    <main className="mx-auto flex w-full max-w-[700px] flex-col items-start gap-4 px-5 py-14 sm:px-8 sm:py-20">
      <h1 className="text-3xl font-semibold text-ink">Operator console</h1>
      <p className="max-w-[560px] text-sm leading-6 text-ink-secondary">
        Operator access is not available in the web app yet. The hub is deployed, but wallet
        sign-in, operator authorization and the API routes for reviewing and recording actions
        are not connected. No operator actions can be submitted from this page.
      </p>
    </main>
  );
}
