import type { RegionId } from "./regions.js";

export interface VesselPositionEvent {
  mmsi: number;
  lat: number;
  lon: number;
  /** Speed over ground, in knots. */
  sog: number;
  /** Course over ground, in degrees [0, 360). */
  cog: number;
  /** True heading, in degrees [0, 360). */
  trueHeading?: number;
  /** AIS navigational status enum. */
  navigationalStatus?: number;
  /** AIS ship-type code; denormalized into the wire so consumers can render
   * type-specific icons without joining against a static-data table. */
  shipType?: number;
  region: RegionId;
  /** ISO-8601 UTC timestamp of the observation. */
  observedAt: string;
}

export interface SubscribeMessage {
  type: "subscribe";
  regions: RegionId[];
}

export type ClientMessage = SubscribeMessage;

export interface SnapshotMessage {
  type: "snapshot";
  /** The regions this snapshot covers — equal to the active subscription
   * at the moment the server replied. Lets the client drop stale state
   * for regions it just unsubscribed from without tracking sends. */
  regions: RegionId[];
  vessels: VesselPositionEvent[];
}

export interface PositionMessage {
  type: "position";
  event: VesselPositionEvent;
}

export interface ErrorMessage {
  type: "error";
  /** Stable machine-readable code: `"invalid_json"`, `"unknown_message_type"`, … */
  code: string;
  /** Human-readable detail intended for client logs, not end users. */
  message: string;
}

export type ServerMessage = SnapshotMessage | PositionMessage | ErrorMessage;

// ---------------------------------------------------------------------
// History HTTP wire (M4 #27)
//
// These describe the JSON shape of `GET /api/positions/history`. The
// route is a Next.js Route Handler, not the worker WebSocket — so this
// is a *separate* contract from the ServerMessage envelope above. Lives
// here so the route handler, the client fetch hook, and the trip-grouping
// helpers all share one source of truth instead of three hand-aligned
// declarations.
// ---------------------------------------------------------------------

/** A single observation as transmitted on the history wire. `t` is unix
 * epoch seconds; the conversion from `observed_at: timestamptz` happens
 * at the route boundary so the client can feed deck.gl directly. */
export interface HistoryRow {
  mmsi: number;
  lat: number;
  lon: number;
  t: number;
}

/** Envelope returned by `GET /api/positions/history`. */
export interface HistoryResponseBody {
  region: RegionId;
  /** ISO-8601 UTC. */
  windowStart: string;
  /** ISO-8601 UTC; equal to the `bucket` request param when supplied. */
  windowEnd: string;
  rows: HistoryRow[];
}
