import Image from "next/image";

type AssetIconProps = { symbol: string; size?: number; className?: string };

const ASSET_ICONS: Record<string, string> = {
  NVDAx: "/assets/tokens/nvdax.png",
  SKHYx: "/assets/tokens/skhyx.png",
  TCENTx: "/assets/tokens/tcentx.png",
  CTNTx: "/assets/tokens/ctnt-company.webp",
};

/** Issuer artwork where available; CTNTx uses underlying company artwork. See manifest.json. */
export function AssetIcon({ symbol, size = 36, className = "" }: AssetIconProps) {
  const icon = ASSET_ICONS[symbol];
  if (!icon) return null;
  return <Image src={icon} alt="" aria-hidden width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} />;
}
