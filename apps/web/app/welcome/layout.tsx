import Link from "next/link";

/**
 * PRD has no marketing/landing page in its route table (§11.2 puts the Board at "/") — this is
 * an addition, added at /welcome rather than displacing the Board, per explicit direction. Top
 * nav structure matches the real marketing header this project's owner pointed at: logo left,
 * anchor nav center, "open app" + primary CTA right.
 */
const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#coverage", label: "Coverage" },
  { href: "#sources", label: "Sources" },
];

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link href="/welcome" className="text-lg font-semibold tracking-tight">
            Bellstate
          </Link>
          <nav className="hidden gap-8 text-sm text-ink-secondary sm:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-ink">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-ink-secondary hover:text-ink">
              Open the Board
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-control bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
            >
              View live status
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
