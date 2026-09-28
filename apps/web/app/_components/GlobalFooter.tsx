import Link from "next/link";

/** PRD §11.2 G2. Contract addresses need a deployed hub (none exists) — omitted rather than
 * shown as placeholder addresses that would look real but aren't. */
export function GlobalFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-ink-muted">
        <span>Bellstate</span>
        <Link href="/method" className="underline hover:text-ink-secondary">
          Data sources
        </Link>
        <span>No contracts deployed yet</span>
      </div>
    </footer>
  );
}
