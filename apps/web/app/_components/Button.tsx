import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

/** Matches the real Button component this project's owner pointed at, structurally — same
 * variant names, same class shape. */
type Variant = "primary" | "secondary" | "ghost" | "close";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-surface text-ink border border-border hover:border-border-strong",
  ghost: "bg-transparent text-ink-secondary hover:text-ink",
  close: "bg-close text-white hover:opacity-90",
};

interface CommonProps {
  variant?: Variant;
  size?: "sm" | "md";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control font-medium transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "sm" ? "px-3 py-1.5 text-body-s" : "px-4 py-2 text-body"
      } ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: CommonProps & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control font-medium transition-colors duration-fast ${
        size === "sm" ? "px-3 py-1.5 text-body-s" : "px-4 py-2 text-body"
      } ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
