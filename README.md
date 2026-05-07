# Maritime Choke Points

> Real-time maritime traffic dashboard centered on the Strait of Malacca / Singapore Strait,
> with a coverage-gap monitor for Hormuz, Suez, and Bab el-Mandeb.

**Status:** pre-implementation. Repository scaffolding in progress.
See [`PRD.md`](./PRD.md) for the full design, validation findings, and milestones.

## What this is

A dark-mode operations dashboard rendering live AIS positions of vessels transiting
the world's most heavily trafficked maritime choke point — the Malacca/Singapore
corridor, which carries roughly 25% of global trade.

A secondary "Critical Choke Points" panel contrasts that live torrent against
three currently-dark waterways — Hormuz, Suez, and Bab el-Mandeb — each empty for
a different geopolitical or technical reason. The contrast is the project's
distinctive angle.

## Stack

Next.js 16.2 · TypeScript · Tailwind 4 · shadcn/ui · Mapbox GL JS · deck.gl ·
Zustand · Postgres 16 · Node 22 worker · AISStream.io firehose

## Repository layout

```
apps/
  web/              Next.js 16 app (issue #3+)
  worker/           Node 22 AIS worker (issue #4+)
packages/
  shared/           Shared TypeScript types and region definitions
scripts/            Validation spike scripts (used during PRD discovery)
.github/            CI workflow + Dependabot
PRD.md              Source-of-truth design document
CONTRIBUTING.md     Branching, PR, and commit conventions
```

## Quickstart

Requires **Node 22+**. Package manager is **pnpm 9** (pinned via the root
`packageManager` field — Corepack will fetch the correct version).

```bash
# one-time: enable Corepack (ships with Node 22)
corepack enable

# install dependencies
pnpm install

# verify the toolchain
pnpm format:check
pnpm lint
pnpm typecheck
```

Application code arrives across milestones M1–M4. See [`PRD.md`](./PRD.md) §10
for the milestone breakdown and the [GitHub issues](https://github.com/ozan2025/maritime-choke-points/issues)
for the next concrete unit of work.

## Development

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch, commit, and PR conventions.

## License

MIT — see [LICENSE](./LICENSE).
