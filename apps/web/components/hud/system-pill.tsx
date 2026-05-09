"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { GlassPanel } from "@/components/hud/glass-panel";
import { useLiveCounters } from "@/lib/hud/use-live-counters";
import { useVesselsStore } from "@/lib/vessels-store";

const ACTIVE = "#F4A258";
const NEUTRAL = "#555555";

function formatUtc(d: Date): string {
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatLag(lagMs: number | null): string {
  if (lagMs === null) return "—";
  if (lagMs < 0) return "0.0s";
  if (lagMs < 1000) return `${lagMs.toFixed(0)}ms`;
  if (lagMs < 60_000) return `${(lagMs / 1000).toFixed(1)}s`;
  return `${(lagMs / 60_000).toFixed(1)}m`;
}

/**
 * Top-left HUD capsule. LED + UTC clock + data-lag indicator.
 *
 * Two clocks are running in this component:
 *  - The 1 Hz tick from `useLiveCounters` provides `lastObservedAtMs`,
 *    refreshed each second from the store snapshot.
 *  - A local 1 Hz `setInterval` updates `now` for the UTC display and
 *    so the lag readout drifts even when no new positions arrive.
 *
 * Splitting them keeps the lag indicator honest — the wall clock
 * advances independently of the AIS firehose.
 */
export function SystemPill() {
  const { connectionStatus } = useVesselsStore(
    useShallow((s) => ({ connectionStatus: s.connectionStatus })),
  );
  const { lastObservedAtMs } = useLiveCounters();
  // Seeded as `null` so SSR + first client render produce the same
  // placeholder text — avoids a hydration-mismatch warning. The first
  // interval tick (≤1 s after mount) supplies a real Date.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isLive = connectionStatus === "open";
  const ledColor = isLive ? ACTIVE : NEUTRAL;
  const lag = now === null || lastObservedAtMs === null ? null : now.getTime() - lastObservedAtMs;
  const utcLabel = now === null ? "--:--:--" : formatUtc(now);

  return (
    <div className="pointer-events-none absolute top-4 left-4 z-10">
      <GlassPanel variant="capsule" className="pointer-events-auto">
        <div className="flex items-center gap-3 font-mono text-[11px] tracking-wide text-white/80 tabular-nums">
          <span className="relative flex h-2 w-2 items-center justify-center">
            <span
              aria-hidden
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: ledColor, animationDuration: isLive ? "1.4s" : "0s" }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: ledColor }}
            />
          </span>
          <span
            className="uppercase tracking-[0.18em]"
            style={{ color: isLive ? ACTIVE : "rgba(255,255,255,0.6)" }}
          >
            {connectionStatus.toUpperCase()}
          </span>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <span className="text-white/85">{utcLabel} UTC</span>
          <span aria-hidden className="text-white/20">
            ·
          </span>
          <span className="text-white/55">lag {formatLag(lag)}</span>
        </div>
      </GlassPanel>
    </div>
  );
}
