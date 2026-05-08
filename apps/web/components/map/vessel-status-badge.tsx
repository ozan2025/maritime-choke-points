"use client";

import { useShallow } from "zustand/react/shallow";

import { useVesselsStore } from "@/lib/vessels-store";

/**
 * Diagnostic badge for the M2 demo — confirms the worker pipe is alive.
 * Full HUD chrome is M4 #11; this is intentionally minimal.
 */
export default function VesselStatusBadge() {
  const { count, status } = useVesselsStore(
    useShallow((state) => ({
      count: state.vessels.size,
      status: state.connectionStatus,
    })),
  );

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-10 rounded-md bg-black/70 px-3 py-1.5 font-mono text-xs text-white tabular-nums backdrop-blur-sm">
      {count} vessels · {status}
    </div>
  );
}
