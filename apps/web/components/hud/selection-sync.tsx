"use client";

import { useEffect } from "react";

import { useVesselsStore } from "@/lib/vessels-store";

interface SelectionSyncProps {
  mmsi: number | null;
}

/**
 * Mirrors the URL-derived `?mmsi=` value into the Zustand store. The
 * IconLayer's `getColor` / `getSize` accessors read `selectedMmsi`
 * directly from the store, so this is the single hop that turns a
 * shareable URL into a layer-level highlight.
 *
 * Lives separately from VesselSheet because the highlight should remain
 * even before the Sheet's static slot resolves — the Sheet is a
 * Suspense boundary, but selection feedback shouldn't wait on a DB read.
 */
export function SelectionSync({ mmsi }: SelectionSyncProps) {
  // No cleanup: when the URL transitions A → B the parent re-renders
  // with the new mmsi prop and this effect re-runs with B. Adding a
  // null-clear in cleanup would write null between A and B and fire
  // the world-map subscriber four times instead of one. The effect
  // itself handles `mmsi === null` (Sheet closed) on the prop side.
  useEffect(() => {
    useVesselsStore.getState().setSelectedMmsi(mmsi);
  }, [mmsi]);

  return null;
}
