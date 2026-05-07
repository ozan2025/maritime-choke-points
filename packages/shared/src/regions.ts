export type RegionId = "malaccaSingapore" | "hormuzApproaches" | "babElMandeb" | "suez";

export const REGION_IDS: readonly RegionId[] = [
  "malaccaSingapore",
  "hormuzApproaches",
  "babElMandeb",
  "suez",
] as const;

export interface RegionBbox {
  /** Southwest corner as [latitude, longitude]. */
  sw: readonly [number, number];
  /** Northeast corner as [latitude, longitude]. */
  ne: readonly [number, number];
}

export const REGIONS: Readonly<Record<RegionId, RegionBbox>> = {
  malaccaSingapore: { sw: [1.0, 100.5], ne: [6.0, 105.0] },
  hormuzApproaches: { sw: [22.0, 50.0], ne: [28.0, 60.0] },
  babElMandeb: { sw: [11.5, 42.5], ne: [14.0, 44.5] },
  suez: { sw: [29.5, 32.0], ne: [31.7, 33.0] },
};

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}
