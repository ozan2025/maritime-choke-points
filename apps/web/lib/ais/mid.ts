/**
 * MID (Maritime Identification Digits) → flag-state lookup. The first three
 * digits of an MMSI are an ITU-assigned MID identifying the vessel's flag
 * state. AIS does not carry the flag explicitly; deriving it from the MMSI
 * is standard.
 *
 * This table covers the high-traffic flags observed in the Singapore Strait
 * (Singapore, Panama, Liberia, Marshall Islands, etc.) plus the major
 * shipping nations and common flags-of-convenience. It is not exhaustive —
 * unknown MIDs return null and the Sheet renders "—". The list expands
 * organically as future cycles add flags users care about.
 *
 * Source: ITU MARS (Maritime mobile Access and Retrieval System) MID list,
 * cross-referenced against AISStream traffic observed during M3 #7/#8.
 */
const MID_TO_FLAG: Readonly<Record<number, string>> = {
  // Singapore Strait — primary corridor
  525: "Indonesia",
  533: "Malaysia",
  563: "Singapore",
  564: "Singapore",
  565: "Singapore",
  566: "Singapore",
  567: "Thailand",
  574: "Vietnam",

  // Major shipping flags / FOCs
  351: "Panama",
  352: "Panama",
  353: "Panama",
  354: "Panama",
  355: "Panama",
  356: "Panama",
  357: "Panama",
  370: "Panama",
  371: "Panama",
  372: "Panama",
  373: "Panama",
  374: "Panama",
  636: "Liberia",
  637: "Liberia",
  538: "Marshall Islands",
  308: "Bahamas",
  309: "Bahamas",
  311: "Bahamas",
  215: "Malta",
  229: "Malta",
  248: "Malta",
  249: "Malta",
  256: "Malta",
  209: "Cyprus",
  210: "Cyprus",
  212: "Cyprus",
  319: "Cayman Islands",
  375: "St. Vincent & Grenadines",
  376: "St. Vincent & Grenadines",
  377: "St. Vincent & Grenadines",
  235: "United Kingdom",
  232: "United Kingdom",
  233: "United Kingdom",
  234: "United Kingdom",

  // East Asia / South Asia
  412: "China",
  413: "China",
  414: "China",
  477: "Hong Kong",
  431: "Japan",
  432: "Japan",
  440: "South Korea",
  441: "South Korea",
  416: "Taiwan",
  419: "India",
  548: "Philippines",

  // Middle East / Indian Ocean
  470: "United Arab Emirates",
  466: "Qatar",
  403: "Saudi Arabia",
  423: "Azerbaijan",
  422: "Iran",

  // Europe (selection)
  237: "Greece",
  239: "Greece",
  240: "Greece",
  241: "Greece",
  257: "Norway",
  258: "Norway",
  259: "Norway",
  219: "Denmark",
  220: "Denmark",
  244: "Netherlands",
  245: "Netherlands",
  246: "Netherlands",
  205: "Belgium",
  211: "Germany",
  218: "Germany",
  226: "France",
  227: "France",
  228: "France",
  247: "Italy",
  224: "Spain",
  225: "Spain",
  263: "Portugal",
  273: "Russia",

  // Americas
  338: "United States",
  366: "United States",
  367: "United States",
  368: "United States",
  369: "United States",
  316: "Canada",
  710: "Brazil",
  725: "Chile",

  // Oceania
  503: "Australia",
  512: "New Zealand",
};

/**
 * Returns the flag-state name derived from the MMSI's MID, or null if the
 * MID is not in the lookup table. Auxiliary MMSI ranges (group ships,
 * coast stations, SAR aircraft, AtoN, base stations — first digit ≥ 8 or
 * == 0) intentionally return null; they are not vessel-flag identifiers.
 */
export function mmsiToFlag(mmsi: number): string | null {
  if (!Number.isInteger(mmsi) || mmsi <= 0) return null;
  const mid = Math.floor(mmsi / 1_000_000);
  // Standard ship-station MMSIs are 9-digit, MID in the 200–799 range.
  // Anything else is auxiliary (group, base, SAR, AtoN…) — return null.
  if (mid < 200 || mid > 799) return null;
  return MID_TO_FLAG[mid] ?? null;
}

/**
 * Returns the MID integers whose flag-state name contains `needle`
 * (case-insensitive). Powers the ⌘K palette's flag-name search — the
 * route handler maps each returned MID into a 3-digit MMSI prefix and
 * ORs those prefixes into the SQL predicate.
 *
 * Coverage is intentionally partial (see module header). A search like
 * "Singapore" hits 4 MIDs, "Brazil" hits 1, "France" hits 3, but a
 * search like "Estonia" matches nothing because Estonia is not seeded
 * here yet — the empty result is honest, not a bug.
 */
export function flagsContaining(needle: string): number[] {
  const trimmed = needle.trim();
  if (trimmed.length === 0) return [];
  const lower = trimmed.toLowerCase();
  const out: number[] = [];
  for (const [midStr, name] of Object.entries(MID_TO_FLAG)) {
    if (name.toLowerCase().includes(lower)) {
      out.push(Number(midStr));
    }
  }
  return out;
}
