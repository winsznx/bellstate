import Link from "next/link";

/** PRD §11.2 S18 (partial: not-found only; the error boundary isn't built). */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-[600px] flex-col items-start gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold text-ink">Not found</h1>
      <p className="text-sm text-ink-secondary">
        That symbol, venue or page isn&apos;t tracked by Bellstate.
      </p>
      <Link href="/" className="text-sm font-medium text-brand underline">
        Back to the Board
      </Link>
    </main>
  );
}
