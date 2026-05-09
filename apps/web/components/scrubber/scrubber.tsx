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
  // Seeded as `null` so SSR + first client hydration both render the
  // LIVE/right-edge thumb position deterministically. The first interval
  // tick (≤1 s after mount) supplies a real `Date.now()` and the slider
  // values update on the next paint without a hydration mismatch.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // If a scrubbed timestamp drifted past the trail window, auto-snap back
  // to live — otherwise the slider would render at clamp = 0 with no
  // trails and no clear way to recover.
  useEffect(() => {
    if (scrubberMode !== "scrubbed") return;
    if (nowMs === null) return;
    if (nowMs - scrubAt.getTime() > WINDOW_SEC * 1000) {
      writeUrlForLive(router, searchParams);
      setScrubberMode("live");
      setScrubAt(new Date(nowMs));
    }
  }, [scrubberMode, scrubAt, nowMs, router, searchParams, setScrubAt, setScrubberMode]);

  // Pre-mount: render LIVE / right-edge so SSR and first hydration agree.
  const offsetSec =
    nowMs === null ? 0 : Math.max(0, Math.min(WINDOW_SEC, (nowMs - scrubAt.getTime()) / 1000));
  const sliderValue = WINDOW_SEC - offsetSec;

  const onValueChange = (values: number[]): void => {
    if (nowMs === null) return;
    const v = values[0];
    if (v === undefined) return;
    const offSec = WINDOW_SEC - v;
    if (offSec <= LIVE_SNAP_SEC) {
      setScrubberMode("live");
      setScrubAt(new Date(nowMs));
    } else {
      setScrubberMode("scrubbed");
      setScrubAt(new Date(nowMs - offSec * 1000));
    }
  };

  const onValueCommit = (values: number[]): void => {
    if (nowMs === null) return;
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

  const isLive = scrubberMode === "live" || nowMs === null;
  const offsetLabel = isLive ? "LIVE" : `−${formatOffset(offsetSec)}`;

  return (
    <div
      data-slot="scrubber"
      className={[
        "pointer-events-auto absolute inset-x-0 bottom-0 z-20",
        "border-t border-white/[0.06] bg-[rgba(8,12,22,0.55)]",
        "backdrop-blur-md backdrop-saturate-150",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        "px-6 py-3.5",
      ].join(" ")}
    >
      <div className="mb-2.5 flex items-center justify-between font-mono text-[10px] tabular-nums text-white/45 uppercase tracking-[0.18em]">
        <span>−60 min</span>
        <span className="text-[11px] tracking-[0.2em]" style={{ color: "#F4A258" }}>
          {offsetLabel}
        </span>
        <span>now</span>
      </div>
      <Slider
        name="scrubber-offset"
        min={0}
        max={WINDOW_SEC}
        step={1}
        value={[sliderValue]}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        aria-label="Timeline scrubber"
        className={[
          // Track: muted glass; range fill: brand orange.
          "[&>*[data-slot=slider-track]]:bg-white/[0.08]",
          "[&>*[data-slot=slider-track]>*[data-slot=slider-range]]:bg-[#F4A258]",
          // Thumb: brand orange, no white outline, soft shadow.
          "[&>*[data-slot=slider-thumb]]:bg-[#F4A258]",
          "[&>*[data-slot=slider-thumb]]:border-[#F4A258]",
          "[&>*[data-slot=slider-thumb]]:ring-[#F4A258]/40",
          "[&>*[data-slot=slider-thumb]]:shadow-[0_0_0_3px_rgba(244,162,88,0.20)]",
        ].join(" ")}
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
