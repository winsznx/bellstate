type BrandMarkProps = { size?: number; className?: string };

/** A bell silhouette with a market-state pulse at its center. */
export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M8 22h16l-2-2.8V14a6 6 0 0 0-12 0v5.2L8 22Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.5 25a2.5 2.5 0 0 0 5 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m11.2 17 2.6-2.2 2.1 3.2 2-4 2.9 2" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <BrandMark size={compact ? 22 : 28} />
      <span className={compact ? "text-sm" : "text-lg"}>Bellstate</span>
    </span>
  );
}
