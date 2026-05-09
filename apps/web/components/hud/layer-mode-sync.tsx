"use client";

import { useEffect } from "react";

import { useVesselsStore, type LayerMode } from "@/lib/vessels-store";

interface LayerModeSyncProps {
  layerMode: LayerMode;
}

/**
 * Mirrors the URL-derived `?layer=` value into the Zustand store. The
 * world-map subscriber reads `layerMode` directly to decide which
 * layer set to render. Mirrors the SelectionSync pattern from #29.
 *
 * No cleanup: when the URL transitions A → B the parent re-renders
 * with the new prop and this effect re-runs with B. A cleanup writing
 * a default would fire the world-map subscriber an extra time per
 * navigation.
 */
export function LayerModeSync({ layerMode }: LayerModeSyncProps) {
  useEffect(() => {
    useVesselsStore.getState().setLayerMode(layerMode);
  }, [layerMode]);
  return null;
}
