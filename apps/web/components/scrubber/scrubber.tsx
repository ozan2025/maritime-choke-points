"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { useVesselsStore } from "@/lib/vessels-store";

// Window the scrubber covers, in seconds. Matches the route handler's
// HISTORY_WINDOW_MS (60 min).
const WINDOW_SEC = 60 * 60;

// Snap-to-live tolerance. A release within this many seconds of the right
// edge is treated as "go live", so the user does not have to land
// pixel-perfectly on `now` to resume real-time fan-out.
const LIVE_SNAP_SEC = 30;

/**
 * Bottom-strip slider. Drives `scrubberMode` and `scrubAt` in the
 * Zustand store; world-map.tsx subscribes and rebuilds layers.
 *
 * UI contract:
 *   - rightmost = live (slider value = WINDOW_SEC)
 *   - leftmost  = "60 min ago" (slider value = 0)
 *
 * Drag updates `scrubAt` in real time so the trail animates during the
 * drag. Release writes the URL — `?t=<iso>` for a scrubbed timestamp,
 * cleared at the live edge — preserving any other params (e.g. `?mmsi=`).
 *
 * The HUD pass in M4 #11 will style this beyond functional.
 */
export default function Scrubber() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const scrubAt = useVesselsStore((s) => s.scrubAt);
  const scrubberMode = useVesselsStore((s) => s.scrubberMode);
  const setScrubAt = useVesselsStore((s) => s.setScrubAt);
  const setScrubberMode = useVesselsStore((s) => s.setScrubberMode);

  // Local 1 Hz wall-clock so the slider visually drifts left in scrubbed
  // mode as fixed scrubAt becomes increasingly historical relative to now.
  // Initial Date.now() runs on the client only — no hydration mismatch
  // because the parent gates this component behind a Client Component
  // tree (no SSR of the slider thumb position).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // If a scrubbed timestamp drifted past the trail window, auto-snap back
  // to live — otherwise the slider would render at clamp = 0 with no
  // trails and no clear way to recover.
  useEffect(() => {
    if (scrubberMode !== "scrubbed") return;
    if (nowMs - scrubAt.getTime() > WINDOW_SEC * 1000) {
      writeUrlForLive(router, searchParams);
      setScrubberMode("live");
      setScrubAt(new Date(nowMs));
    }
  }, [scrubberMode, scrubAt, nowMs, router, searchParams, setScrubAt, setScrubberMode]);

  const offsetSec = Math.max(0, Math.min(WINDOW_SEC, (nowMs - scrubAt.getTime()) / 1000));
  const sliderValue = WINDOW_SEC - offsetSec;

  const onValueChange = (values: number[]): void => {
    const v = values[0];
    if (v === undefined) return;
    const offSec = WINDOW_SEC - v;
    const next = new Date(nowMs - offSec * 1000);
    if (offSec <= LIVE_SNAP_SEC) {
      setScrubberMode("live");
      setScrubAt(new Date(nowMs));
    } else {
      setScrubberMode("scrubbed");
      setScrubAt(next);
    }
  };

  const onValueCommit = (values: number[]): void => {
    const v = values[0];
    if (v === undefined) return;
    const offSec = WINDOW_SEC - v;
    if (offSec <= LIVE_SNAP_SEC) {
      writeUrlForLive(router, searchParams);
      setScrubberMode("live");
      setScrubAt(new Date(nowMs));
      return;
    }
    const at = new Date(nowMs - offSec * 1000);
    writeUrlForScrubAt(router, searchParams, at);
    setScrubberMode("scrubbed");
    setScrubAt(at);
  };

  const isLive = scrubberMode === "live";
  const offsetLabel = isLive ? "LIVE" : `−${formatOffset(offsetSec)}`;

  return (
    <div
      data-slot="scrubber"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 border-t border-border/40 bg-background/70 px-6 py-3 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center justify-between font-mono text-xs tabular-nums text-muted-foreground">
        <span>−60 min</span>
        <span className={isLive ? "font-medium text-primary" : "font-medium text-foreground"}>
          {offsetLabel}
        </span>
        <span>now</span>
      </div>
      <Slider
        min={0}
        max={WINDOW_SEC}
        step={1}
        value={[sliderValue]}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        aria-label="Timeline scrubber"
      />
    </div>
  );
}

function writeUrlForLive(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
): void {
  const next = new URLSearchParams(searchParams.toString());
  next.delete("t");
  const qs = next.toString();
  router.replace(qs ? `?${qs}` : "/", { scroll: false });
}

function writeUrlForScrubAt(
  router: ReturnType<typeof useRouter>,
  searchParams: ReturnType<typeof useSearchParams>,
  at: Date,
): void {
  const next = new URLSearchParams(searchParams.toString());
  next.set("t", at.toISOString());
  router.replace(`?${next.toString()}`, { scroll: false });
}

function formatOffset(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const mins = Math.floor(sec / 60);
  const remSec = Math.round(sec - mins * 60);
  return remSec === 0 ? `${mins}m` : `${mins}m ${remSec}s`;
}
