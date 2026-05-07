import type { RegionId, VesselPositionEvent } from "@maritime/shared";

export type VesselUpdateHandler = (event: VesselPositionEvent) => void;

/**
 * A pull-and-push interface over a stream of vessel positions. Implementations
 * own the lifecycle of the underlying upstream (synthetic timer in M2,
 * AISStream WebSocket in M3) and notify the server through `onUpdate` whenever
 * a new position is observed.
 *
 * The server stays source-agnostic so the M3 swap from synthetic to AISStream
 * does not touch subscription routing or fan-out logic.
 */
export interface VesselSource {
  start(onUpdate: VesselUpdateHandler): void;
  stop(): void;
  /** Latest known position for every vessel currently tracked in the given regions. */
  snapshot(regions: readonly RegionId[]): VesselPositionEvent[];
}
