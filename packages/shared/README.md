# @maritime/shared

Shared TypeScript types and region definitions used by both `apps/web` and
`apps/worker`.

## What lives here

- `regions.ts` — `RegionId` union, `REGIONS` bbox map (PRD §8), and the
  `isRegionId` runtime guard. Both the worker (subscription routing,
  synthetic vessel seeding) and the web app (default subscription, future
  region toggles) import from here.
- `wire.ts` — the worker ↔ browser WebSocket protocol: the
  `VesselPositionEvent` payload plus the discriminated `ClientMessage` /
  `ServerMessage` envelopes (`subscribe` / `snapshot` / `position`). This
  is the contract the M3 AISStream integration must continue to satisfy.

## How this package is consumed

`package.json` points `main` and `types` at raw `./src/index.ts` rather than a
`dist/` build artifact. Two reasons:

- `apps/web` is bundled by Next.js, which compiles TypeScript directly.
- `apps/worker` runs via `tsx` (TypeScript-aware Node loader) during local
  development, so `node` never has to interpret raw `.ts`.

The `.js` extensions on the relative imports inside this package are
intentional: `apps/worker/tsconfig.json` uses `module: "NodeNext"`, where
ESM imports must specify the runtime extension. Bundler-style consumers
(`apps/web`) tolerate the `.js` suffix during compilation.

If/when the worker grows a "production build" target — the hosting decision is
deferred to post-M4 — this package gains a `tsc -b` build step and an
`exports` field with `import` and `types` conditions pointing at `./dist/`.
That is intentionally not done today; carrying a build artifact through M2/M3
would slow iteration without buying anything.
