import "server-only";

import { getDb, vessels, type Vessel } from "@maritime/db";
import { eq } from "drizzle-orm";

/**
 * Server-only: fetch the latest known static row for a vessel by MMSI.
 * Returns null when the vessel has been observed via PositionReport but
 * has not yet broadcast a ShipStaticData (~6 min cadence). The Sheet's
 * static slot renders a placeholder in that case.
 */
export async function getVesselByMmsi(mmsi: number): Promise<Vessel | null> {
  const db = getDb();
  const row = await db.query.vessels.findFirst({ where: eq(vessels.mmsi, mmsi) });
  return row ?? null;
}
