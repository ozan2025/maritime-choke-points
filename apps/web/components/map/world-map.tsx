"use client";

import { TripsLayer } from "@deck.gl/geo-layers";
import { IconLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { VesselPositionEvent } from "@maritime/shared";
import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { iconForShipType, SHIP_ICON_MAPPING } from "@/lib/ais/ship-icons";
import {
  extendTripsWithLive,
  interpolateHeadsAtTime,
  type Head,
  type LiveObservation,
  type Trip,
} from "@/lib/scrubber/trips";
import { useVesselsStore } from "@/lib/vessels-store";

import "mapbox-gl/dist/mapbox-gl.css";

// Singapore Strait. PRD §11 Q2: zoom 9 is the starting guess. A custom
// Mapbox Studio dark fork is tracked as follow-up #31 — until then
// dark-v10 is the interim choice (#16 reviewer + HANDOVER punt #13:
// dark-v11 has too little land/water contrast at zoom 9 to pick out
// the strait).
const INITIAL_CENTER: [number, number] = [103.85, 1.27];
const INITIAL_ZOOM = 9;
const STYLE_URL = "mapbox://styles/mapbox/dark-v10";

// Vessel marker colors — RGBA. PRD §12 active-vessel highlight (#F4A258)
// reserved for the selected MMSI; the rest render as a soft white so the
// ship-type silhouettes read against the dark satellite without competing
// with the orange-tinted trails.
const VESSEL_FILL: [number, number, number, number] = [230, 230, 235, 230];
const VESSEL_FILL_HIGHLIGHT: [number, number, number, number] = [244, 162, 88, 255];

// Trail color matches the brand orange but more transparent — context,
// not foreground. TripsLayer fades along trailLength toward fully transparent.
const TRAIL_COLOR: [number, number, number] = [244, 162, 88];

// Visible trail span in seconds. PRD §9 feature 2 specifies 30 min; the
// 60-min query window above gives drag head-room without re-fetch.
const TRAIL_LENGTH_SEC = 30 * 60;

// Icon sizing. Above the historical 5px scatter radius — the PNG
// silhouette needs the extra real estate to read as a ship rather than
// a dot, and the bumped hit-target closes HANDOVER punt #30 now that a
// TripsLayer sits underneath the heads.
const ICON_SIZE_BASE = 18;
const ICON_SIZE_SELECTED = 28;

// Common shape across both modes' head-position layer data. `shipType`
// drives `getIcon` so each vessel renders its bucket-appropriate
// silhouette; undefined falls back to "other" inside `iconForShipType`.
interface VesselHead {
  mmsi: number;
  lon: number;
  lat: number;
  shipType?: number;
}

function vesselEventToHead(v: VesselPositionEvent): VesselHead {
  return { mmsi: v.mmsi, lon: v.lon, lat: v.lat, shipType: v.shipType };
}

function headFromTrips(trips: readonly Trip[], scrubAt: Date): Head[] {
  return interpolateHeadsAtTime(trips, scrubAt.getTime() / 1000);
}

/**
 * In scrubbed mode the per-trip rows we fetched do not carry shipType
 * (it isn't on `HistoryRow` and adding it would widen the wire). But
 * shipType is invariant per MMSI — once a vessel reports "tanker" it
 * stays a tanker — so we can enrich interpolated heads from whichever
 * shipType the live store has on hand. Vessels that have since left
 * the live snapshot fall back to `undefined` and render as "other".
 */
function enrichHeadsWithShipType(
  heads: readonly Head[],
  liveVessels: ReadonlyMap<number, VesselPositionEvent>,
): VesselHead[] {
  const out: VesselHead[] = new Array(heads.length);
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (!h) continue;
    const live = liveVessels.get(h.mmsi);
    out[i] = { mmsi: h.mmsi, lon: h.lon, lat: h.lat, shipType: live?.shipType };
  }
  return out;
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
      const selectedMmsi = state.selectedMmsi;

      // In live mode, head positions come from the live WS store — no lag,
      // no interpolation. In scrubbed mode they are interpolated from the
      // historical trips array at scrubAt and then enriched with shipType
      // from the live store. Same shape; same onClick.
      const heads: VesselHead[] =
        state.scrubberMode === "live"
          ? Array.from(state.vessels.values(), vesselEventToHead)
          : enrichHeadsWithShipType(headFromTrips(state.trips, state.scrubAt), state.vessels);

      // In live mode, extend each trip's tail with the freshest WS
      // observation. Without this the trail can lag the head by up to
      // one bucket boundary (60 s) — visibly so for moving vessels.
      // TripsLayer's default dataComparator is whole-array reference
      // equality, so the outer array being new on every rebuild
      // (`live.size > 0`) means the layer re-runs accessors regardless;
      // the per-trip object identity preserved by extendTripsWithLive
      // keeps deck.gl's downstream attribute caches warm.
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
          new IconLayer<VesselHead>({
            id: "vessels",
            data: heads,
            // Dynamic icon loading: each accessor result is the full
            // descriptor (`{ url, width, height, mask }`). The same
            // object reference is returned for every vessel of the same
            // bucket so deck.gl can de-dupe into a runtime atlas.
            getIcon: (d) => SHIP_ICON_MAPPING[iconForShipType(d.shipType)],
            getPosition: (d) => [d.lon, d.lat],
            getSize: (d) => (d.mmsi === selectedMmsi ? ICON_SIZE_SELECTED : ICON_SIZE_BASE),
            sizeUnits: "pixels",
            getColor: (d) => (d.mmsi === selectedMmsi ? VESSEL_FILL_HIGHLIGHT : VESSEL_FILL),
            // Selection-driven accessors are not in the data array, so
            // tell deck.gl to re-evaluate them when the selected MMSI
            // changes. (selectedMmsi captures via closure on each
            // rebuild, so the trigger value cycling on change is enough
            // to invalidate.)
            updateTriggers: {
              getSize: selectedMmsi,
              getColor: selectedMmsi,
            },
            pickable: true,
            // Pixels with alpha below this threshold are excluded from
            // the picking pass — keeps the corners of the silhouette's
            // bounding box from registering clicks where there's no
            // visible vessel. The icon descriptor's default anchor is
            // already center, so positional alignment needs no opt-in.
            alphaCutoff: 0.05,
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
          state.scrubberMode !== prev.scrubberMode ||
          state.selectedMmsi !== prev.selectedMmsi
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
