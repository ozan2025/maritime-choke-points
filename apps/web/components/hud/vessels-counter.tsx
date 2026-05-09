"use client";

import { AnimatePresence, motion } from "framer-motion";

import { GlassPanel } from "@/components/hud/glass-panel";
import { useLiveCounters } from "@/lib/hud/use-live-counters";

const ACTIVE = "#F4A258";

/**
 * Rendering buckets for the breakdown row. Collapses the seven internal
 * `ShipBucket` values into the five labels PRD §9 feature 4 lists.
 * `bulker` rolls into `cargo` for display only — the icon layer keeps
 * the seven-way distinction.
 */
const COLUMNS = [
  { key: "tank", label: "TANK", buckets: ["tanker"] },
  { key: "cargo", label: "CARGO", buckets: ["cargo", "bulker"] },
  { key: "lng", label: "LNG", buckets: ["lng"] },
  { key: "pass", label: "PASS", buckets: ["passenger"] },
  { key: "other", label: "OTHER", buckets: ["fishing", "other"] },
] as const;

const BAR_HEIGHT = 28;

/**
 * Top-right HUD card. Big total + 5-column ship-type breakdown. Total
 * uses a vertical clip-path slot-machine reveal on change so the eye is
 * drawn to motion without a jarring flash.
 */
export function VesselsCounter() {
  const { total, byBucket } = useLiveCounters();

  const columns = COLUMNS.map((col) => {
    let count = 0;
    for (const b of col.buckets) {
      count += byBucket[b as keyof typeof byBucket];
    }
    return { ...col, count };
  });
  const max = columns.reduce((m, c) => Math.max(m, c.count), 0);

  return (
    <div className="pointer-events-none absolute top-4 right-4 z-10">
      <GlassPanel variant="card" className="pointer-events-auto w-[260px]">
        <div className="flex items-baseline justify-between">
          <div className="overflow-hidden font-sans text-[34px] leading-none font-medium text-white tabular-nums">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={total}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -24, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block"
              >
                {total.toLocaleString()}
              </motion.span>
            </AnimatePresence>
          </div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            VESSELS
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {columns.map((col, i) => {
            const ratio = max === 0 ? 0 : col.count / max;
            const opacity = 0.25 + 0.75 * ratio;
            return (
              <div key={col.key} className="flex flex-col items-center gap-1.5">
                <div
                  className="font-mono text-[10px] tabular-nums text-white/85"
                  aria-label={`${col.label} ${col.count}`}
                >
                  {col.count}
                </div>
                <div
                  className="relative w-full overflow-hidden rounded-sm bg-white/[0.04]"
                  style={{ height: BAR_HEIGHT }}
                >
                  <motion.div
                    className="absolute inset-x-0 bottom-0 rounded-sm"
                    style={{ backgroundColor: ACTIVE, opacity }}
                    initial={false}
                    animate={{ height: `${ratio * 100}%` }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.04 * i,
                    }}
                  />
                </div>
                <div
                  className="font-mono text-[9px] uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {col.label}
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}
