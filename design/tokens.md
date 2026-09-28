# Design tokens

Per PRD §11.1 step 3: every token in `packages/ui/tokens.css`, with where it came from.

## Source

Bellstate has no Bellstate-specific screen mockups yet (`design/reference/` is empty — gate G15
applies to the visual layer of every screen, per §11.1 step 10). The base palette, type scale,
geometry and motion values below come from a design system the team owns for a separate product
("Closure Ledger," documented in full at `~/closeout/internal/brand/design.md` on the machine
this was built on — not part of this repo, referenced here for provenance only). Hex values are
copied verbatim from that document's own token table, not pixel-sampled from a raster image, so
they're exact rather than estimated.

**What this means in practice:** the base palette (`--canvas` through `--info`) is a direct,
faithful adoption. The Bellstate *semantic* layer (`--status-regular` through
`--status-unknown`) is new — Closure Ledger has no concept of a market session or a halt, so
those mappings are this project's own design judgment, reasoned out below. Anything under
"Bellstate semantic layer" should be treated as inherited-but-adapted, not verbatim, the way
everything above it is.

## Base palette (Closure Ledger §3, verbatim)

| Token | Value | Source |
|---|---|---|
| `--canvas` | `#F5F1E8` | design.md §3, "Shell" row |
| `--surface` | `#FFFEFB` | design.md §3, "Paper" row |
| `--surface-muted` | `#EEE8DE` | design.md §3 |
| `--surface-strong` | `#E4DDD1` | design.md §3 |
| `--border` | `#D8D0C4` | design.md §3 |
| `--border-strong` | `#BEB4A7` | design.md §3 |
| `--ink` | `#1C1B1A` | design.md §3, "Ink" row |
| `--ink-secondary` | `#55504A` | design.md §3 |
| `--ink-muted` | `#7C756D` | design.md §3 |
| `--brand` | `#382F42` | design.md §3, "Plum" row |
| `--brand-strong` | `#2B2433` | design.md §3 |
| `--close` | `#E76545` | design.md §3, "Close" row |
| `--close-soft` | `#FAE3DA` | design.md §3 |
| `--preserve` | `#7182DD` | design.md §3, "Preserve" row |
| `--preserve-soft` | `#E9ECFB` | design.md §3 |
| `--success` | `#2F7A5D` | design.md §3, "Success" row |
| `--warning` | `#B67A24` | design.md §3 |
| `--danger` | `#B64B48` | design.md §3 |
| `--info` | `#5D6FC6` | design.md §3 |

## Bellstate semantic layer (this project's own mapping)

Bellstate's facet states (PRD §3.2-§3.6) don't correspond to Closure Ledger's Close/Preserve
concepts, so each mapping below is reasoned independently, not inherited:

| Token | Maps to | Why |
|---|---|---|
| `--status-regular` | `--success` | A regular, open, trading-normally session is the "everything's fine" state — the same role `success` plays in the source system. |
| `--status-extended` | `--preserve` | Extended sessions are real and valid, just thinner-liquidity — "this is legitimately active, with a caveat," the same role `preserve` plays for justified-but-conditional access. |
| `--status-auction` | `--warning` | An auction is a transitional, time-sensitive state (price not yet set) — matches `warning`'s "time-sensitive/pending" role exactly (design.md §3 rule). |
| `--status-closed` | `--ink-muted` | Scheduled closure is informational, not urgent — a neutral metadata tone, not a status color at all. |
| `--status-halted` | `--danger` | An asset-specific halt blocks trading — matches `danger`'s "failed or harmful state" role. |
| `--status-venue-halted` | `--close` | A venue-wide halt is the most severe market state (§11.3's severity order ranks it above everything) — reserved the system's other strong accent color, distinct from asset-level `danger`, to be visually distinguishable at a glance. |
| `--status-price-limited` | `--warning` | Trading continues but is constrained — time-sensitive/conditional, same role as auction. |
| `--status-unknown` | `--border-strong` | Direct reuse of design.md §6's own rule: "unresolved/unknown uses dashed neutral line + explicit label" — the single most direct match in the whole system, since Bellstate's own philosophy (§3.3: "a wrong transition time is worse than none") is the same instinct that rule encodes. |

## Geometry, spacing, typography, motion

Copied verbatim from design.md §4 (type scale, families), §7 (radii, borders, shadows, spacing
scale) and §11 (motion timings/easing) — these are generic system mechanics (how big is a
control radius, how fast does a transition run), not brand-specific decisions, so no Bellstate
adaptation was needed.

## Not yet done

Icon style, component-level composition (buttons, tables, cards) and actual per-screen layout
are still gated by G15 — this file covers *tokens*, not screens. `packages/ui`'s
`labels.ts`/`copyDeck.ts`/`severity.ts` (the data/states/flows layer §11.1 step 10 permits
building without images) are already implemented and tested; `apps/web` itself is not yet
scaffolded.
