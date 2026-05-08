"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import "mapbox-gl/dist/mapbox-gl.css";

// Singapore Strait. PRD §11 Q2: zoom 9 is a starting guess to be tuned in #17
// once vessels are visible.
const INITIAL_CENTER: [number, number] = [103.85, 1.27];
const INITIAL_ZOOM = 9;
const STYLE_URL = "mapbox://styles/mapbox/dark-v11";

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Retained for #17: deck.gl MapboxOverlay will need the instance.
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // [token] is honest but build-inlined — Next replaces NEXT_PUBLIC_* at build
  // time, so this effect runs once. If runtime token override ever lands
  // (HANDOVER punt), the dep array is already correct.
  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  if (!token) {
    return <MissingTokenNotice />;
  }

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

function MissingTokenNotice() {
  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      className="flex items-center justify-center bg-background p-6 text-center"
    >
      <p className="max-w-md font-mono text-sm text-muted-foreground">
        Set <span className="text-foreground">NEXT_PUBLIC_MAPBOX_TOKEN</span> in{" "}
        <span className="text-foreground">apps/web/.env.local</span> to load the map.
      </p>
    </div>
  );
}
