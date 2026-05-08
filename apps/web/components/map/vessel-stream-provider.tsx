"use client";

import { useVesselsStream } from "@/lib/use-vessels-stream";

/**
 * Headless mounting component: opens the worker WebSocket and pumps
 * positions into the Zustand store. Renders nothing — its only job is
 * to provide an effect-mount point in the page tree so the store stays
 * decoupled from the map's imperative shell.
 */
export default function VesselStreamProvider() {
  useVesselsStream();
  return null;
}
