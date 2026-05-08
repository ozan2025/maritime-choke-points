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
  web/              Next.js 16.2 app — Tailwind 4, shadcn/ui, dark theme
  worker/           Node 22 worker — WebSocket fan-out of vessel positions
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

### Web app

The Next.js shell lives in `apps/web/`. It boots into a dark theme via
`next-themes` and serves a placeholder landing page until live data arrives
in M2/M3.

```bash
# one-time: copy the env template and paste in your Mapbox public token
cp apps/web/.env.example apps/web/.env.local
# then edit apps/web/.env.local and set NEXT_PUBLIC_MAPBOX_TOKEN

# start the dev server
pnpm --filter @maritime/web dev
```

A free Mapbox public token (the `pk.…` form) comes from
[account.mapbox.com](https://account.mapbox.com). Domain-lock the token
before deploying anywhere public.

The web app also reads `DATABASE_URL` (server-side only — Server Components
query the `vessels` table for the M3 #9 vessel-detail Sheet). Bring up the
local Postgres before `pnpm --filter @maritime/web dev` or the static slot
of the Sheet will fail at request time.

Application code arrives across milestones M1–M4. See [`PRD.md`](./PRD.md) §10
for the milestone breakdown and the [GitHub issues](https://github.com/ozan2025/maritime-choke-points/issues)
for the next concrete unit of work.

### Worker

The worker holds the upstream AIS connection (synthetic stream in M2,
AISStream.io in M3) and fans out vessel positions to subscribed browsers
over a WebSocket. The wire format lives in `packages/shared/src/wire.ts`.

```bash
# one-time: copy the env template
cp apps/worker/.env.example apps/worker/.env.local

# start the worker (auto-reload on change)
pnpm --filter @maritime/worker dev
```

The worker listens on `WORKER_WS_PORT` (default `8787`). Browsers connect
to `ws://localhost:8787` — match the URL via `NEXT_PUBLIC_WORKER_WS_URL`
in `apps/web/.env.local`. Subscribe with a single
`{"type":"subscribe","regions":["malaccaSingapore"]}` frame; the server
replies with one `snapshot`, then streams `position` events filtered to
the requested regions.

## Development

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch, commit, and PR conventions.

## License

MIT — see [LICENSE](./LICENSE).
