"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { GlassPanel } from "@/components/hud/glass-panel";
import { useVesselsStore, type LayerMode } from "@/lib/vessels-store";

const ACTIVE = "#F4A258";

/**
 * Two-segment "view mode" toggle docked in the top-left HUD strip,
 * just right of the PaletteTrigger. Click flips between IconLayer
 * and stacked HeatmapLayers (one per ship-type group).
 *
 * URL is canonical: `?layer=heat` written when the heatmap is on,
 * removed when it is off. Other params (`?mmsi=`, `?t=`) are
 * preserved via `URLSearchParams`. Same shape as scrubber.tsx.
 *
 * The store value updates optimistically so the toggle responds
 * before the router replace settles — feels instant even on slow
 * navigations.
 */
export function LayerModeToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const layerMode = useVesselsStore((s) => s.layerMode);
  const setLayerMode = useVesselsStore((s) => s.setLayerMode);

  const setMode = (next: LayerMode) => {
    if (next === layerMode) return;
    setLayerMode(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "heatmap") {
      params.set("layer", "heat");
    } else {
      params.delete("layer");
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/", { scroll: false });
  };

  return (
    <div className="pointer-events-none absolute top-4 left-[372px] z-10">
      <GlassPanel variant="capsule" className="pointer-events-auto p-0!">
        <div
          role="group"
          aria-label="Map layer mode"
          className="flex h-full items-center gap-0.5 px-1.5 py-1 font-mono text-[10px] tracking-[0.18em] uppercase"
        >
          <Segment active={layerMode === "icons"} onClick={() => setMode("icons")} label="Icons" />
          <span aria-hidden className="text-white/15">
            ·
          </span>
          <Segment
            active={layerMode === "heatmap"}
            onClick={() => setMode("heatmap")}
            label="Heatmap"
          />
        </div>
      </GlassPanel>
    </div>
  );
}

function Segment({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full px-2.5 py-1 transition-colors"
      style={{
        color: active ? ACTIVE : "rgba(255,255,255,0.55)",
        backgroundColor: active ? "rgba(244,162,88,0.10)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}
