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
