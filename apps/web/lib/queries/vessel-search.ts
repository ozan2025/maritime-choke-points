import "server-only";

import { getDb, vesselPositionsRecent, vessels } from "@maritime/db";
import { and, exists, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";

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
  /** Numeric MMSI prefix when `q` is all digits, e.g. "525". Length is
   *  whatever the user typed; the query expands it to an integer-range
   *  predicate so the PK B-tree can serve it (no `mmsi::text LIKE`). */
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

/**
 * MMSI is canonically a 9-digit identifier. Treating it as such lets a
 * shorter prefix `p` of length `n` cover all integers in
 * `[p * 10^(9-n), (p+1) * 10^(9-n))`, which is index-friendly against
 * the `vessels.mmsi` PK. Used for both the user-typed numeric prefix
 * and the MID-derived flag prefixes (which are always length 3).
 */
const MMSI_DIGITS = 9;

function prefixToIntegerRange(prefix: string): SQL {
  const n = prefix.length;
  const span = 10 ** (MMSI_DIGITS - n);
  const lo = Number(prefix) * span;
  const hi = lo + span;
  return and(gte(vessels.mmsi, lo), lt(vessels.mmsi, hi))!;
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
    ors.push(prefixToIntegerRange(preds.mmsiPrefix));
  }
  if (preds.namePattern !== null) {
    ors.push(ilike(vessels.shipName, preds.namePattern));
  }
  if (preds.mmsiPrefixesFromMid.length > 0) {
    ors.push(or(...preds.mmsiPrefixesFromMid.map(prefixToIntegerRange))!);
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
                // `RECENT_WINDOW_HOURS` is a module-private compile-time
                // constant, never user input — the literal embedded in
                // the SQL template is the simplest typed form. If the
                // window ever becomes runtime-driven, swap to
                // `make_interval(hours => ${RECENT_WINDOW_HOURS})`.
                gte(vesselPositionsRecent.observedAt, sql`now() - interval '48 hours'`),
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

/** Re-exported so the constant remains visible to anyone reading the
 *  module (the value is also documented in the route handler comment). */
export { RECENT_WINDOW_HOURS };
