"use client";

import { useState } from "react";

import { useTripHistory } from "@/lib/use-trip-history";
import { useVesselsStore } from "@/lib/vessels-store";

interface ScrubberProviderProps {
  /** ISO timestamp from `?t=` to seed scrubbed mode on first load. Null
   * means start in live mode. Server-parsed in page.tsx so the seed
   * lands before useTripHistory's first fetch and we avoid a wasted
   * round-trip to the live bucket. */
  initialScrubAt: string | null;
}

/**
 * Headless mount that seeds initial scrubber state from the URL and then
 * runs the background loops (live-mode clock + bucket-keyed history
 * fetch). Mirrors `vessel-stream-provider.tsx`'s pattern: zero render
 * output, single side-effecting hook call.
 */
export default function ScrubberProvider({ initialScrubAt }: ScrubberProviderProps) {
  // useState's lazy initializer runs once per mount; idempotent under
  // StrictMode's dev double-invoke (re-running setScrubberMode/setScrubAt
  // with the same values is a no-op). Setting Zustand state outside
  // React's reconciler is safe and keeps the seed synchronous so
  // useTripHistory's first effect picks up the seeded bucket directly.
  useState(() => {
    if (initialScrubAt === null) return null;
    const at = new Date(initialScrubAt);
    if (Number.isNaN(at.getTime())) return null;
    const store = useVesselsStore.getState();
    store.setScrubberMode("scrubbed");
    store.setScrubAt(at);
    return null;
  });
  useTripHistory();
  return null;
}
