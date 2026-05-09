"use client";

import { TripsLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { VesselPositionEvent } from "@maritime/shared";
import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  extendTripsWithLive,
  interpolateHeadsAtTime,
  type Head,
  type LiveObservation,
  type Trip,
} from "@/lib/scrubber/trips";
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

// Trail color matches the marker fill but more transparent — context, not
// foreground. TripsLayer fades along trailLength toward fully transparent.
const TRAIL_COLOR: [number, number, number] = [244, 162, 88];

// Visible trail span in seconds. PRD §9 feature 2 specifies 30 min; the
// 60-min query window above gives drag head-room without re-fetch.
const TRAIL_LENGTH_SEC = 30 * 60;

// Common shape across both modes' head-position layer data.
interface VesselHead {
  mmsi: number;
  lon: number;
  lat: number;
}

function vesselEventToHead(v: VesselPositionEvent): VesselHead {
  return { mmsi: v.mmsi, lon: v.lon, lat: v.lat };
}

function headFromTrips(trips: readonly Trip[], scrubAt: Date): Head[] {
  return interpolateHeadsAtTime(trips, scrubAt.getTime() / 1000);
}

/**
 * Project the live-store snapshot into the shape `extendTripsWithLive`
 * expects. ISO-string timestamps become epoch seconds at the boundary
 * so the trip-tail comparison is plain number math.
 */
function buildLiveObservationMap(
  vessels: ReadonlyMap<number, VesselPositionEvent>,
): Map<number, LiveObservation> {
  const out = new Map<number, LiveObservation>();
  for (const v of vessels.values()) {
    const tMs = Date.parse(v.observedAt);
    if (Number.isNaN(tMs)) continue;
    out.set(v.mmsi, { mmsi: v.mmsi, lon: v.lon, lat: v.lat, t: tMs / 1000 });
  }
  return out;
}

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

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getCursor: ({ isHovering }) => (isHovering ? "pointer" : "grab"),
    });

    const rebuildLayers = (): void => {
      const state = useVesselsStore.getState();

      // In live mode, head positions come from the live WS store — no lag,
      // no interpolation. In scrubbed mode they are interpolated from the
      // historical trips array at scrubAt. Same shape; same onClick.
      const heads: VesselHead[] =
        state.scrubberMode === "live"
          ? Array.from(state.vessels.values(), vesselEventToHead)
          : headFromTrips(state.trips, state.scrubAt);

      // In live mode, extend each trip's tail with the freshest WS
      // observation. Without this the trail can lag the head by up to
      // one bucket boundary (60 s) — visibly so for moving vessels.
      const tripsForLayer: readonly Trip[] =
        state.scrubberMode === "live"
          ? extendTripsWithLive(state.trips, buildLiveObservationMap(state.vessels))
          : state.trips;

      overlay.setProps({
        layers: [
          new TripsLayer<Trip>({
            id: "trails",
            data: tripsForLayer,
            getPath: (t) => t.path,
            getTimestamps: (t) => t.timestamps,
            getColor: TRAIL_COLOR,
            opacity: 0.55,
            widthMinPixels: 2,
            jointRounded: true,
            capRounded: true,
            trailLength: TRAIL_LENGTH_SEC,
            currentTime: state.scrubAt.getTime() / 1000,
          }),
          new ScatterplotLayer<VesselHead>({
            id: "vessels",
            data: heads,
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
              const obj = info.object as VesselHead | undefined;
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
      rebuildLayers();
      // Rebuild whenever any of the four layer-driving slices change.
      // Object.is bail-out keeps no-op WS ticks from triggering work.
      unsubscribe = useVesselsStore.subscribe((state, prev) => {
        if (
          state.vessels !== prev.vessels ||
          state.trips !== prev.trips ||
          state.scrubAt !== prev.scrubAt ||
          state.scrubberMode !== prev.scrubberMode
        ) {
          rebuildLayers();
        }
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
