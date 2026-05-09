export type RegionId =
  | "malaccaSingapore"
  | "hormuzApproaches"
  | "babElMandeb"
  | "suez"
  | "bosphorus"
  | "panama";

export const REGION_IDS: readonly RegionId[] = [
  "malaccaSingapore",
  "hormuzApproaches",
  "babElMandeb",
  "suez",
  "bosphorus",
  "panama",
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
  // Stretch regions added in M5 #38 — both have strong terrestrial AIS
  // coverage so the live counters fill quickly. Bboxes match PRD §8.
  bosphorus: { sw: [40.9, 28.8], ne: [41.3, 29.3] },
  panama: { sw: [8.8, -80.0], ne: [9.5, -79.4] },
};

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === "string" && (REGION_IDS as readonly string[]).includes(value);
}
