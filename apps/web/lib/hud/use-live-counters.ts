"use client";

import type { RegionId } from "@maritime/shared";
import { useEffect, useState } from "react";

import { iconForShipType, type ShipBucket } from "@/lib/ais/ship-icons";
import { useVesselsStore } from "@/lib/vessels-store";

export interface LiveCounters {
  total: number;
  byBucket: Record<ShipBucket, number>;
  byRegion: Record<RegionId, number>;
  /**
   * Wall-clock-ms of the freshest observation in the store, or null if
   * the store is empty. Drives the data-lag indicator in the system
   * pill: `lag = Date.now() - lastObservedAtMs`.
   */
  lastObservedAtMs: number | null;
}

function snapshot(): LiveCounters {
  const { vessels } = useVesselsStore.getState();
  const byBucket: Record<ShipBucket, number> = {
    tanker: 0,
    cargo: 0,
    bulker: 0,
    lng: 0,
    passenger: 0,
    fishing: 0,
    other: 0,
  };
  const byRegion: Record<RegionId, number> = {
    malaccaSingapore: 0,
    hormuzApproaches: 0,
    babElMandeb: 0,
    suez: 0,
  };
  let lastObservedAtMs: number | null = null;

  for (const v of vessels.values()) {
    byBucket[iconForShipType(v.shipType)]++;
    byRegion[v.region]++;
    const t = Date.parse(v.observedAt);
    if (!Number.isNaN(t) && (lastObservedAtMs === null || t > lastObservedAtMs)) {
      lastObservedAtMs = t;
    }
  }

  return { total: vessels.size, byBucket, byRegion, lastObservedAtMs };
}

/**
 * Polls the Zustand store at 1 Hz and returns aggregated counts for the
 * HUD. Polling is intentional — subscribing directly would re-fire at
 * the WS rate (~28 Hz) and re-derive the same totals. This hook is the
 * coarser tap PRD §10 carries forward from HANDOVER punt #14.
 *
 * The `selectedMmsi` slice is *not* read here; selection state goes
 * straight to the IconLayer accessors and bypasses this aggregation
 * path, so vessel highlighting never triggers a counter recomputation.
 */
export function useLiveCounters(): LiveCounters {
  // Lazy initializer reads the store once at mount — empty on first
  // render before the WS pipe fills, then updated every second by the
  // interval below. Avoids the setState-in-effect pattern.
  const [counters, setCounters] = useState<LiveCounters>(snapshot);

  useEffect(() => {
    const id = setInterval(() => setCounters(snapshot()), 1000);
    return () => clearInterval(id);
  }, []);

  return counters;
}
