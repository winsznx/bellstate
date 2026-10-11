import { BrandWordmark } from "./BrandMark";
import Link from "next/link";

/** PRD §11.2 G2. Link the deployed X Layer mainnet hub. */
export function GlobalFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-ink-muted">
        <BrandWordmark compact />
        <Link href="/method" className="underline hover:text-ink-secondary">
          Data sources
        </Link>
        <a href="https://www.oklink.com/xlayer/address/0x714bF088613729949A2dA92709e25c1Af95c1B1B" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-secondary">BellstateHub on X Layer ↗</a>
      </div>
    </footer>
  );
}
