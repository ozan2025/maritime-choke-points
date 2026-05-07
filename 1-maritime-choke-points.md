# Maritime Choke Points — Real-Time Vessel Tracking

> **Build order:** 1 of 5

**Vision:** A dark-mode dashboard showing live ship traffic through the world's four critical maritime choke points (Strait of Hormuz, Bab el-Mandeb, Strait of Malacca, Suez Canal) with cargo context and geopolitical risk overlay. The "small slivers of ocean carrying 30% of global oil" visualization.

## Why this is impressive

- Genuinely real-time (sub-minute AIS updates)
- Geopolitical narrative is intuitive — viewers immediately get *why this matters*
- deck.gl arcs over satellite imagery look stunning out of the box
- Data is rich: cargo type, vessel size, flag state, speed, heading, draft

## Data sources

| Source | Cost | Auth | Notes |
|---|---|---|---|
| AISStream.io | Free | API key (signup at aisstream.io) | WebSocket firehose, filterable by bounding box |
| Mapbox GL JS | Free tier | Token | Satellite/dark base maps, 50k loads/mo free |
| ACLED API | Free (academic) | Email signup | Geopolitical incidents for risk overlay |
| OpenStreetMap Nominatim | Free | None | Port name resolution |

## Tech stack

- **Frontend:** React + Vite + TypeScript
- **Map:** Mapbox GL JS + deck.gl (`ArcLayer` for routes, `IconLayer` for vessels, `ScatterplotLayer` for incidents)
- **Backend:** Node.js + `ws` — WebSocket proxy from AISStream → browser, with vessel state buffering
- **Deploy:** Cloudflare Pages + Workers, or GCP Cloud Run
- **State:** Zustand

## Bounding boxes (paste-ready)

```ts
const CHOKE_POINTS = {
  hormuz:      { sw: [26.0, 55.5], ne: [27.0, 57.5] },
  babElMandeb: { sw: [12.3, 43.0], ne: [13.5, 44.0] },
  malacca:     { sw: [1.0, 102.5], ne: [4.0, 105.0] },
  suez:        { sw: [29.5, 32.3], ne: [31.5, 32.7] },
};
```

## MVP features

- Live vessel positions in all 4 choke points (toggleable per region)
- Color by AIS ship type: tanker / cargo / LNG / passenger / other
- Click vessel → modal with name, flag, cargo type, destination, speed, draft
- Counter strip: *"X tankers in transit through Hormuz right now"*
- Timeline scrubber for last 1h playback (in-memory ring buffer)

## Stretch (portfolio-grade)

- Cargo value estimation (DWT × commodity price proxies)
- Trail rendering with `TripsLayer` — last 30min positions
- Geopolitical incident overlay from ACLED
- *"What if Hormuz closed today"* simulation: red-out the strait, show stranded vessel count and downstream port impact
- Sound design: subtle sonar ping when a tanker enters a choke point

## Key technical risks

- AIS data has gaps (vessels go dark in certain regions intentionally — surface this honestly in UI)
- AISStream.io connection limits — need reconnection + exponential backoff
- Choke points generate high message volume; throttle and dedupe in the proxy layer
- Mapbox token exposure on frontend → use a domain-locked token

## Step 0 — first session prompt

> Set up a Vite + React + TypeScript project. Add Mapbox GL JS with a dark satellite style centered on the Strait of Hormuz at `[56.25, 26.5]`, zoom 8. Create a stub WebSocket connection panel that will eventually connect to AISStream.io. Use Leaf AI Studio brand colors as accents only — `#F4A258` for active vessel highlights, `#1F3864` for panel headers, neutral gray `#555555` for body text.

## Resources

- AISStream.io docs: https://aisstream.io/documentation
- deck.gl examples: https://deck.gl/examples
- AIS ship type codes: https://api.vtexplorer.com/docs/ref-aistypes.html
- Mapbox dark satellite: `mapbox://styles/mapbox/satellite-streets-v12`
