"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * PRD §11.2 G1, built per the owned design system's actual shell spec (design/tokens.md,
 * design.md §8): "Desktop: 224px quiet left rail... Rail treatment: warm canvas, active item
 * uses brand text + 2px terminal bar, not a floating rounded pill." An earlier version of this
 * used a generic top nav bar instead — a real deviation from the given system's information
 * architecture, not just missing polish, caught and fixed here.
 *
 * Search/command palette (G3), network pill (G8) and wallet button (G5) need client state/live
 * data/wallet integration not wired up yet — nav links only.
 */
const NAV = [
  { href: "/", label: "Board" },
  { href: "/watch", label: "Watch" },
  { href: "/replay", label: "Replays" },
  { href: "/developers", label: "Developers" },
  { href: "/network", label: "Network" },
  { href: "/alerts", label: "Alerts" },
];

export function GlobalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-border bg-canvas">
      <div className="px-5 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          Bellstate
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-control px-3 py-2 text-sm transition-colors duration-fast ${
                active ? "font-medium text-brand" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {active ? <span className="absolute inset-y-1 left-0 w-0.5 bg-brand" aria-hidden /> : null}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
