import {
  bigserial,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Hot tier: every observed AIS position. Auto-purged after 48 hours by the
 * worker (issue #8). Powers the live map and the 1-hour timeline scrubber.
 */
export const vesselPositionsRecent = pgTable(
  "vessel_positions_recent",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    mmsi: integer("mmsi").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    sog: real("sog"),
    cog: real("cog"),
    trueHeading: real("true_heading"),
    navigationalStatus: smallint("navigational_status"),
    region: text("region").notNull(),
    messageType: text("message_type").notNull(),
  },
  (t) => [
    index("vessel_positions_recent_region_observed_at_idx").on(t.region, t.observedAt.desc()),
    index("vessel_positions_recent_mmsi_observed_at_idx").on(t.mmsi, t.observedAt.desc()),
  ],
);

/**
 * Warm tier: one representative position per vessel per region per hour.
 * Kept indefinitely. Powers historical animation and long-term trend analysis.
 */
export const vesselPositionsHourly = pgTable(
  "vessel_positions_hourly",
  {
    mmsi: integer("mmsi").notNull(),
    region: text("region").notNull(),
    hour: timestamp("hour", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    sog: real("sog"),
    cog: real("cog"),
    shipType: smallint("ship_type"),
    shipName: text("ship_name"),
    flagState: text("flag_state"),
  },
  (t) => [
    primaryKey({ columns: [t.mmsi, t.region, t.hour] }),
    index("vessel_positions_hourly_region_hour_idx").on(t.region, t.hour.desc()),
  ],
);

/**
 * Slowly-changing dimension: one row per MMSI we have ever seen, holding the
 * latest known static data. Updated whenever a fresher ShipStaticData arrives.
 */
export const vessels = pgTable("vessels", {
  mmsi: integer("mmsi").primaryKey(),
  imo: integer("imo"),
  shipName: text("ship_name"),
  callSign: text("call_sign"),
  shipType: smallint("ship_type"),
  flagState: text("flag_state"),
  lengthM: real("length_m"),
  widthM: real("width_m"),
  draftM: real("draft_m"),
  destination: text("destination"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
