# @maritime/shared

Shared TypeScript types and region definitions used by both `apps/web` and
`apps/worker`.

## What lives here

- `regions.ts` — `RegionId` union, `REGIONS` bbox map (PRD §8), and the
  `isRegionId` runtime guard. Both the worker (subscription routing,
  synthetic vessel seeding) and the web app (default subscription, future
  region toggles) import from here.
- `wire.ts` — two distinct wire contracts that share this file:
  1. The worker ↔ browser **WebSocket** protocol: the
     `VesselPositionEvent` payload plus the discriminated `ClientMessage`
     / `ServerMessage` envelopes (`subscribe` / `snapshot` / `position`).
     This is the contract the M3 AISStream integration must continue to
     satisfy.
  2. The **HTTP history wire** for `GET /api/positions/history`:
     `HistoryRow` (one observation; `t` is unix epoch seconds) and the
     `HistoryResponseBody` envelope. Added in M4 #27 to back the
     timeline scrubber and the deck.gl `TripsLayer`. Separate from the
     WS protocol on purpose — drag-driven re-fetches go through Next.js
     Route Handlers, not the WS, per the architectural note in the M4
     #27 PR.

## How this package is consumed

`package.json` points `main` and `types` at raw `./src/index.ts` rather than a
`dist/` build artifact. Two reasons:

- `apps/web` is bundled by Next.js, which compiles TypeScript directly.
- `apps/worker` runs via `tsx` (TypeScript-aware Node loader) during local
  development, so `node` never has to interpret raw `.ts`.

### Internal import extensions

`packages/shared/src/index.ts` re-exports through `.ts` extensions
(`export * from "./regions.ts"`, etc.). This relies on
`tsconfig.base.json`'s `allowImportingTsExtensions: true`, which both
Turbopack (Bundler resolution, used by `apps/web`) and the worker's
NodeNext typecheck accept uniformly. Up through M3 these used `.js`
extensions, but the M3 #25 / M4 #27 cycles converted on-demand:

- M3 #25 introduced the trick for `@maritime/db` because Turbopack
  could not resolve `./schema.js` in a runtime re-export when the `.js`
  file did not physically exist.
- M4 #27 extended it to `@maritime/shared` once the new
  `/api/positions/history` Route Handler became the first runtime
  (non-type-only) import of `@maritime/shared` from the web app and hit
  the same Turbopack gap.

**Type-only imports** (e.g. `wire.ts`'s `import type { RegionId } from
"./regions.js"`) keep the `.js` suffix as a deliberate exception — TS
erases type-only imports before bundling, so Turbopack never resolves
them at runtime. Don't reflexively flip those; they document the
type-only intent at the call site.

If/when the worker grows a "production build" target — the hosting decision is
deferred to post-M4 — this package gains a `tsc -b` build step and an
`exports` field with `import` and `types` conditions pointing at `./dist/`.
That is intentionally not done today; carrying a build artifact through M2/M3
would slow iteration without buying anything.
