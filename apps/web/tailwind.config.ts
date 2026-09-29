import type { Config } from "tailwindcss";

// Wired to packages/ui/tokens.css's CSS variables, not hardcoded hex, so the theme stays a
// single source of truth (design/tokens.md documents where every value in that file came from —
// copied from a real shipped codebase's actual tailwind.config.ts, not from design prose).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-strong": "var(--surface-strong)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-muted": "var(--ink-muted)",
        brand: "var(--brand)",
        "brand-strong": "var(--brand-strong)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        close: "var(--close)",
        "close-soft": "var(--close-soft)",
        preserve: "var(--preserve)",
        "preserve-soft": "var(--preserve-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        info: "var(--info)",
        "info-soft": "var(--info-soft)",
        "status-regular": "var(--status-regular)",
        "status-extended": "var(--status-extended)",
        "status-auction": "var(--status-auction)",
        "status-closed": "var(--status-closed)",
        "status-halted": "var(--status-halted)",
        "status-venue-halted": "var(--status-venue-halted)",
        "status-price-limited": "var(--status-price-limited)",
        "status-unknown": "var(--status-unknown)",
        "shell-bg": "var(--shell-bg)",
      },
      fontFamily: {
        sans: ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["4.25rem", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-l": ["3.25rem", { lineHeight: "1.06", letterSpacing: "-0.032em" }],
        h1: ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.028em" }],
        h2: ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.022em" }],
        h3: ["1.3125rem", { lineHeight: "1.25", letterSpacing: "-0.014em" }],
        "body-l": ["1.0625rem", { lineHeight: "1.6" }],
        body: ["0.9375rem", { lineHeight: "1.55" }],
        "body-s": ["0.8125rem", { lineHeight: "1.5" }],
        label: ["0.75rem", { lineHeight: "1.25", letterSpacing: "0.005em" }],
        micro: ["0.6875rem", { lineHeight: "1.25", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        control: "var(--radius-control)",
        panel: "var(--radius-panel)",
        large: "var(--radius-large)",
        card: "var(--radius-card)",
        sheet: "var(--radius-sheet)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        floating: "var(--shadow-floating)",
        soft: "var(--shadow-soft)",
        focus: "var(--shadow-focus)",
      },
      width: {
        rail: "var(--rail-width)",
      },
      transitionTimingFunction: {
        brand: "var(--motion-ease)",
      },
      transitionDuration: {
        fast: "140ms",
        standard: "220ms",
        narrative: "360ms",
      },
      backgroundImage: {
        "hero-panel": "var(--gradient-hero-panel)",
        "panel-soft": "var(--gradient-panel-soft)",
        "accent-deep": "var(--gradient-accent-deep)",
      },
    },
  },
  plugins: [],
};

export default config;
