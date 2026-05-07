# Maritime Choke Points — PRD

**Owner:** Ozan Selcuk
**Created:** 2026-05-06
**Status:** Draft (pre-implementation)
**Build order:** 1 of 5

---

## 1. Vision

A dark-mode operations dashboard for the **Strait of Malacca / Singapore
Strait** corridor — a 1.7-mile-wide stretch of water through which roughly
25% of global trade and 80,000+ vessels per year transit. The dashboard
renders live AIS positions of every visible vessel in real-time as deck.gl
icons and trails over a dark satellite basemap, with cargo type, vessel
size, and origin/destination context.

A secondary "Critical Choke Points" panel contrasts Malacca's torrent
against three dead zones — Suez, Bab el-Mandeb, and Hormuz — each empty
for a different reason: sparse terrestrial coverage, Houthi-driven
AIS-dark behavior, and the post-Feb-2026 strait closure respectively. In
a single glance the viewer sees what dense maritime data looks like, what
absence looks like, and the geopolitical reasons for each silence.

The project's center of gravity is **visual density and real-time motion**
on Malacca/Singapore. The four-choke-point coverage panel is a sharp
secondary feature that earns the project's name without being the
load-bearing visual.

---

## 2. Background: what we tested and learned (2026-05-06)

Before committing to the architecture, we validated AISStream.io's free
WebSocket firehose against the project's intended bounding boxes. The
findings forced a reframe.

**Method.** Throwaway Node 22 scripts (in `scripts/`) connected to
`wss://stream.aisstream.io/v0/stream` with our API key, subscribed to
bounding boxes, decoded `ArrayBuffer` frames to text, and counted
PositionReport messages over 30s–300s windows.

**Validation results — global 30s subscription, region-bucketed:**

| Region                         | PositionReports in 30s |
|--------------------------------|------------------------|
| Mediterranean                  | 271                    |
| North Atlantic                 | 134                    |
| South China Sea                | 77                     |
| **Strait of Malacca**          | **58**                 |
| Persian Gulf (wide bbox)       | 3                      |
| Strait of Hormuz (bbox)        | 0                      |
| Bab el-Mandeb (bbox)           | 0                      |
| Suez (bbox)                    | 0                      |
| Red Sea (wide bbox)            | 0                      |

Total: **6,915 messages in 30s globally** (connection healthy).

**Why the original spec's choke points are dark on the free firehose:**

1. **Terrestrial AIS reach.** AISStream aggregates from shore stations and
   community Raspberry Pi receivers. They don't reach mid-strait open water,
   especially in narrow waterways bordered by states without public AIS feeders.
2. **Intentional AIS-dark behavior.** Vessels in sanctioned routes,
   Houthi-threatened waters, or politically sensitive transits routinely
   disable or spoof AIS.
3. **The strait is genuinely closed.** Per public reporting, the Strait of
   Hormuz has been effectively closed to most commercial shipping since
   late February 2026 due to a regional security situation — so even with
   perfect AIS coverage, there would be very little to track.

**Implication.** The original spec's vision ("live ship traffic through the
four critical choke points") cannot be done with free data right now. The
existing public Hormuz trackers (HormuzTracker.com, hormuzstraitmonitor.com,
SeaVantage, Windward) work around this with multi-source aggregation,
daily-updated press summaries, and paid satellite AIS — none of which is in
scope for a portfolio piece.

**Decision.** Recenter the project on **Malacca/Singapore** — a real
choke point, validated to deliver a heavy AIS torrent — with Hormuz preserved
as a small **AIS coverage-gap inset** that adds intellectual texture without
being the load-bearing visual. Architecture, schema, validation, and tech
stack are unchanged; only the protagonist shifts.

**Implementation gotchas discovered during validation:**

1. Node 22's built-in `WebSocket` delivers AISStream messages as `Blob` /
   `ArrayBuffer`, not strings. The worker must set
   `ws.binaryType = "arraybuffer"` and decode via `TextDecoder` before
   `JSON.parse`. Alternative: use the `ws` npm package.
2. AISStream bounding box format is `[[lat_min, lon_min], [lat_max, lon_max]]`
   (latitude first). Multiple bboxes are sibling array entries:
   `BoundingBoxes: [[[sw1], [ne1]], [[sw2], [ne2]]]`.
3. Receive vessel names, types, and dimensions by **not** filtering message
   types on the wire. `ShipStaticData` (broadcast every ~6 minutes per
   vessel) is the source of human-readable identifiers. Filter on the
   consumer side.

---

## 3. Goals

1. **Render the Malacca/Singapore vessel torrent live** with sub-minute
   end-to-end latency from AIS-on-wire to pixel-on-screen.
2. **Visual density that lands in five seconds.** A viewer glances at the
   screen and immediately sees what 25% of global trade looks like in motion.
3. **Vessel detail on click.** Name, flag, IMO, type, dimensions, speed,
   heading, destination.
4. **Historical depth.** Persist every observed position so we accumulate a
   real dataset over weeks of operation, powering a timeline scrubber.
5. **AIS coverage-gap inset.** A small panel showing Malacca's live count
   beside Hormuz's live count. The contrast educates without dominating.
6. **Polished operations-room aesthetic.** Dark satellite basemap,
   glassmorphism HUD, monospace telemetry, subtle motion. Distinctive at
   first sight.
7. **Portfolio-grade artifact.** Public GitHub (MIT), clean README, runs
   locally with `docker compose up`.

---

## 4. Non-goals

- Not a competitor to MarineTraffic / VesselFinder / Kpler.
- Not satellite-AIS powered.
- Not a live Hormuz tracker — Hormuz is intentionally a small inset, not the
  protagonist.
- Not a finished product with paying users; portfolio piece, best-effort SLO.

---

## 5. Architecture

Two services, local-first development via Docker, hosting decision deferred
to post-M4.

```
┌─────────────────────────┐                  ┌──────────────────────────┐
│  AISStream.io           │  WebSocket       │  ais-worker              │
│  (terrestrial firehose) │ ───────────────► │  (Node 22, TypeScript)   │
└─────────────────────────┘                  │                          │
                                             │  - Holds AIS connection  │
                                             │  - Decodes Blob → JSON   │
                                             │  - Buckets by region     │
                                             │  - Writes to Postgres    │
                                             │  - Fans out to browsers  │
                                             └──────────────────────────┘
                                                  │             │
                                       writes     │             │ WebSocket
                                                  ▼             ▼
                                           ┌────────────┐  ┌────────────────────┐
                                           │ Postgres 16│  │ Browser            │
                                           │  - recent  │  │ (Next.js 16.2 app) │
                                           │  - hourly  │  │  - Mapbox GL JS    │
                                           │            │  │  - deck.gl         │
                                           │            │  │  - Zustand         │
                                           │            │◄─┤  - Server          │
                                           │            │  │     Components     │
                                           │            │  │     read history   │
                                           └────────────┘  └────────────────────┘
```

### Why two services
Next.js (Vercel-style serverless or any modern host) is request/response.
Holding a persistent upstream WebSocket inside a Next.js Route Handler fights
the framework. The worker is a tiny long-running Node process; cleanly
separated. The browser opens its WebSocket directly to the worker — no
proxying through Next.js.

### Frontend stack
- **Next.js 16.2** (App Router, React Server Components, React Compiler on)
- **TypeScript** strict
- **Tailwind 4** + **shadcn/ui** (Sheet, Slider, Tooltip, Command, Sonner, …)
- **Mapbox GL JS** + **deck.gl** (`IconLayer`, `TripsLayer`, `HeatmapLayer`,
  `ScatterplotLayer`)
- **Zustand** for client state
- **Framer Motion** for HUD/panel transitions
- **Lucide** icons + custom maritime SVG ship-type silhouettes
- **Geist** + **Geist Mono** with `tabular-nums` for telemetry

### Worker stack
- **Node 22** (built-in `WebSocket` global)
- **TypeScript** strict
- **`pg`** for Postgres
- **`ws`** as the inbound WebSocket *server* (browsers connect here)
- Provider-abstraction layer so AISStream can be swapped for synthetic /
  replay data if upstream is unavailable

### Data layer
- **Postgres 16** (Docker locally, managed in cloud later)
- TimescaleDB not required at expected volumes (vanilla Postgres + indexes
  is sufficient — see §7)

### Deployment (deferred decision)
Local Docker for development. Post-M4 candidates: GCP Cloud Run + Cloud SQL,
Azure Container Apps + Azure Postgres Flexible Server (Leaf MCPP),
Vercel + Neon. Decision when M4 is feature-complete.

---

## 6. Data sources

| Source | Used for | Cost | Status |
|---|---|---|---|
| AISStream.io | Live vessel positions + static data | Free (GitHub OAuth) | Validated 2026-05-06; Malacca confirmed |
| Mapbox GL JS | Dark satellite basemap, custom dark style | Free (50k loads/mo) | Token validated 2026-05-06 |
| ACLED | Geopolitical incident overlay (stretch) | Free (academic email) | Not yet integrated |
| OpenStreetMap Nominatim | Port name resolution | Free | Not yet integrated |

---

## 7. Data model

Two primary tables. Vanilla Postgres 16. No TimescaleDB.

### `vessel_positions_recent`
Hot tier. Every position update we observe. Auto-purged after 48 hours.
Powers the live map and the 1-hour timeline scrubber.

```sql
CREATE TABLE vessel_positions_recent (
  id BIGSERIAL PRIMARY KEY,
  mmsi INTEGER NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  sog REAL,                          -- speed over ground (knots)
  cog REAL,                          -- course over ground (degrees)
  true_heading REAL,
  navigational_status SMALLINT,
  region TEXT NOT NULL,              -- 'malacca' | 'hormuz' | …
  message_type TEXT NOT NULL
);
CREATE INDEX ON vessel_positions_recent (region, observed_at DESC);
CREATE INDEX ON vessel_positions_recent (mmsi, observed_at DESC);
```

Estimated volume: at validated Malacca rates (~2 msg/sec) plus other
regions, well under 1M rows per 48h. Trivial.

### `vessel_positions_hourly`
Warm tier. One representative position per vessel per region per hour. Kept
indefinitely. Powers historical animation and long-term trend analysis.

```sql
CREATE TABLE vessel_positions_hourly (
  mmsi INTEGER NOT NULL,
  region TEXT NOT NULL,
  hour TIMESTAMPTZ NOT NULL,         -- truncated to hour boundary
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  sog REAL,
  cog REAL,
  ship_type SMALLINT,
  ship_name TEXT,
  flag_state TEXT,
  PRIMARY KEY (mmsi, region, hour)
);
CREATE INDEX ON vessel_positions_hourly (region, hour DESC);
```

### `vessels` (slowly-changing dimension)
One row per MMSI we've ever seen, holding the latest known static data
(name, type, dimensions, flag). Updated whenever a fresher
`ShipStaticData` arrives.

```sql
CREATE TABLE vessels (
  mmsi INTEGER PRIMARY KEY,
  imo INTEGER,
  ship_name TEXT,
  call_sign TEXT,
  ship_type SMALLINT,
  flag_state TEXT,
  length_m REAL,
  width_m REAL,
  draft_m REAL,
  destination TEXT,
  updated_at TIMESTAMPTZ NOT NULL
);
```

---

## 8. Bounding boxes

Format: `[lat, lon]` per AISStream convention.

```ts
const REGIONS = {
  // PRIMARY — the protagonist. Malacca + Singapore Strait + approaches.
  // Validated 2026-05-06: ~58 PositionReports per 30s, 107 unique vessels
  // per 60s. The visually dense showcase.
  malaccaSingapore: { sw: [1.0, 100.5], ne: [6.0, 105.0] },

  // SECONDARY — the four-choke-point coverage panel. All three are
  // currently dead zones for different reasons; counters will animate up
  // automatically if/when AIS coverage or geopolitics change.
  hormuzApproaches: { sw: [22.0, 50.0], ne: [28.0, 60.0] },   // strait closed since Feb 2026
  babElMandeb:      { sw: [11.5, 42.5], ne: [14.0, 44.5] },   // Houthi corridor; widened from spec
  suez:             { sw: [29.5, 32.0], ne: [31.7, 33.0] },   // canal length; widened from spec

  // STRETCH — additional choke points if expanded post-M4.
  bosphorus:        { sw: [40.9, 28.8], ne: [41.3, 29.3] },
  panama:           { sw: [8.8, -80.0], ne: [9.5, -79.4] },
};
```

---

## 9. Key features

### MVP (M1–M4)

1. **Live Malacca/Singapore torrent.** Map centered on Singapore Strait at
   zoom 9, dark satellite basemap, every visible vessel rendered as deck.gl
   `IconLayer` with ship-type silhouettes (tanker, container, bulker, LNG,
   passenger, fishing). Updates sub-minute as new positions arrive.

2. **Vessel trails.** deck.gl `TripsLayer` showing the last 30 minutes of
   each vessel's motion as fading lines. Trails fade on scrubber playback.

3. **Vessel detail Sheet.** Click vessel → shadcn `Sheet` slides in from
   the right with: name, MMSI, IMO, flag, type, length × width, draft,
   speed, heading, navigational status, destination, ETA, last position.

4. **HUD chrome.** Glassmorphism overlay over the map:
   - Live counter: "X vessels in transit through Malacca right now"
   - Ship-type breakdown bar (containers / tankers / bulk / LNG / passenger / other)
   - Connection status pill, current UTC time, data-lag indicator
   - Geist Mono with `tabular-nums` for all numeric telemetry

5. **Critical Choke Points panel.** Compact secondary panel (top-right)
   with four live counters, each clickable for a one-paragraph context
   modal:
   ```
   ┌─────────────────────────────────────────┐
   │ Critical Choke Points                   │
   │                                         │
   │ Malacca           387 vessels   normal  │
   │ Suez                3 vessels   sparse  │
   │ Bab el-Mandeb       0 vessels   dark    │
   │ Hormuz              0 vessels   closed  │
   └─────────────────────────────────────────┘
   ```
   Click context (one-line each in the modal):
   - **Malacca** — terrestrial AIS coverage strong; ~25% of global trade
   - **Suez** — canal-bound transits, sparse AISStream coverage; widen
     bbox or wait longer to see traffic
   - **Bab el-Mandeb** — Houthi attack corridor since 2023; vessels
     deliberately AIS-dark for safety
   - **Hormuz** — strait effectively closed to commercial shipping since
     Feb 2026; counter will animate up if/when traffic resumes
   The counters are live; if AIS coverage or geopolitics shift, this panel
   updates automatically without a code change.

6. **⌘K command palette.** shadcn `Command`. Search any vessel observed in
   the last 48h by name, MMSI, or flag.

### Signature features (M4)

7. **Timeline scrubber.** Drag to replay the last hour from
   `vessel_positions_recent`. Vessels animate along their actual paths via
   deck.gl `TripsLayer`. Scrubber lives in a bottom strip.

8. **Ship-type heatmap toggle.** Switch the icon layer for a deck.gl
   `HeatmapLayer` colored by cargo type — useful for seeing trade pattern
   density at a glance.

### Stretch (M5)

9. **Historical replay** from `vessel_positions_hourly` once we've
   accumulated enough data (probably 4+ weeks post-launch). "Show me Malacca
   on a typical Tuesday" comparisons.

10. **Ghost-transit ledger** (the original Hormuz feature, applied to
    Malacca anomalies — vessels that vanish from AIS in the strait).

11. **Bosphorus / Panama additional regions** as toggle-able views.

12. **ACLED incident overlay** for piracy events, port closures.

13. **Vessel cargo value estimation** (DWT × commodity proxies).

---

## 10. Milestones

Each milestone targets ~1 week. Each issue is sized for a single Claude Code
session (1–3 hours of focused work).

**Genesis commit** (no GitHub issue — bootstrap predates the issue tracker):
`git init`, repo created public + MIT (`Ozan Selcuk`), `PRD.md`, `LICENSE`,
`README.md`, `.gitignore`, `.editorconfig`, validation spikes in `scripts/`.
Done 2026-05-06.

### M1 — Foundation
- **#1** Tooling foundation: pnpm workspaces monorepo (`apps/web`,
  `apps/worker`, `packages/shared`), root `tsconfig.base.json`, ESLint
  (`eslint-config-next` + `@typescript-eslint`), Prettier with
  `eslint-config-prettier` bridge, Husky + lint-staged pre-commit hook,
  GitHub Actions CI workflow (lint + typecheck on every PR), Dependabot
  config, branch protection on `main` (require PR + green CI).
- **#2** Postgres + schema. `docker-compose.yml` with Postgres 16. Migration
  tool wired up (`drizzle-kit` or `node-pg-migrate`). Initial schema
  migration creating the three tables from §7.
- **#3** Next.js 16.2 scaffold inside `apps/web/`: TypeScript strict,
  Tailwind 4, shadcn/ui, React Compiler, dark theme, base layout,
  `.env.local` setup with Mapbox token, `.env.example` with placeholders.

### M2 — Live pipe with synthetic data
- **#4** Worker service stub: TypeScript, `ws` server, emits a synthetic
  vessel-position stream so the UI can be built without depending on
  AISStream.
- **#5** Mapbox + deck.gl in App Router. Dark satellite basemap centered on
  Singapore Strait at zoom 9. The dynamic-import-from-Client-Component
  pattern.
- **#6** Browser ↔ worker WebSocket. Zustand store. Synthetic vessels
  rendering as deck.gl `IconLayer` on the map.

### M3 — Real data + persistence
- **#7** AISStream integration in the worker. Subscribe to
  `malaccaSingapore` (primary) + `hormuzApproaches` (inset). Blob decode,
  region bucketing, viewport-filtered fan-out to browsers, reconnection
  with exponential backoff.
- **#8** Postgres writes: every position → `vessel_positions_recent`,
  every static → `vessels`. Hourly aggregation cron → `vessel_positions_hourly`.
  TTL purge of recent beyond 48h.
- **#9** Vessel detail Sheet wired to live data. Click vessel → fetch
  latest static + recent positions, render Sheet.

### M4 — Signature features + polish
- **#10** Timeline scrubber reading from `vessel_positions_recent`.
  TripsLayer trails.
- **#11** HUD polish + AIS coverage-gap inset panel + custom Mapbox dark
  style + ship-type SVG silhouettes. The `frontend-design` skill is invoked
  here for HUD composition and motion polish.
- **#12** ⌘K command palette + ship-type heatmap toggle.

### M5 — Stretch (separate cycle, post-M4)
Per §9 stretch list.

---

## 11. Open questions

1. **Hosting target.** GCP (Cloud Run + Cloud SQL), Azure (Container Apps +
   Postgres Flexible Server, Leaf MCPP), Vercel + Neon, or self-hosted.
   Decision deferred to post-M4.
2. **Default zoom level.** Singapore Strait at zoom 9 is a starting guess;
   may need 8 to capture more of Malacca. Tune in M2.
3. **Vessel-rendering performance.** At peak (likely 1000+ vessels in
   viewport), do we need viewport culling or icon LOD? The viewport-filtered
   fan-out from the worker handles most of this; client-side is icon
   rendering only.
4. **Worker viewport-filter granularity.** Should the browser send its
   exact viewport bbox (continuous) or just region IDs (discrete)? Start
   with region IDs; upgrade to viewport bbox if needed for performance.
5. **AISStream BETA status.** No SLA. The provider abstraction in the
   worker partially mitigates. Worth monitoring for outages during M3+.
6. **Hormuz reopening.** When the Feb-2026 closure resolves and commercial
   transits resume, the counter ticks up automatically — no code change
   needed. At that point we may want to elevate Hormuz from inset counter
   to its own dedicated panel, mirroring the Malacca treatment. Defer this
   decision until traffic returns.

---

## 12. Branding

Per Leaf AI Studio brand:
- **Active vessel highlight (selection):** `#F4A258`
- **Panel headers:** `#1F3864`
- **Body text neutral:** `#555555`
- **Map background:** custom dark satellite (Mapbox Studio, post-M3)

---

## 13. Glossary

- **AIS** — Automatic Identification System. Maritime transponder broadcast
  protocol carrying vessel position, identity, and metadata. Required on
  most commercial vessels >300 GT.
- **MMSI** — Maritime Mobile Service Identity. 9-digit unique identifier
  per vessel. Primary key.
- **IMO number** — International Maritime Organization number. 7-digit
  permanent hull identifier regardless of name/flag changes.
- **PositionReport** — AIS Class A position broadcast, every 2–10 seconds
  when moving, every 3 minutes when at anchor.
- **ShipStaticData** — AIS message carrying ship name, type, dimensions,
  destination. Broadcast every ~6 minutes.
- **DWT** — Deadweight tonnage. Cargo capacity proxy.
- **SOG / COG** — Speed Over Ground / Course Over Ground.
- **Choke point** — narrow waterway through which a disproportionate share
  of global trade transits. Malacca/Singapore carries ~25% of global trade.
- **AIS-dark** — A vessel whose AIS transponder is off, spoofed, or
  unreceivable. May be intentional or technical.

---

## 14. Appendix: validation evidence

Validation spike scripts live in `scripts/`:
- `validate-aisstream.mjs` — original 4-bbox subscription test
- `validate-hormuz.mjs` — 5-minute Hormuz-only test (returned 0)
- `validate-global.mjs` — global subscription, region-bucketed (returned the
  table in §2)

These are throwaway diagnostic tools, kept in the repo as documentation of
*how we know what we know* and to allow future re-validation if AISStream's
coverage characteristics change.
