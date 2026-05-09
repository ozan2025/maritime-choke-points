import "server-only";

import { getDb, vesselPositionsRecent, vessels } from "@maritime/db";
import { and, exists, gte, ilike, like, or, sql, type SQL } from "drizzle-orm";

/**
 * Single result row returned by `searchVessels`. The shape is the wire
 * shape too — the route handler returns these as JSON unchanged.
 */
export interface VesselSearchResult {
  mmsi: number;
  shipName: string | null;
  shipType: number | null;
  flagState: string | null;
}

export interface SearchPredicates {
  /** Numeric MMSI prefix when `q` is all digits, e.g. "525". */
  mmsiPrefix: string | null;
  /** Case-insensitive substring on `vessels.ship_name`, e.g. "%KAHALA%". */
  namePattern: string | null;
  /**
   * MMSI 3-digit prefixes derived from `flagsContaining(q)` — e.g. for
   * "Singapore" this is ["563", "564", "565", "566"]. The route handler
   * builds these via `mid.ts` so the query module stays decoupled from
   * the MID lookup.
   */
  mmsiPrefixesFromMid: string[];
}

const RECENT_WINDOW_HOURS = 48;

/**
 * Server-only: vessel search for the ⌘K palette. Combines MMSI prefix,
 * ship-name ILIKE, and flag-derived MMSI-prefix predicates with `or`,
 * then narrows to vessels observed in the last 48 h via an `EXISTS`
 * subquery against `vessel_positions_recent`. Hits the recent table's
 * `(mmsi, observed_at)` index.
 *
 * Empty predicate sets short-circuit to `[]` to avoid a full-table scan
 * on `vessels` when the route handler couldn't extract anything useful.
 */
export async function searchVessels(
  preds: SearchPredicates,
  limit: number,
): Promise<VesselSearchResult[]> {
  const ors: SQL[] = [];
  if (preds.mmsiPrefix !== null) {
    ors.push(like(sql<string>`${vessels.mmsi}::text`, `${preds.mmsiPrefix}%`));
  }
  if (preds.namePattern !== null) {
    ors.push(ilike(vessels.shipName, preds.namePattern));
  }
  if (preds.mmsiPrefixesFromMid.length > 0) {
    // Map "525" → bounds [525_000_000, 526_000_000) so the predicate uses
    // integer ranges (index-friendly) rather than a text cast per prefix.
    // OR all bucket ranges together.
    const ranges: SQL[] = preds.mmsiPrefixesFromMid.map((p) => {
      const lo = Number(p) * 1_000_000;
      const hi = lo + 1_000_000;
      return and(gte(vessels.mmsi, lo), sql`${vessels.mmsi} < ${hi}`)!;
    });
    ors.push(or(...ranges)!);
  }

  if (ors.length === 0) return [];

  const db = getDb();
  const rows = await db
    .select({
      mmsi: vessels.mmsi,
      shipName: vessels.shipName,
      shipType: vessels.shipType,
      flagState: vessels.flagState,
    })
    .from(vessels)
    .where(
      and(
        or(...ors)!,
        exists(
          db
            .select({ one: sql`1` })
            .from(vesselPositionsRecent)
            .where(
              and(
                sql`${vesselPositionsRecent.mmsi} = ${vessels.mmsi}`,
                gte(
                  vesselPositionsRecent.observedAt,
                  sql`now() - interval '${sql.raw(String(RECENT_WINDOW_HOURS))} hours'`,
                ),
              ),
            ),
        ),
      ),
    )
    // Order by name (nulls last so MMSI-only rows don't crowd the top),
    // then by mmsi for deterministic tie-breaks.
    .orderBy(sql`${vessels.shipName} asc nulls last`, vessels.mmsi)
    .limit(limit);

  return rows;
}
