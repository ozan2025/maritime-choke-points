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
  useEffect(() => {
    useVesselsStore.getState().setSelectedMmsi(mmsi);
    return () => {
      useVesselsStore.getState().setSelectedMmsi(null);
    };
  }, [mmsi]);

  return null;
}
