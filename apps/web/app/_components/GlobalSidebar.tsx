"use client";

import { BrandWordmark } from "./BrandMark";

import { Activity, BarChart3, Bell, Code2, LayoutGrid, Menu, Radio, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WalletButton } from "./WalletButton";

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
 * Wallet button (G5) is implemented in WalletButton.tsx.
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
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      } else if (event.key === "Tab" && drawer.current) {
        const focusable = Array.from(drawer.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-[3px]" aria-label="Main navigation">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[46px] items-center gap-[13px] rounded-[12px] px-3.5 py-2.5 text-sm transition-colors duration-fast ${
              active ? "bg-white font-semibold text-ink shadow-soft" : "text-ink-secondary hover:bg-white/70 hover:text-ink"
            }`}
          >
            <Icon size={20} className={active ? "opacity-100" : "opacity-75"} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const actions = (onNavigate?: () => void) => (
    <div className="flex flex-col gap-2 pt-5">
      <WalletButton />
      <Link href="/board" onClick={onNavigate} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-pill bg-brand text-sm font-medium text-white transition-colors duration-fast hover:bg-brand-strong">
        Browse assets
      </Link>
    </div>
  );

  return (
    <>
    <header className="flex h-16 items-center justify-between border-b border-black/[0.08] px-4 md:hidden">
      <Link href="/board" aria-label="Bellstate Board"><BrandWordmark /></Link>
      <button ref={menuButton} type="button" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Menu size={23} aria-hidden />
      </button>
    </header>
    {open && (
      <div className="fixed inset-0 z-50 md:hidden">
        <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close navigation" onClick={() => setOpen(false)} />
        <aside ref={drawer} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation" className="relative flex h-full w-[min(320px,calc(100vw-48px))] flex-col overflow-y-auto bg-shell-bg p-4 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <BrandWordmark />
            <button ref={closeButton} type="button" aria-label="Close navigation" onClick={() => { setOpen(false); menuButton.current?.focus(); }} className="grid h-11 w-11 place-items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><X size={22} aria-hidden /></button>
          </div>
          {nav(() => setOpen(false))}
          {actions(() => setOpen(false))}
          <Link href="/method" onClick={() => setOpen(false)} className="mt-auto pt-8 text-sm font-medium text-ink-secondary">Read the methodology ↗</Link>
        </aside>
      </div>
    )}
    <aside className="sticky top-0 hidden h-screen w-rail shrink-0 flex-col justify-between overflow-y-auto p-4 pb-[18px] pt-6 md:flex">
      <div>
        <Link href="/board" className="flex items-center px-2.5 pb-[22px] pt-1.5">
          <BrandWordmark />
        </Link>

        {nav()}
        {actions()}
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
    </>
  );
}
