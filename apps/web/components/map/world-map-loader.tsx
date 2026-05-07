"use client";

import dynamic from "next/dynamic";

// Mapbox GL JS reads `window` at module init, so the map component must be
// client-only. Next 16.2 forbids `ssr: false` in Server Components, so the
// dynamic import lives here in a Client wrapper rather than in the page.
const WorldMap = dynamic(() => import("./world-map"), {
  ssr: false,
  loading: () => (
    <div
      aria-label="Loading map"
      style={{ position: "absolute", inset: 0, background: "#0b0b0b" }}
    />
  ),
});

export default WorldMap;
