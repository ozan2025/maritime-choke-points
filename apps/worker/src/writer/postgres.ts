import {
  schema,
  vesselPositionsHourly,
  vesselPositionsRecent,
  vessels,
  type NewVesselPositionRecent,
} from "@maritime/db";
import type { VesselPositionEvent } from "@maritime/shared";
import { lt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { VesselStaticUpdate } from "../sources/source.js";

export type WriterDb = NodePgDatabase<typeof schema>;

const HOUR_MS = 60 * 60 * 1000;
/** Offset into the hour at which the cron tick fires. Lets in-flight inserts
 *  from the prior hour drain before the aggregation reads. */
const TICK_OFFSET_MS = 30_000;
const TTL_HOURS = 48;

/**
 * Persists vessel observations into Postgres and runs the hourly aggregation
 * + 48 h TTL purge crons. The live WS fan-out path is unaffected — the writer
 * sits alongside `VesselServer.broadcast` and consumes the same events.
 *
 * Inserts are fire-and-forget at single-row granularity. At validated AIS
 * rates (~2 events/s) this is trivial for Postgres. Batching is deferred to
 * a follow-up if backpressure surfaces.
 */
export class PostgresWriter {
  private readonly db: WriterDb;
  private alignTimer: NodeJS.Timeout | null = null;
  private hourlyTimer: NodeJS.Timeout | null = null;

  constructor(db: WriterDb) {
    this.db = db;
  }

  start(): void {
    if (this.alignTimer || this.hourlyTimer) return;
    const delay = millisUntilNextTick();
    this.alignTimer = setTimeout(() => {
      this.alignTimer = null;
      void this.runHourlyTick();
      this.hourlyTimer = setInterval(() => void this.runHourlyTick(), HOUR_MS);
    }, delay);
    console.log(
      `[writer] started; first hourly tick in ${Math.round(delay / 1000)} s, then every ${HOUR_MS / 60000} min`,
    );
  }

  stop(): void {
    if (this.alignTimer) {
      clearTimeout(this.alignTimer);
      this.alignTimer = null;
    }
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
      this.hourlyTimer = null;
    }
  }

  recordPosition(event: VesselPositionEvent): void {
    const row: NewVesselPositionRecent = {
      mmsi: event.mmsi,
      observedAt: new Date(event.observedAt),
      latitude: event.lat,
      longitude: event.lon,
      sog: event.sog,
      cog: event.cog,
      trueHeading: event.trueHeading ?? null,
      navigationalStatus: event.navigationalStatus ?? null,
      region: event.region,
      messageType: "PositionReport",
    };
    this.db
      .insert(vesselPositionsRecent)
      .values(row)
      .then(() => undefined)
      .catch((err: unknown) => {
        console.warn(`[writer] recordPosition failed for mmsi=${event.mmsi}:`, err);
      });
  }

  upsertVessel(update: VesselStaticUpdate): void {
    // coalesce(excluded.X, vessels.X) keeps the prior value when the latest
    // broadcast omits a field — partial ShipStaticData broadcasts are common,
    // and we don't want a sparse re-broadcast to clobber a richer earlier one.
    this.db
      .insert(vessels)
      .values({
        mmsi: update.mmsi,
        imo: update.imo ?? null,
        shipName: update.shipName ?? null,
        callSign: update.callSign ?? null,
        shipType: update.shipType ?? null,
        flagState: null,
        lengthM: update.lengthM ?? null,
        widthM: update.widthM ?? null,
        draftM: update.draftM ?? null,
        destination: update.destination ?? null,
        updatedAt: new Date(update.observedAt),
      })
      .onConflictDoUpdate({
        target: vessels.mmsi,
        set: {
          imo: sql`coalesce(excluded.imo, ${vessels.imo})`,
          shipName: sql`coalesce(excluded.ship_name, ${vessels.shipName})`,
          callSign: sql`coalesce(excluded.call_sign, ${vessels.callSign})`,
          shipType: sql`coalesce(excluded.ship_type, ${vessels.shipType})`,
          lengthM: sql`coalesce(excluded.length_m, ${vessels.lengthM})`,
          widthM: sql`coalesce(excluded.width_m, ${vessels.widthM})`,
          draftM: sql`coalesce(excluded.draft_m, ${vessels.draftM})`,
          destination: sql`coalesce(excluded.destination, ${vessels.destination})`,
          updatedAt: sql`now()`,
        },
      })
      .then(() => undefined)
      .catch((err: unknown) => {
        console.warn(`[writer] upsertVessel failed for mmsi=${update.mmsi}:`, err);
      });
  }

  /**
   * Materialize the last completed hour into `vessel_positions_hourly`. One
   * representative position per `(mmsi, region)` per hour — we pick the
   * latest observation in the bucket via `DISTINCT ON`. Conflicts are
   * ignored so a re-run of the same hour is idempotent.
   */
  async aggregateHourly(prevHour: Date): Promise<number> {
    const nextHour = new Date(prevHour.getTime() + HOUR_MS);
    const result = await this.db.execute(sql`
      INSERT INTO ${vesselPositionsHourly} (
        mmsi, region, hour, latitude, longitude, sog, cog, ship_type, ship_name, flag_state
      )
      SELECT DISTINCT ON (r.mmsi, r.region)
        r.mmsi,
        r.region,
        date_trunc('hour', r.observed_at),
        r.latitude,
        r.longitude,
        r.sog,
        r.cog,
        v.ship_type,
        v.ship_name,
        v.flag_state
      FROM ${vesselPositionsRecent} r
      LEFT JOIN ${vessels} v ON v.mmsi = r.mmsi
      WHERE r.observed_at >= ${prevHour}
        AND r.observed_at <  ${nextHour}
      ORDER BY r.mmsi, r.region, r.observed_at DESC
      ON CONFLICT (mmsi, region, hour) DO NOTHING
    `);
    return result.rowCount ?? 0;
  }

  async purgeOldRecent(cutoff: Date): Promise<number> {
    const result = await this.db
      .delete(vesselPositionsRecent)
      .where(lt(vesselPositionsRecent.observedAt, cutoff));
    return result.rowCount ?? 0;
  }

  private async runHourlyTick(): Promise<void> {
    const now = new Date();
    const thisHour = floorToHour(now);
    const prevHour = new Date(thisHour.getTime() - HOUR_MS);
    const ttlCutoff = new Date(now.getTime() - TTL_HOURS * HOUR_MS);
    try {
      const aggregated = await this.aggregateHourly(prevHour);
      const purged = await this.purgeOldRecent(ttlCutoff);
      console.log(
        `[writer] tick ${thisHour.toISOString()}: aggregated ${aggregated} into _hourly for ${prevHour.toISOString()}, purged ${purged} from _recent older than ${ttlCutoff.toISOString()}`,
      );
    } catch (err) {
      console.warn("[writer] hourly tick failed:", err);
    }
  }
}

function floorToHour(d: Date): Date {
  const out = new Date(d);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

function millisUntilNextTick(): number {
  const now = Date.now();
  const nextHour = floorToHour(new Date(now)).getTime() + HOUR_MS;
  return nextHour + TICK_OFFSET_MS - now;
}
