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
  db/               Drizzle schema + migrations for local Postgres
scripts/            Validation spike scripts (used during PRD discovery)
.github/            CI workflow + Dependabot
docker-compose.yml  Local Postgres 16 service for development
PRD.md              Source-of-truth design document
CONTRIBUTING.md     Branching, PR, and commit conventions
```

## Quickstart

Requires **Node 22+**, **pnpm 9** (pinned via the root `packageManager` field —
Corepack will fetch the correct version), and **Docker Desktop** (for the local
Postgres container).

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

### Database

The local Postgres 16 instance runs in a Docker container defined by
`docker-compose.yml`. Drizzle owns the schema (`packages/db/src/schema.ts`)
and the generated migrations (`packages/db/migrations/`).

```bash
# one-time: copy local env file (gitignored)
cp .env.example .env

# bring up Postgres and apply migrations
pnpm db:up
pnpm db:migrate
```

Other helpers:

| Script             | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `pnpm db:up`       | Start the `db` container; blocks until the healthcheck passes.      |
| `pnpm db:down`     | Stop the container (keeps the data volume).                         |
| `pnpm db:reset`    | **Destructive.** Drop the data volume, restart, re-migrate.         |
| `pnpm db:migrate`  | Apply any unapplied Drizzle migrations.                             |
| `pnpm db:generate` | Generate a new migration after editing `packages/db/src/schema.ts`. |

Application code arrives across milestones M1–M4. See [`PRD.md`](./PRD.md) §10
for the milestone breakdown and the [GitHub issues](https://github.com/ozan2025/maritime-choke-points/issues)
for the next concrete unit of work.

## Development

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch, commit, and PR conventions.

## License

MIT — see [LICENSE](./LICENSE).
