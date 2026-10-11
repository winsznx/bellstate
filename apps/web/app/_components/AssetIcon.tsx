import Image from "next/image";

type AssetIconProps = { symbol: string; size?: number; className?: string; issuerLogo?: string | null };

const ASSET_ICONS: Record<string, string> = {
  NVDAx: "/assets/tokens/nvdax.png",
  SKHYx: "/assets/tokens/skhyx.png",
  TCENTx: "/assets/tokens/tcentx.png",
  CTNTx: "/assets/tokens/ctnt-company.webp",
};

/** Issuer artwork where available; CTNTx uses underlying company artwork. See manifest.json. */
export function AssetIcon({ symbol, size = 36, className = "", issuerLogo }: AssetIconProps) {
  const icon = ASSET_ICONS[symbol];
  if (icon) return <Image src={icon} alt="" aria-hidden width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} />;
  if (issuerLogo?.startsWith("https://xstocks-metadata.backed.fi/logos/tokens/"))
    return <Image src={issuerLogo} alt="" aria-hidden width={size} height={size} unoptimized className={`shrink-0 rounded-full object-cover ${className}`} />;
  return <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-muted font-semibold text-ink-secondary ${className}`} style={{ width: size, height: size, fontSize: Math.max(11, size / 3) }}>{symbol.slice(0, 2).toUpperCase()}</span>;
}
