"use client";

import type { RegionId } from "@maritime/shared";
import { motion } from "framer-motion";
import { useState } from "react";

import { ChokePointDialog } from "@/components/hud/choke-point-dialog";
import { useLiveCounters } from "@/lib/hud/use-live-counters";
import { cn } from "@/lib/utils";

const ACTIVE = "#F4A258";

interface TileSpec {
  region: RegionId;
  label: string;
}

// Order: Malacca first as the protagonist (PRD §9 feature 5 table); the
// three coverage-gap regions follow; Bosphorus + Panama (M5 #38) close
// the row as the additional live-data choke points.
const TILES: readonly TileSpec[] = [
  { region: "malaccaSingapore", label: "MALACCA" },
  { region: "suez", label: "SUEZ" },
  { region: "babElMandeb", label: "BAB el-MANDEB" },
  { region: "hormuzApproaches", label: "HORMUZ" },
  { region: "bosphorus", label: "BOSPHORUS" },
  { region: "panama", label: "PANAMA" },
];

interface ChokePointTileProps {
  tile: TileSpec;
  count: number;
  active: boolean;
  index: number;
  onClick: () => void;
}

function ChokePointTile({ tile, count, active, index, onClick }: ChokePointTileProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.06 * index,
      }}
      whileHover={{ y: -2 }}
      className={cn(
        // Width shrunk from 140px → 116px when M5 #38 grew the row from
        // 4 to 6 tiles. 6 × 116 + 5 × 12 (gap-3) = 756px — fits a
        // 1280px viewport with breathing room and stays single-row down
        // to ~800px before wrapping is needed.
        "group pointer-events-auto relative w-[116px] cursor-pointer overflow-hidden",
        "rounded-lg border border-white/[0.06] bg-[rgba(8,12,22,0.55)]",
        "backdrop-blur-md backdrop-saturate-150",
        "shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
        "px-3 py-2.5 text-left transition-shadow",
        "hover:shadow-[0_8px_28px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]",
        active && "ring-1 ring-[#F4A258]/40",
      )}
      aria-label={`${tile.label} — ${count} vessels — open context`}
    >
      <div
        className="font-mono text-[9px] uppercase tracking-[0.2em]"
        style={{ color: active ? ACTIVE : "rgba(255,255,255,0.55)" }}
      >
        {tile.label}
      </div>
      <div className="mt-1 font-sans text-[22px] leading-none font-medium text-white tabular-nums">
        {count.toLocaleString()}
      </div>
      <span
        aria-hidden
        className="absolute right-3 bottom-2 left-3 h-px origin-left scale-x-0 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
        style={{ backgroundColor: ACTIVE }}
      />
    </motion.button>
  );
}

/**
 * Bottom row of glass tiles — one per critical choke point. Sits above
 * the scrubber. Click any tile to open a context dialog with the
 * region's status copy.
 *
 * Region populations:
 *  - Malacca: ~25% of global trade; the protagonist.
 *  - Suez / Bab el-Mandeb / Hormuz: AISStream returns 0 for those
 *    bboxes per PRD §2 validation. Counters reflect that honestly.
 *  - Bosphorus / Panama (M5 #38): strong terrestrial AIS coverage; live
 *    counts populate within ~1 minute of worker connect.
 */
export function ChokePointsRow() {
  const { byRegion } = useLiveCounters();
  const [openRegion, setOpenRegion] = useState<RegionId | null>(null);

  return (
    <>
      <div
        // Sits just above the bottom-strip scrubber (which has its own
        // pointer-events surface). pointer-events-none on the wrapper +
        // pointer-events-auto on each tile keeps the gaps between tiles
        // from blocking map drag.
        className="pointer-events-none absolute right-0 bottom-[88px] left-0 z-10 flex justify-center gap-3 px-6"
      >
        {TILES.map((tile, i) => (
          <ChokePointTile
            key={tile.region}
            tile={tile}
            count={byRegion[tile.region]}
            active={tile.region === "malaccaSingapore"}
            index={i}
            onClick={() => setOpenRegion(tile.region)}
          />
        ))}
      </div>
      <ChokePointDialog
        region={openRegion}
        count={openRegion ? byRegion[openRegion] : 0}
        onOpenChange={(open) => {
          if (!open) setOpenRegion(null);
        }}
      />
    </>
  );
}
