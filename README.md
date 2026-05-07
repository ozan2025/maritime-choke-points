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

## Repository structure (target)

```
apps/web/        Next.js 16 app
apps/worker/     Node AIS worker
packages/shared/ Shared TypeScript types and region definitions
scripts/         Validation spike scripts (used during PRD discovery)
PRD.md           Source-of-truth design document
```

## Quickstart

Not yet runnable. Setup will be wired up across the M1 milestone issues.

## License

MIT — see [LICENSE](./LICENSE).
