import "server-only";

import { getDb, vesselPositionsRecent } from "@maritime/db";
import type { RegionId } from "@maritime/shared";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export interface HistoryRow {
  mmsi: number;
  lat: number;
  lon: number;
  observedAt: Date;
}

/**
 * Server-only: range scan over `vessel_positions_recent` for one region
 * and a `[windowStart, windowEnd]` interval. Returns rows ordered by
 * (mmsi, observedAt) so the client can group into per-vessel paths in a
 * single linear pass. Hits
 * `vessel_positions_recent_region_observed_at_idx`.
 */
export async function getPositionHistory(
  region: RegionId,
  windowStart: Date,
  windowEnd: Date,
): Promise<HistoryRow[]> {
  const db = getDb();
  return db
    .select({
      mmsi: vesselPositionsRecent.mmsi,
      lat: vesselPositionsRecent.latitude,
      lon: vesselPositionsRecent.longitude,
      observedAt: vesselPositionsRecent.observedAt,
    })
    .from(vesselPositionsRecent)
    .where(
      and(
        eq(vesselPositionsRecent.region, region),
        gte(vesselPositionsRecent.observedAt, windowStart),
        lte(vesselPositionsRecent.observedAt, windowEnd),
      ),
    )
    .orderBy(asc(vesselPositionsRecent.mmsi), asc(vesselPositionsRecent.observedAt));
}
