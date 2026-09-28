import Link from "next/link";

/** PRD §11.2 G1. Search/command palette (G3), network pill (G8) and wallet button (G5) need
 * client state / live data / wallet integration not wired up yet — nav links only. */
const NAV = [
  { href: "/", label: "Board" },
  { href: "/watch", label: "Watch" },
  { href: "/replay", label: "Replays" },
  { href: "/developers", label: "Developers" },
  { href: "/network", label: "Network" },
  { href: "/alerts", label: "Alerts" },
];

export function GlobalHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-6 py-3">
        <Link href="/" className="text-lg font-semibold text-ink">
          Bellstate
        </Link>
        <nav className="flex gap-4 text-sm text-ink-secondary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
