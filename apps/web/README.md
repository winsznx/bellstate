# Bellstate web

Next.js App Router app deployed to Cloudflare Workers with OpenNext. The live site is [bellstate.timjosh507.workers.dev](https://bellstate.timjosh507.workers.dev).

## Public data paths

- `/board` reads the xStocks public issuer catalog for X Layer assets, merges any indexed Bellstate records, and reads the deployed NVDAx adapter through the API service binding. Search and filters run in the client. Venue tiles use the local calendar and say so.
- `/asset/NVDAx` shows issuer metadata and the direct onchain adapter reading. Other issuer assets have catalog information even if Bellstate has not indexed them.
- `/watch` reads public Hyperliquid xyz perp quotes. Bellstate mappings and recorded flags come from separate database tables.
- `/developers/print-check` runs a free offchain preview for 2026 Nextrade SK hynix prints. It uses calendar and price rules, with explicit missing halt and signed history evidence.
- `/replay/jul-28-2026-sk-hynix` is a source-linked historical case study. It is distinct from a published Bellstate replay with attested frames.
- `/network` calls deployed service bindings for HTTP reachability and shows the checked-in X Layer deployment.

These are different evidence levels. Issuer catalog records, computed calendars, public perp quotes, local policy previews, and signed onchain status must retain their labels when extended.

## Build and deploy

```bash
pnpm --filter @winsznx/bellstate-web exec tsc --noEmit
pnpm --filter @winsznx/bellstate-web cf:build
pnpm --filter @winsznx/bellstate-web exec opennextjs-cloudflare deploy
```

`wrangler deploy` by itself reads the existing `.open-next/` bundle, so regenerate it with `cf:build` after code changes. Next.js's internal type and lint steps are disabled in `next.config.mjs` because of the workspace TypeScript toolchain; run the explicit TypeScript command above.

The public asset and Watch data depend on upstream APIs. Their loading and failure states are part of the product, and a successful page response does not imply a fresh onchain attestation.
