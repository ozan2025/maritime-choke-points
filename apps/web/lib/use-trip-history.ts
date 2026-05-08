"use client";

import type { RegionId } from "@maritime/shared";
import { useEffect, useRef } from "react";

import { bucketRound, groupRowsIntoTrips, type HistoryRow } from "@/lib/scrubber/trips";
import { useVesselsStore } from "@/lib/vessels-store";

// Bucket size matches the route handler's `Cache-Control: max-age=60`.
// Both sides agreeing on 60 s is what makes the browser HTTP cache
// dedup identical drag ticks within a minute.
const BUCKET_SEC = 60;

// Wall-clock cadence. In live mode, scrubAt advances by ~1 s so deck.gl
// TripsLayer's currentTime crawls forward and the trail tail erases as
// the window slides. In scrubbed mode, the Scrubber UI owns scrubAt
// directly and these ticks are ignored.
const LIVE_TICK_MS = 1000;

// Single-region MVP. The scrubber covers the protagonist (Malacca/Singapore);
// inset regions (#11) get their own coverage-gap counter, not a scrub UI.
const REGION: RegionId = "malaccaSingapore";

interface HistoryResponseBody {
  region: string;
  windowStart: string;
  windowEnd: string;
  rows: HistoryRow[];
}

/**
 * Headless effect: drives the scrubber's two background loops.
 *
 *   1. **Live-mode clock.** Every `LIVE_TICK_MS` ms while `scrubberMode
 *      === "live"`, write `scrubAt = new Date()`. Lets the TripsLayer
 *      animate without coupling layer rebuilds to the WS tick rate.
 *   2. **Bucket-keyed history fetch.** Subscribe to the store, derive the
 *      bucket-rounded scrubAt, and re-fetch only when the bucket
 *      changes. AbortController cancels any in-flight request when a
 *      new bucket key arrives — important during a fast drag.
 */
export function useTripHistory(): void {
  const setTrips = useVesselsStore((s) => s.setTrips);
  const setScrubAt = useVesselsStore((s) => s.setScrubAt);

  useEffect(() => {
    const id = setInterval(() => {
      if (useVesselsStore.getState().scrubberMode === "live") {
        setScrubAt(new Date());
      }
    }, LIVE_TICK_MS);
    return () => clearInterval(id);
  }, [setScrubAt]);

  const lastBucketRef = useRef<number | null>(null);
  useEffect(() => {
    let inflight: AbortController | null = null;

    const fetchBucket = async (bucketDate: Date): Promise<void> => {
      inflight?.abort();
      const ac = new AbortController();
      inflight = ac;
      const url =
        `/api/positions/history?region=${REGION}` +
        `&bucket=${encodeURIComponent(bucketDate.toISOString())}`;
      try {
        const resp = await fetch(url, { signal: ac.signal });
        if (!resp.ok) {
          console.warn(`[trip-history] ${resp.status} ${resp.statusText}`);
          return;
        }
        const body = (await resp.json()) as HistoryResponseBody;
        if (ac.signal.aborted) return;
        setTrips(groupRowsIntoTrips(body.rows), bucketDate);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.warn("[trip-history] fetch failed", err);
      }
    };

    const onChange = (scrubAt: Date): void => {
      const bucketMs = bucketRound(scrubAt, BUCKET_SEC).getTime();
      if (bucketMs === lastBucketRef.current) return;
      lastBucketRef.current = bucketMs;
      void fetchBucket(new Date(bucketMs));
    };

    // Initial kick.
    onChange(useVesselsStore.getState().scrubAt);

    const unsub = useVesselsStore.subscribe((state, prev) => {
      if (state.scrubAt !== prev.scrubAt) onChange(state.scrubAt);
    });

    return () => {
      unsub();
      inflight?.abort();
    };
  }, [setTrips]);
}
