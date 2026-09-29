# Design tokens

Per PRD §11.1 step 3: every token in `packages/ui/tokens.css`, with where it came from.

## Source — corrected

An earlier version of this file sourced Bellstate's palette from a separate design-system
markdown document (a different product the team owns). That document turned out to describe an
**earlier, superseded** brand — the product's own `tailwind.config.ts` says so in its own
comments: "The prior config derived every value from internal/brand/brand.json (the 'Closure
Ledger' warm coral/periwinkle system). That brand was deliberately overridden by direct decision
in favour of the neutral white / soft-grey-card / black-pill / blue-accent system." Building
Bellstate's tokens from the markdown doc instead of the actual shipped code was the mistake —
the values below are copied verbatim from that product's real `apps/web/app/globals.css` and
`apps/web/tailwind.config.ts` as they exist today, not from prose about them.

Bellstate has no Bellstate-specific screen mockups yet (`design/reference/` is empty — gate G15
applies to the visual layer of every screen, §11.1 step 10). The base palette, type scale,
geometry and motion values below are a direct, faithful adoption of that real code. The
Bellstate *semantic* layer (`--status-regular` through `--status-unknown`) is new — the source
product has no concept of a market session or a halt — reasoned out below.

## Base palette (verbatim from `globals.css` / `tailwind.config.ts`)

| Token | Value |
|---|---|
| `--canvas` | `#FFFFFF` |
| `--surface` | `#FFFFFF` |
| `--surface-muted` | `#F4F5F7` |
| `--surface-strong` | `#EBEDF1` |
| `--border` | `#E7E9EE` |
| `--border-strong` | `#D4D8E0` |
| `--ink` | `#0B0B0C` |
| `--ink-secondary` | `#5B6270` |
| `--ink-muted` | `#8A909C` |
| `--brand` | `#101114` |
| `--brand-strong` | `#000000` |
| `--accent` / `--preserve` / `--info` | `#3B71F0` |
| `--accent-strong` | `#2554CC` |
| `--accent-soft` / `--preserve-soft` / `--info-soft` | `#EAF0FE` |
| `--close` / `--danger` | `#D93B3B` |
| `--close-soft` / `--danger-soft` | `#FDECEC` |
| `--success` | `#17A673` |
| `--success-soft` | `#E6F7F0` |
| `--warning` | `#C98A14` |
| `--warning-soft` | `#FCF3E1` |

Note the source system itself collapses `close`/`danger` and `preserve`/`accent`/`info` into
identical values — it isn't a richer palette than it looks, several "semantic" names are aliases
of the same hex.

## Bellstate semantic layer (this project's own mapping)

| Token | Maps to | Why |
|---|---|---|
| `--status-regular` | `--success` | The "everything's fine" state. |
| `--status-extended` | `--accent` | Legitimately active with a caveat (thinner liquidity) — same role `accent`/`info` plays for "notable but not alarming." |
| `--status-auction` | `--warning` | Transitional, time-sensitive, price not yet set. |
| `--status-closed` | `--ink-muted` | Scheduled closure is informational, not a status color at all. |
| `--status-halted` | `--danger` | An asset-specific halt blocks trading. |
| `--status-venue-halted` | `--brand-strong` (pure black) | The most severe market state (§11.3's severity order ranks it above everything). The source palette uses the *same* hex for `close` and `danger`, so reusing it here would make venue-wide and asset-level halts visually indistinguishable — `brand-strong` is reserved instead so the severity ordering stays visible. This is the one place Bellstate's mapping had to diverge from a straight value-for-value copy, and it's because the source system itself has fewer distinct "bad" colors than Bellstate needs, not a stylistic choice. |
| `--status-price-limited` | `--warning` | Constrained but still trading — same time-sensitive role as auction. |
| `--status-unknown` | `--border-strong` | Neutral, structural — an unresolved state shown as a muted outline rather than a color claiming to mean something. |

## Geometry, typography, motion, gradients

Copied verbatim from the real `tailwind.config.ts`: border radii (`control` 10px, `panel` 16px,
`large` 20px, `card` 24px, `sheet` 28px, `pill` 999px), shadows (`card`, `floating`, `soft`,
`focus`), the 248px rail width, motion timings, and the three gradient definitions
(`hero-panel`, `panel-soft`, `accent-deep`) used on marketing/hero surfaces only. Font families
(Instrument Sans / IBM Plex Mono via `next/font/google`) match exactly, including weights.

## Icons

The source app's sidebar icons are its own specific SVG assets (`/brand/icons/*.svg`) — literal
files belonging to that product, not reused here. They're drawn in a standard style (24px
viewBox, 1.5 stroke width, round caps/joins) that reads as the Lucide icon set's visual
language; Bellstate uses `lucide-react` directly for the same look without copying another
product's specific asset files.

## Not yet done

Per-screen pixel-accurate layout and the Playwright visual-regression suite (§11.1 step 8) —
this file covers tokens, not screens.
