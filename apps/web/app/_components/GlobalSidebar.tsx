"use client";

import { Activity, BarChart3, Bell, Code2, LayoutGrid, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * PRD §11.2 G1, rebuilt to match the real structure of a rail this project's owner pointed at —
 * verified against that product's actual `NavRail.tsx` + `product.css` (not its design-system
 * markdown, which documents a superseded look — see design/tokens.md): 262px rail, a translucent
 * "org card" pattern (here just the wordmark, since Bellstate has no workspace/org concept), nav
 * items with an icon + label that go white-with-shadow when active, a full-width pill CTA, and a
 * translucent help card pinned to the bottom. Icons are `lucide-react` (a real, generic icon
 * library matching the source's 24px/1.5-stroke visual language) rather than that product's own
 * specific icon SVG files.
 *
 * Search/command palette (G3), network pill (G8) and wallet button (G5) need client state/live
 * data/wallet integration not wired up yet.
 */
const NAV = [
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/watch", label: "Watch", icon: Radio },
  { href: "/replay", label: "Replays", icon: Activity },
  { href: "/developers", label: "Developers", icon: Code2 },
  { href: "/network", label: "Network", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function GlobalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-rail shrink-0 flex-col justify-between overflow-y-auto p-4 pb-[18px] pt-6">
      <div>
        <Link href="/board" className="flex items-center px-2.5 pb-[22px] pt-1.5">
          <span className="text-lg font-semibold tracking-tight text-ink">Bellstate</span>
        </Link>

        <nav className="flex flex-col gap-[3px]" aria-label="Main navigation">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[46px] items-center gap-[13px] rounded-[12px] px-3.5 py-2.5 text-sm transition-colors duration-fast ${
                  active
                    ? "bg-white font-semibold text-ink shadow-soft"
                    : "text-ink-secondary hover:bg-white/70 hover:text-ink"
                }`}
              >
                <Icon size={20} className={active ? "opacity-100" : "opacity-75"} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="pt-5">
          <Link
            href="/board"
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-pill bg-brand text-sm font-medium text-white transition-colors duration-fast hover:bg-brand-strong"
          >
            <span aria-hidden>+</span> Star an asset
          </Link>
        </div>
      </div>

      <div>
        <div className="mb-3.5 rounded-2xl bg-white/70 p-4">
          <span className="mb-[11px] grid h-8 w-8 place-items-center rounded-[10px] bg-white text-[17px]" aria-hidden>
            ⓘ
          </span>
          <strong className="block text-[13px] font-semibold text-ink">Never predicted, only observed.</strong>
          <p className="my-1.5 mb-3 text-xs leading-relaxed text-ink-secondary">
            Every status shown here is signed by a real halt source at a real time — nothing is
            estimated.
          </p>
          <Link href="/method" className="flex min-h-8 items-center justify-between text-xs font-semibold text-ink">
            Read the methodology <span aria-hidden>↗</span>
          </Link>
        </div>
        <div className="mt-3 border-t border-black/[0.08] px-3 pt-3.5 text-[11px] text-ink-muted">
          Real-market status, onchain.
        </div>
      </div>
    </aside>
  );
}
