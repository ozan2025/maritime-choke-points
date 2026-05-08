/**
 * Pure helpers for the timeline scrubber + TripsLayer pipeline. No React,
 * no Drizzle, no fetch — keeps this module trivially unit-testable and
 * reusable across the live-mode and scrubbed-mode code paths.
 */

export interface HistoryRow {
  mmsi: number;
  lat: number;
  lon: number;
  /** Unix epoch seconds. Wire-format already converted in the route. */
  t: number;
}

export interface Trip {
  mmsi: number;
  /** [longitude, latitude] in deck.gl convention. */
  path: [number, number][];
  /** Unix epoch seconds, parallel to `path`. */
  timestamps: number[];
}

export interface Head {
  mmsi: number;
  lon: number;
  lat: number;
}

/**
 * Group a flat row set ordered by (mmsi, t) into per-vessel trips. Single
 * linear pass — relies on the SQL ORDER BY for grouping rather than a
 * `Map<mmsi, Trip>` build, which keeps allocations down on the
 * thousands-of-rows path.
 */
export function groupRowsIntoTrips(rows: readonly HistoryRow[]): Trip[] {
  const trips: Trip[] = [];
  let current: Trip | null = null;
  for (const row of rows) {
    if (current === null || current.mmsi !== row.mmsi) {
      current = { mmsi: row.mmsi, path: [], timestamps: [] };
      trips.push(current);
    }
    current.path.push([row.lon, row.lat]);
    current.timestamps.push(row.t);
  }
  return trips;
}

/**
 * For each trip, return the vessel's interpolated position at `tSec`.
 *
 * - If `tSec` precedes the first observation, the vessel hadn't broadcast
 *   yet in this window — skip it.
 * - If `tSec` is at or after the last observation, return the last known
 *   position (vessel was last seen before t; assume static head).
 * - Otherwise binary-search for the bracketing pair and linearly
 *   interpolate (lon, lat). AIS gaps are typically ~2 min between
 *   PositionReports for a moving vessel; linear interp is smoother than
 *   nearest-neighbor and good enough for visual rendering at this
 *   cadence. (If the line bends sharply within a 2-min gap we'd need
 *   either denser data or great-circle interp — neither is in scope.)
 */
export function interpolateHeadsAtTime(trips: readonly Trip[], tSec: number): Head[] {
  const heads: Head[] = [];
  for (const trip of trips) {
    const ts = trip.timestamps;
    const len = ts.length;
    if (len === 0) continue;
    const first = ts[0];
    const last = ts[len - 1];
    if (first === undefined || last === undefined) continue;
    if (tSec < first) continue;

    if (tSec >= last) {
      const point = trip.path[len - 1];
      if (!point) continue;
      heads.push({ mmsi: trip.mmsi, lon: point[0], lat: point[1] });
      continue;
    }

    // Largest i such that ts[i] <= tSec. We've already ruled out the
    // edges, so 0 <= i < len - 1 and ts[i+1] is well-defined.
    let lo = 0;
    let hi = len - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      const v = ts[mid];
      if (v !== undefined && v <= tSec) lo = mid;
      else hi = mid;
    }
    const i0 = lo;
    const i1 = lo + 1;
    const t0 = ts[i0];
    const t1 = ts[i1];
    const p0 = trip.path[i0];
    const p1 = trip.path[i1];
    if (t0 === undefined || t1 === undefined || !p0 || !p1) continue;
    const span = t1 - t0;
    const u = span <= 0 ? 0 : (tSec - t0) / span;
    heads.push({
      mmsi: trip.mmsi,
      lon: p0[0] + (p1[0] - p0[0]) * u,
      lat: p0[1] + (p1[1] - p0[1]) * u,
    });
  }
  return heads;
}

/**
 * Round `date` down to the nearest `bucketSec`-second boundary. Used as
 * the cache key for history fetches: identical bucket → identical URL →
 * browser HTTP cache hit.
 */
export function bucketRound(date: Date, bucketSec: number): Date {
  const bucketMs = bucketSec * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}
