Bellstate web app (PRD §11), Next.js App Router.

## What's here

- `app/globals.css` / `tailwind.config.ts` — wired to `packages/ui/tokens.css`, not hardcoded
  hex, so the design system stays one source of truth (`design/tokens.md` records where every
  value came from).
- `app/layout.tsx` — loads Instrument Sans / IBM Plex Mono via `next/font`, per the design
  system and PRD §11.1 step 4.
- `app/page.tsx` — S01 Board (PRD §11.5), built against `app/fixtures.ts` (a stand-in server
  snapshot — no deployed hub or Supabase project exists yet, see `internal/NEEDS.md`). Structure
  follows the spec's region order (venue strip → summary → filter bar → asset table → live
  feed); the filter bar and live feed are visibly inert placeholders since they need client
  state / Supabase Realtime this repo can't wire up yet.
- `app/_components/{StatusChip,VenueTile}.tsx` — small presentational pieces using
  `packages/ui`'s labels/severity so status text and coloring stay consistent with the rest of
  the stack (API responses, Telegram alerts, the embed) once those exist.

## Gate G15

`design/reference/` (Bellstate-specific screen mockups, named `S01-default-desktop.png` etc.
per §11.1) is empty — gate G15 applies to the visual layer of every screen. What's built here is
the part §11.1 step 10 explicitly permits without images: "data, states and flows." The token
set in `design/tokens.md` comes from a design system the team owns for a different product,
adopted as the base palette/type/geometry with Bellstate's own semantic color mapping layered on
top (documented in that file) — it is a real, considered visual foundation, not a placeholder,
but it is not a substitute for actual Bellstate screen mockups. Pixel-accurate layout, the
Playwright visual-regression suite (§11.1 step 8), and the remaining 17 screens are not built.

## A real toolchain issue this surfaced

Next.js 15's build-time typecheck and lint steps don't support TypeScript 7 (the version every
other package in this workspace uses) — its own compiler-API assumptions break. Rather than
downgrade the whole workspace, `next.config.mjs` disables Next's redundant internal typecheck/
lint passes (`ignoreBuildErrors`/`ignoreDuringBuilds`) and this app pins TypeScript 5.7 locally
as a devDependency so Next's tooling itself is happy; real type safety for this app's own code
still comes from `npx tsc --noEmit` against the workspace's TS 7, run the same way as every
other package here, not from Next's checker.

## Verified

`next build` succeeds, `tsc --noEmit` (workspace TS 7) is clean, and the built app was started
and its HTML fetched directly — confirmed real fixture content renders (symbols, status labels)
and the design tokens compiled into real Tailwind utility classes
(`.bg-status-halted{background-color:var(--status-halted)}`), not just literal strings sitting
unused in source.
