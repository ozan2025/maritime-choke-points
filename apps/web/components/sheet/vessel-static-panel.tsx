import { mmsiToFlag } from "@/lib/ais/mid";
import { shipTypeLabel } from "@/lib/ais/enums";
import { getVesselByMmsi } from "@/lib/queries/vessel";

import { DataRow } from "./data-row";

const PLACEHOLDER = "—";

/**
 * Server Component rendered inside the Sheet's `<Suspense>` slot. Queries
 * the `vessels` SCD by MMSI and renders the static identifiers. When no
 * row exists yet (vessel observed via PositionReport before its first
 * ShipStaticData, ~6 min cadence), renders a placeholder note instead.
 */
export default async function VesselStaticPanel({ mmsi }: { mmsi: number }) {
  const vessel = await getVesselByMmsi(mmsi);
  const flag = mmsiToFlag(mmsi);

  if (!vessel) {
    return (
      <section aria-labelledby="static-heading" className="px-4 pt-1 pb-4">
        <h3
          id="static-heading"
          className="mb-2 text-xs font-medium text-muted-foreground uppercase"
        >
          Vessel
        </h3>
        <dl className="space-y-0">
          <DataRow label="Name" value={PLACEHOLDER} />
          <DataRow label="IMO" value={PLACEHOLDER} />
          <DataRow label="Flag" value={flag ?? PLACEHOLDER} mono={false} />
          <DataRow label="Type" value={PLACEHOLDER} mono={false} />
          <DataRow label="Length × Width" value={PLACEHOLDER} />
          <DataRow label="Draft" value={PLACEHOLDER} />
          <DataRow label="Destination" value={PLACEHOLDER} mono={false} />
        </dl>
        <p className="mt-3 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Static data not yet received. AIS broadcasts ShipStaticData every ~6 minutes; flag is
          derived from the MMSI prefix and is shown above when known.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="static-heading" className="px-4 pt-1 pb-4">
      <h3 id="static-heading" className="mb-2 text-xs font-medium text-muted-foreground uppercase">
        Vessel
      </h3>
      <dl className="space-y-0">
        <DataRow label="Name" value={vessel.shipName ?? PLACEHOLDER} mono={false} />
        <DataRow label="IMO" value={vessel.imo ?? PLACEHOLDER} />
        <DataRow label="Call sign" value={vessel.callSign ?? PLACEHOLDER} />
        <DataRow label="Flag" value={flag ?? PLACEHOLDER} mono={false} />
        <DataRow label="Type" value={shipTypeLabel(vessel.shipType)} mono={false} />
        <DataRow label="Length × Width" value={formatLxW(vessel.lengthM, vessel.widthM)} />
        <DataRow
          label="Draft"
          value={vessel.draftM != null ? `${vessel.draftM.toFixed(1)} m` : PLACEHOLDER}
        />
        <DataRow label="Destination" value={vessel.destination ?? PLACEHOLDER} mono={false} />
        <DataRow label="Static updated" value={formatTimestamp(vessel.updatedAt)} />
      </dl>
    </section>
  );
}

function formatLxW(lengthM: number | null, widthM: number | null): string {
  if (lengthM == null && widthM == null) return PLACEHOLDER;
  const l = lengthM != null ? `${lengthM.toFixed(0)} m` : "—";
  const w = widthM != null ? `${widthM.toFixed(0)} m` : "—";
  return `${l} × ${w}`;
}

function formatTimestamp(ts: Date | string | null): string {
  if (ts == null) return PLACEHOLDER;
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return PLACEHOLDER;
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z");
}
