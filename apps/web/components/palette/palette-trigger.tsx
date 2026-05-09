"use client";

import { SearchIcon } from "lucide-react";

import { GlassPanel } from "@/components/hud/glass-panel";
import { useVesselsStore } from "@/lib/vessels-store";

/**
 * Discoverability cue for the ⌘K palette. Glass capsule docked
 * top-left, immediately right of the SystemPill. Click is equivalent to
 * pressing ⌘K — both write through `setPaletteOpen` on the store.
 *
 * The macOS / non-macOS keybind hint is rendered without `navigator`
 * sniffing to keep SSR + first-paint deterministic; the visual is the
 * same on both platforms because Cmd+K and Ctrl+K both work.
 */
export function PaletteTrigger() {
  const setOpen = useVesselsStore((s) => s.setPaletteOpen);

  return (
    <div className="pointer-events-none absolute top-4 left-[260px] z-10">
      <GlassPanel variant="capsule" className="pointer-events-auto p-0!">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-full items-center gap-2 px-3 py-1.5 font-mono text-[11px] tracking-wide text-white/70 transition-colors hover:text-white/95"
          aria-label="Open vessel search palette"
        >
          <SearchIcon className="size-3 opacity-60" aria-hidden />
          <span className="text-white/55">Search</span>
          <kbd className="ml-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] tracking-wider text-white/55">
            ⌘K
          </kbd>
        </button>
      </GlassPanel>
    </div>
  );
}
