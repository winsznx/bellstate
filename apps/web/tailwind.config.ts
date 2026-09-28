import type { Config } from "tailwindcss";

// Wired to packages/ui/tokens.css's CSS variables, not hardcoded hex, so the theme stays a
// single source of truth (design/tokens.md documents where every value in that file came from).
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
        close: "var(--close)",
        "close-soft": "var(--close-soft)",
        preserve: "var(--preserve)",
        "preserve-soft": "var(--preserve-soft)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        "status-regular": "var(--status-regular)",
        "status-extended": "var(--status-extended)",
        "status-auction": "var(--status-auction)",
        "status-closed": "var(--status-closed)",
        "status-halted": "var(--status-halted)",
        "status-venue-halted": "var(--status-venue-halted)",
        "status-price-limited": "var(--status-price-limited)",
        "status-unknown": "var(--status-unknown)",
      },
      fontFamily: {
        sans: ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        panel: "var(--radius-panel)",
        "panel-lg": "var(--radius-panel-lg)",
      },
      boxShadow: {
        floating: "var(--shadow-floating)",
        elevated: "var(--shadow-elevated)",
      },
      transitionTimingFunction: {
        brand: "var(--motion-ease)",
      },
      transitionDuration: {
        fast: "140ms",
        standard: "220ms",
        narrative: "360ms",
      },
    },
  },
  plugins: [],
};

export default config;
