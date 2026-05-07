import { REGIONS, type RegionId, type VesselPositionEvent } from "@maritime/shared";
import type { VesselSource, VesselUpdateHandler } from "./source.js";

const TICK_INTERVAL_MS = 1000;

/**
 * Per-vessel broadcast cadence. The simulator advances all vessels every
 * tick, but each vessel only emits a position every Nth tick. With Nth = 3
 * and a 1 s tick this matches the AIS PositionReport cadence (2–10 s when
 * moving) and yields ~30 events/s over the wire at the M2 seed counts.
 */
const BROADCAST_EVERY_N_TICKS = 3;

/**
 * Seed counts that mirror the real-world AIS sparsity validated 2026-05-06
 * (PRD §2). Hormuz is closed; Bab el-Mandeb is AIS-dark; Suez is sparse;
 * Malacca/Singapore is the protagonist.
 */
const SEED_COUNTS: Readonly<Record<RegionId, number>> = {
  malaccaSingapore: 80,
  suez: 6,
  hormuzApproaches: 0,
  babElMandeb: 0,
};

/** Representative spread of AIS ship-type codes (ITU-R M.1371): 70 cargo,
 *  80 tanker, 60 passenger, 30 fishing. Used by the M4 icon-silhouette work. */
const SHIP_TYPES: readonly number[] = [70, 70, 70, 80, 80, 60, 30];

interface SyntheticVessel {
  mmsi: number;
  region: RegionId;
  shipType: number;
  lat: number;
  lon: number;
  /** Course over ground / heading, degrees [0, 360). */
  cog: number;
  /** Speed over ground, knots. */
  sog: number;
  /** Tick offset that controls when this vessel broadcasts within the cycle. */
  phase: number;
}

export interface SyntheticSourceOptions {
  /** Override seed counts — useful for tests. Defaults to {@link SEED_COUNTS}. */
  seedCounts?: Partial<Record<RegionId, number>>;
  /** Deterministic PRNG, mainly for tests. Defaults to `Math.random`. */
  random?: () => number;
}

export class SyntheticSource implements VesselSource {
  private readonly vessels: SyntheticVessel[] = [];
  private readonly random: () => number;
  private timer: NodeJS.Timeout | undefined;
  private tickIndex = 0;
  private observedAt = new Date().toISOString();

  constructor(options: SyntheticSourceOptions = {}) {
    this.random = options.random ?? Math.random;
    const counts = { ...SEED_COUNTS, ...options.seedCounts };
    let mmsi = 999_000_000;
    for (const region of Object.keys(counts) as RegionId[]) {
      const count = counts[region] ?? 0;
      for (let i = 0; i < count; i++) {
        this.vessels.push(this.spawnVessel(mmsi++, region, i));
      }
    }
  }

  start(onUpdate: VesselUpdateHandler): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(onUpdate), TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  snapshot(regions: readonly RegionId[]): VesselPositionEvent[] {
    const wanted = new Set(regions);
    return this.vessels.filter((v) => wanted.has(v.region)).map((v) => this.toEvent(v));
  }

  private tick(onUpdate: VesselUpdateHandler): void {
    this.tickIndex = (this.tickIndex + 1) % BROADCAST_EVERY_N_TICKS;
    this.observedAt = new Date().toISOString();
    for (const vessel of this.vessels) {
      this.advance(vessel);
      if (vessel.phase === this.tickIndex) {
        onUpdate(this.toEvent(vessel));
      }
    }
  }

  private spawnVessel(mmsi: number, region: RegionId, index: number): SyntheticVessel {
    const bbox = REGIONS[region];
    const lat = this.lerp(bbox.sw[0], bbox.ne[0], this.random());
    const lon = this.lerp(bbox.sw[1], bbox.ne[1], this.random());
    const cog = this.random() * 360;
    const sog = 6 + this.random() * 12;
    const shipType = SHIP_TYPES[index % SHIP_TYPES.length] ?? 70;
    return {
      mmsi,
      region,
      shipType,
      lat,
      lon,
      cog,
      sog,
      phase: index % BROADCAST_EVERY_N_TICKS,
    };
  }

  private advance(vessel: SyntheticVessel): void {
    const dtHours = TICK_INTERVAL_MS / 3_600_000;
    const distanceNm = vessel.sog * dtHours;
    const headingRad = (vessel.cog * Math.PI) / 180;
    const latRad = (vessel.lat * Math.PI) / 180;
    const dLat = (distanceNm * Math.cos(headingRad)) / 60;
    const dLon = (distanceNm * Math.sin(headingRad)) / (60 * Math.cos(latRad));

    let nextLat = vessel.lat + dLat;
    let nextLon = vessel.lon + dLon;
    let nextCog = vessel.cog;

    const bbox = REGIONS[vessel.region];
    // Heading is degrees clockwise from north, so dLat ∝ cos(h) and
    // dLon ∝ sin(h). Reflecting across the lat edge flips the cos term
    // (h' = 180 − h); reflecting across the lon edge flips the sin term
    // (h' = 360 − h).
    if (nextLat < bbox.sw[0] || nextLat > bbox.ne[0]) {
      nextLat = vessel.lat - dLat;
      nextCog = (180 - nextCog + 360) % 360;
    }
    if (nextLon < bbox.sw[1] || nextLon > bbox.ne[1]) {
      nextLon = vessel.lon - dLon;
      nextCog = (360 - nextCog + 360) % 360;
    }

    nextCog = (nextCog + (this.random() - 0.5) * 4 + 360) % 360;

    vessel.lat = nextLat;
    vessel.lon = nextLon;
    vessel.cog = nextCog;
  }

  private toEvent(vessel: SyntheticVessel): VesselPositionEvent {
    return {
      mmsi: vessel.mmsi,
      lat: vessel.lat,
      lon: vessel.lon,
      sog: vessel.sog,
      cog: vessel.cog,
      trueHeading: vessel.cog,
      shipType: vessel.shipType,
      region: vessel.region,
      observedAt: this.observedAt,
    };
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
