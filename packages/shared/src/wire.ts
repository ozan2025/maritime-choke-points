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

export type ServerMessage = SnapshotMessage | PositionMessage;
