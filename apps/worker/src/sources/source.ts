import type { RegionId, VesselPositionEvent } from "@maritime/shared";

export type VesselUpdateHandler = (event: VesselPositionEvent) => void;

/**
 * Worker-internal static-data event. Emitted by sources whenever fresh
 * `ShipStaticData` is observed. Not on the wire — `@maritime/shared` only
 * carries position events. Consumed by the Postgres writer to upsert into
 * the `vessels` slowly-changing dimension.
 */
export interface VesselStaticUpdate {
  mmsi: number;
  imo?: number;
  shipName?: string;
  callSign?: string;
  shipType?: number;
  /** Length overall, meters (Dimension.A + Dimension.B). */
  lengthM?: number;
  /** Beam, meters (Dimension.C + Dimension.D). */
  widthM?: number;
  /** Maximum static draught, meters. */
  draftM?: number;
  destination?: string;
  /** ISO-8601 UTC timestamp at which the worker observed this update. */
  observedAt: string;
}

export type VesselStaticHandler = (update: VesselStaticUpdate) => void;

export interface VesselSourceHandlers {
  onPosition: VesselUpdateHandler;
  /** Optional. When omitted (e.g. the synthetic source), the source has no
   *  static-data channel to emit on. */
  onStatic?: VesselStaticHandler;
}

/**
 * A pull-and-push interface over a stream of vessel positions. Implementations
 * own the lifecycle of the underlying upstream (synthetic timer in M2,
 * AISStream WebSocket in M3) and notify the server through the handlers bag
 * whenever a new position or static-data update is observed.
 *
 * The server stays source-agnostic so the M3 swap from synthetic to AISStream
 * does not touch subscription routing or fan-out logic.
 */
export interface VesselSource {
  start(handlers: VesselSourceHandlers): void;
  stop(): void;
  /** Latest known position for every vessel currently tracked in the given regions. */
  snapshot(regions: readonly RegionId[]): VesselPositionEvent[];
}
