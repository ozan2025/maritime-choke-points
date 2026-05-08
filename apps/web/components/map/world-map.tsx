"use client";

import { ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { VesselPositionEvent } from "@maritime/shared";
import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useVesselsStore } from "@/lib/vessels-store";

import "mapbox-gl/dist/mapbox-gl.css";

// Singapore Strait. PRD §11 Q2: zoom 9 is the starting guess. M4 #11 will
// fork a custom Mapbox Studio dark style; until then dark-v10 is the
// interim choice (#16 reviewer + HANDOVER punt #13: dark-v11 has too
// little land/water contrast at zoom 9 to pick out the strait).
const INITIAL_CENTER: [number, number] = [103.85, 1.27];
const INITIAL_ZOOM = 9;
const STYLE_URL = "mapbox://styles/mapbox/dark-v10";

// Vessel marker colors — RGBA. PRD §12 active-vessel highlight (#F4A258);
// stroke is a lightened tint that reads on dark-v10. Type-specific
// silhouettes are M4 #11.
const VESSEL_FILL: [number, number, number, number] = [244, 162, 88, 230];
const VESSEL_STROKE: [number, number, number, number] = [255, 224, 189, 255];

export default function WorldMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const router = useRouter();
  // Latest router ref so the deck.gl onClick captured on overlay
  // construction can still navigate after re-renders without rebuilding
  // the layers — keeps the click → searchParam round-trip cheap.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

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

    // deck.gl overlay + ScatterplotLayer. The store subscription lives
    // outside the React render path so position updates (~28 events/s
    // from the synthetic source) do not drive React reconciliation —
    // only Mapbox/deck.gl's rAF loop.
    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab"),
    });

    const rebuildLayers = (): void => {
      const vessels = useVesselsStore.getState().vessels;
      overlay.setProps({
        layers: [
          new ScatterplotLayer<VesselPositionEvent>({
            id: "vessels",
            data: Array.from(vessels.values()),
            getPosition: (d) => [d.lon, d.lat],
            getRadius: 5,
            radiusUnits: "pixels",
            getFillColor: VESSEL_FILL,
            getLineColor: VESSEL_STROKE,
            stroked: true,
            lineWidthUnits: "pixels",
            getLineWidth: 1,
            pickable: true,
            onClick: (info) => {
              const obj = info.object as VesselPositionEvent | undefined;
              if (!obj) return;
              routerRef.current.replace(`?mmsi=${obj.mmsi}`, { scroll: false });
            },
          }),
        ],
      });
    };

    let unsubscribe: (() => void) | null = null;
    const attachOverlay = (): void => {
      map.addControl(overlay);
      // Initial paint with whatever's already in the store.
      rebuildLayers();
      // Vanilla store subscribe — fires only when state actually changes
      // (Zustand uses Object.is bail-out internally).
      unsubscribe = useVesselsStore.subscribe((state, prev) => {
        if (state.vessels !== prev.vessels) rebuildLayers();
      });
    };

    if (map.loaded()) {
      attachOverlay();
    } else {
      map.once("load", attachOverlay);
    }

    return () => {
      unsubscribe?.();
      try {
        map.removeControl(overlay);
      } catch {
        // map.remove() below also tears down controls; ignore double-remove.
      }
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
