"use client";

import type { VesselPositionEvent } from "@maritime/shared";

import { navStatusLabel, shipTypeLabel } from "@/lib/ais/enums";
import { useVesselsStore } from "@/lib/vessels-store";

import { DataRow } from "./data-row";

const PLACEHOLDER = "—";

// AIS sentinel collisions: PositionReport carries Sog 102.3 kn and Cog 360°
// when "unknown" — the worker passes the sentinels through unchanged
// (apps/worker/src/sources/aisstream.ts, locked policy from #21). Render
// them as PLACEHOLDER instead of leaking the sentinel value to the user.
const SOG_UNKNOWN = 102.3;
const COG_UNKNOWN = 360;
const HEADING_UNKNOWN = 511;

/**
 * Subscribes to the Zustand store keyed by MMSI and renders the live
 * position fields. The selector returns the per-MMSI VesselPositionEvent
 * directly, so this component re-renders only when *that* vessel's row
 * changes — other vessels' position ticks don't trigger re-renders here.
 */
export function VesselLivePanel({ mmsi }: { mmsi: number }) {
  const event = useVesselsStore((state) => state.vessels.get(mmsi));

  if (!event) {
    return (
      <section aria-labelledby="live-heading" className="px-4 pt-4 pb-2">
        <h3 id="live-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase">
          Live
        </h3>
        <p className="rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No live position in the current window. The vessel may have left the subscribed bounding
          box; reopen this Sheet after a fresh PositionReport.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="live-heading" className="px-4 pt-4 pb-2">
      <h3 id="live-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase">
        Live
      </h3>
      <dl className="space-y-0">
        <DataRow label="Latitude" value={`${event.lat.toFixed(5)}°`} />
        <DataRow label="Longitude" value={`${event.lon.toFixed(5)}°`} />
        <DataRow label="Speed" value={formatSog(event.sog)} />
        <DataRow label="Course" value={formatDegrees(event.cog, COG_UNKNOWN)} />
        <DataRow label="Heading" value={formatDegrees(event.trueHeading, HEADING_UNKNOWN)} />
        <DataRow label="Nav status" value={navStatusLabel(event.navigationalStatus)} mono={false} />
        <DataRow label="Type (live)" value={shipTypeLabel(event.shipType)} mono={false} />
        <DataRow label="Region" value={event.region} mono={false} />
        <DataRow label="Last seen" value={formatObservedAt(event.observedAt)} />
      </dl>
    </section>
  );
}

function formatSog(sog: number | undefined): string {
  if (sog === undefined || sog === SOG_UNKNOWN) return PLACEHOLDER;
  return `${sog.toFixed(1)} kn`;
}

function formatDegrees(value: number | undefined, sentinel: number): string {
  if (value === undefined || value === sentinel) return PLACEHOLDER;
  return `${value.toFixed(1)}°`;
}

function formatObservedAt(observedAt: VesselPositionEvent["observedAt"]): string {
  const d = new Date(observedAt);
  if (Number.isNaN(d.getTime())) return PLACEHOLDER;
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}
