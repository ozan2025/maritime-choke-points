# @maritime/shared

Shared TypeScript types and region definitions used by both `apps/web` and
`apps/worker`.

## How this package is consumed

`package.json` points `main` and `types` at raw `./src/index.ts` rather than a
`dist/` build artifact. Two reasons:

- `apps/web` is bundled by Next.js, which compiles TypeScript directly.
- `apps/worker` (issue #4) will run via `tsx` (TypeScript-aware Node loader)
  during local development, so `node` never has to interpret raw `.ts`.

If/when the worker grows a "production build" target — the hosting decision is
deferred to post-M4 — this package gains a `tsc -b` build step and an
`exports` field with `import` and `types` conditions pointing at `./dist/`.
That is intentionally not done today; carrying a build artifact through M2/M3
would slow iteration without buying anything.
