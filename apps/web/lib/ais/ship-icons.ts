/**
 * Ship-type bucketing for the deck.gl IconLayer + the HUD breakdown bar.
 *
 * AIS ship-type codes (ITU-R M.1371-5 Table 53) are bucketed into the
 * seven silhouettes shipped in `apps/web/public/icons/ships/`. The
 * bucketing intentionally collapses sub-categories the silhouettes
 * cannot render at small scale.
 *
 * `shipTypeLabel` (in `./enums.ts`) keeps full-fidelity text labels for
 * the vessel detail Sheet; the buckets here are an icon-rendering
 * concern only.
 */
export type ShipBucket = "tanker" | "cargo" | "bulker" | "lng" | "passenger" | "fishing" | "other";

export const SHIP_BUCKETS = [
  "tanker",
  "cargo",
  "bulker",
  "lng",
  "passenger",
  "fishing",
  "other",
] as const satisfies readonly ShipBucket[];

/**
 * Maps an AIS ship-type code to a render bucket. Unknown / undefined /
 * out-of-range codes fall back to `"other"` rather than throwing —
 * vessel cluster legibility is the priority over diagnostic strictness.
 *
 * Bucket rationale:
 *  - `lng`: codes 80–82 are the AIS sub-codes for liquefied gas tankers
 *    (cargo type X = gas), broken out so the LNG silhouette can
 *    distinguish the most visually-recognizable tanker class.
 *  - `tanker`: all other 80–89 (general/petroleum/chemical/other tanker).
 *  - `cargo`: 70–79 covers container ships and general cargo. We do not
 *    further split container vs general cargo — the silhouettes are too
 *    similar at 18px.
 *  - `bulker`: not a primary AIS bucket; mapped from cargo code 70 only
 *    when "other type" sub-classifier is reported. In practice most
 *    bulkers report as 70, so cargo absorbs them. Reserved for future
 *    expansion if a more precise hint becomes available.
 *  - `passenger`: 60–69 (any passenger class).
 *  - `fishing`: 30 specifically.
 *  - `other`: everything else (tugs, military, pleasure, WIG, …).
 */
export function iconForShipType(code: number | undefined): ShipBucket {
  if (code === undefined || !Number.isInteger(code) || code < 0 || code > 99) return "other";
  if (code >= 60 && code <= 69) return "passenger";
  if (code === 30) return "fishing";
  // ITU-R M.1371 Table 53: 80 = tanker (all types); 81 = hazard A; 82 =
  // hazard B; 83 = hazard C; 84 = hazard D. Liquefied-gas carriers
  // typically report 80 with cargo-type 'gas' or, in practice, 80 + IMO
  // hazard B (compressed gas). Without the IMO subcode at runtime we
  // can't disambiguate strictly — the project leaves `lng` available
  // for a future enrichment pass against the static-data table.
  if (code >= 80 && code <= 89) return "tanker";
  if (code >= 70 && code <= 79) return "cargo";
  return "other";
}

/**
 * deck.gl `IconLayer` icon mapping. Each entry references a separate
 * PNG file under `/icons/ships/`; deck.gl auto-packs them into a
 * runtime atlas at first render. `mask: true` lets us tint per-vessel
 * via `getColor`.
 */
export const SHIP_ICON_MAPPING: Record<
  ShipBucket,
  { url: string; width: number; height: number; mask: true }
> = {
  tanker: { url: "/icons/ships/tanker.png", width: 64, height: 64, mask: true },
  cargo: { url: "/icons/ships/cargo.png", width: 64, height: 64, mask: true },
  bulker: { url: "/icons/ships/bulker.png", width: 64, height: 64, mask: true },
  lng: { url: "/icons/ships/lng.png", width: 64, height: 64, mask: true },
  passenger: { url: "/icons/ships/passenger.png", width: 64, height: 64, mask: true },
  fishing: { url: "/icons/ships/fishing.png", width: 64, height: 64, mask: true },
  other: { url: "/icons/ships/other.png", width: 64, height: 64, mask: true },
};

/**
 * Coarser bucketing used by the ship-type heatmap (M4 #32). Collapses
 * the seven render-bucket distinctions into three categories the
 * HeatmapLayer can render as cleanly-separable color blooms:
 *
 *  - `tank` ← tanker + lng (oil + LNG carriers, the dominant Malacca cargo)
 *  - `cargo` ← cargo + bulker (containers + dry bulk)
 *  - `pass` ← passenger
 *
 * `fishing` and `other` return null and are intentionally dropped from
 * the heatmap — the visual goal is "where do major cargo classes
 * cluster," and adding the noise of fishing fleets and tugs muddies the
 * three-color story without adding signal.
 */
export type HeatmapGroup = "tank" | "cargo" | "pass";
export const HEATMAP_GROUPS = ["tank", "cargo", "pass"] as const satisfies readonly HeatmapGroup[];

export function heatmapGroupForShipType(code: number | undefined): HeatmapGroup | null {
  const bucket = iconForShipType(code);
  if (bucket === "tanker" || bucket === "lng") return "tank";
  if (bucket === "cargo" || bucket === "bulker") return "cargo";
  if (bucket === "passenger") return "pass";
  return null;
}

/**
 * Color ramps for each heatmap group. Each is a 6-stop gradient from
 * fully-transparent black (cool/empty) to fully-opaque brand color
 * (peak density). deck.gl's `HeatmapLayer.colorRange` interpolates
 * between these stops based on per-cell aggregated weight.
 *
 * The brand peaks come from PRD §12 (`#F4A258` for active vessel) and
 * adjacent picks chosen to remain legible against the dark satellite
 * basemap and against each other when blended:
 *  - tank  → brand orange `#F4A258`
 *  - cargo → cool cyan `#5DA9E9`
 *  - pass  → warm green `#9DCB6A`
 */
type RGBA = [number, number, number, number];
const ramp = (r: number, g: number, b: number): RGBA[] => [
  [r, g, b, 0],
  [r, g, b, 60],
  [r, g, b, 120],
  [r, g, b, 170],
  [r, g, b, 215],
  [r, g, b, 255],
];

export const HEATMAP_COLOR_RANGES: Record<HeatmapGroup, RGBA[]> = {
  tank: ramp(244, 162, 88),
  cargo: ramp(93, 169, 233),
  pass: ramp(157, 203, 106),
};
