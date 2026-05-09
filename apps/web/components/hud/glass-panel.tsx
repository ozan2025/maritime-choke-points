"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "capsule" | "card" | "tile";

interface GlassPanelProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

const VARIANT_BASE: Record<Variant, string> = {
  capsule: "rounded-full px-4 py-2",
  card: "rounded-xl px-4 py-3",
  tile: "rounded-lg px-3 py-2.5",
};

/**
 * Centralized glassmorphism shell used across the HUD. Backdrop blur
 * runs over the dark Mapbox basemap; saturation bump adds a hint of
 * depth without color-shifting the underlying satellite imagery.
 *
 * Inset top hairline (`inset-shadow`) gives the "etched glass" edge —
 * subtle, but it's the difference between "div with blur" and "designed
 * surface."
 */
export function GlassPanel({ variant = "card", className, children }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "border border-white/[0.06] bg-[rgba(8,12,22,0.55)]",
        "backdrop-blur-md backdrop-saturate-150",
        "shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]",
        VARIANT_BASE[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
