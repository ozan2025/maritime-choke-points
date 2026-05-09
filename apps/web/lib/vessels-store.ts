import type { VesselPositionEvent } from "@maritime/shared";
import { create } from "zustand";

import type { Trip } from "@/lib/scrubber/trips";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";
export type ScrubberMode = "live" | "scrubbed";
export type LayerMode = "icons" | "heatmap";

export interface VesselsState {
  vessels: Map<number, VesselPositionEvent>;
  connectionStatus: ConnectionStatus;
  applySnapshot: (events: VesselPositionEvent[]) => void;
  applyPositionUpdate: (event: VesselPositionEvent) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Scrubber slice (M4 #27) ---------------------------------------------
  /**
   * `live` — head positions read from `vessels`, scrubAt tracks wall
   * clock at 1 Hz, trails refresh every 60 s.
   * `scrubbed` — head positions interpolated from `trips` at scrubAt,
   * trails refresh only when the bucket-rounded scrubAt changes.
   */
  scrubberMode: ScrubberMode;
  scrubAt: Date;
  /** Per-vessel paths covering [scrubAt − 60 min, scrubAt]. */
  trips: Trip[];
  /** Bucket-rounded scrubAt of the currently-loaded `trips`. Lets the
   * fetcher decide whether a new request is needed. */
  tripsBucketAt: Date | null;
  setScrubberMode: (mode: ScrubberMode) => void;
  setScrubAt: (at: Date) => void;
  setTrips: (trips: Trip[], bucketAt: Date) => void;

  // Selection slice (M4 #29) -------------------------------------------
  /** MMSI of the vessel currently highlighted by the IconLayer. Driven
   * by the `?mmsi=` searchParam — the page mirrors it into the store on
   * first render so the layer's getColor/getSize accessors and the
   * Sheet share one source of truth. */
  selectedMmsi: number | null;
  setSelectedMmsi: (mmsi: number | null) => void;

  // Layer-mode + palette slices (M4 #32) -------------------------------
  /** `icons` shows the IconLayer; `heatmap` swaps in stacked
   *  HeatmapLayers (one per ship-type bucket). TripsLayer renders in
   *  both modes. URL-canonical via `?layer=heat`. */
  layerMode: LayerMode;
  setLayerMode: (mode: LayerMode) => void;
  /** Open state for the ⌘K command palette. Lifted into the store so the
   *  global hotkey handler, the trigger pill, and the dialog itself
   *  share one source — no prop-drilling through `app/page.tsx`. */
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}

// Map keys are numeric mmsi — never stringify (per #17 issue notes).
// Reducers always create a fresh Map so deck.gl's shallow-ref data diff
// observes the change. Mutating in place would be invisible to the layer.
export const useVesselsStore = create<VesselsState>()((set) => ({
  vessels: new Map(),
  connectionStatus: "connecting",
  applySnapshot: (events) =>
    set(() => {
      const next = new Map<number, VesselPositionEvent>();
      for (const event of events) next.set(event.mmsi, event);
      return { vessels: next };
    }),
  applyPositionUpdate: (event) =>
    set((state) => {
      const next = new Map(state.vessels);
      next.set(event.mmsi, event);
      return { vessels: next };
    }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Scrubber slice ------------------------------------------------------
  scrubberMode: "live",
  scrubAt: new Date(),
  trips: [],
  tripsBucketAt: null,
  setScrubberMode: (mode) => set({ scrubberMode: mode }),
  setScrubAt: (at) => set({ scrubAt: at }),
  setTrips: (trips, bucketAt) => set({ trips, tripsBucketAt: bucketAt }),

  // Selection slice -----------------------------------------------------
  selectedMmsi: null,
  setSelectedMmsi: (mmsi) => set({ selectedMmsi: mmsi }),

  // Layer-mode + palette slices ----------------------------------------
  layerMode: "icons",
  setLayerMode: (mode) => set({ layerMode: mode }),
  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
}));
