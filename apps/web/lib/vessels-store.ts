import type { VesselPositionEvent } from "@maritime/shared";
import { create } from "zustand";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface VesselsState {
  vessels: Map<number, VesselPositionEvent>;
  connectionStatus: ConnectionStatus;
  applySnapshot: (events: VesselPositionEvent[]) => void;
  applyPositionUpdate: (event: VesselPositionEvent) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
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
}));
