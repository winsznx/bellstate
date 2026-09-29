Bellstate web app (PRD §11), Next.js App Router.

## What's here

- `app/globals.css` / `tailwind.config.ts` — wired to `packages/ui/tokens.css`, not hardcoded
  hex, so the design system stays one source of truth (`design/tokens.md` records where every
  value came from).
- `app/layout.tsx` — loads Instrument Sans / IBM Plex Mono via `next/font`, per the design
  system and PRD §11.1 step 4.
- `app/(site)/page.tsx` — S01 Board (PRD §11.5), built against `app/(site)/fixtures.ts` for the
  asset table (no deployed hub — see `internal/NEEDS.md`) but reading the venue strip live from
  Supabase (`scripts/seed/venues.sql`, real seeded data). The filter bar and live feed are
  visibly inert placeholders since they need client state / Supabase Realtime not wired up yet.
  The other 17 screens live alongside it under `app/(site)/`, all in the same fixture-or-live
  pattern depending on what real data actually exists.
- `app/_components/{StatusChip,VenueTile,FacetCard,GlobalSidebar,GlobalFooter}.tsx` — shared
  presentational pieces. `GlobalSidebar`/`GlobalFooter` (§11.2 G1/G2) apply to every screen
  under `app/(site)/`; `/embed/[symbol]` (§17) stays outside that route group deliberately, since
  it must render as a bare iframe widget with no nav. `StatusChip`/`VenueTile` use `packages/ui`'s
  labels/severity so status text and coloring stay consistent with the rest of the stack (API
  responses, Telegram alerts, the embed) once those exist.

## Gate G15

`design/reference/` (Bellstate-specific screen mockups, named `S01-default-desktop.png` etc.
per §11.1) is empty — gate G15 applies to the visual layer of every screen. What's built here is
the part §11.1 step 10 explicitly permits without images: "data, states and flows," for all 18
screens in the PRD's route table. The token set in `design/tokens.md` comes from a design system
the team owns for a different product, adopted as the base palette/type/geometry/shell structure
(including the 224px left-rail nav, `app/_components/GlobalSidebar.tsx`) with Bellstate's own
semantic color mapping layered on top (documented in `design/tokens.md`) — a real, considered
visual foundation applied as faithfully as a non-designer-eye reading of that system allows, not
a placeholder, but not a substitute for actual Bellstate screen mockups either. Pixel-accurate
layout and the Playwright visual-regression suite (§11.1 step 8) aren't built — there's nothing
to regress-test against without reference images.

A real lesson from this: build+typecheck+200-status verification does not catch a design-system
deviation or a UI logic bug (an earlier version shipped a generic top nav instead of the given
system's specified left rail, and a health indicator that silently showed "healthy" for venues
with zero data). Both were only caught by actually looking at a screenshot of the deployed site.
If you're checking this app's UI work, look at it, don't just check the build passed.

## Deploying

Deployed to Cloudflare Workers via `@opennextjs/cloudflare`, not Vercel (Cloudflare login works,
Vercel's doesn't — see `internal/NEEDS.md`). Live at https://bellstate.timjosh507.workers.dev.

```bash
pnpm --filter @winsznx/bellstate-web cf:deploy   # = opennextjs-cloudflare build && ... deploy
```

**Do not** run `next build` followed by `wrangler deploy` expecting your changes to ship —
`wrangler deploy` on an OpenNext project reads from `.open-next/`, which only
`opennextjs-cloudflare build` regenerates. A plain `next build` only refreshes `.next/`, so
`wrangler deploy` will silently redeploy the previous, stale `.open-next/` bundle (its own
output even says "No updated asset files to upload" when this happens — that message is the
tell). Always use `cf:build`/`cf:deploy`, or run `opennextjs-cloudflare build` yourself before
`wrangler deploy`.

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
