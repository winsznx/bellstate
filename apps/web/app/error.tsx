"use client";

/** PRD §11.2 S18 — the error boundary half of "not-found, error". Must be a client component
 * per Next.js's error.tsx convention. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-[600px] flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="text-sm text-ink-secondary">
        This page hit an error{error.digest ? ` (ref: ${error.digest})` : ""}. Try again, or head
        back to the Board.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-control bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <a href="/" className="rounded-control border border-border px-4 py-2 text-sm text-ink-secondary">
          Back to the Board
        </a>
      </div>
    </main>
  );
}
