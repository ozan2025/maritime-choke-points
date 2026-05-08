/**
 * Human-readable labels for AIS enum codes. Source: ITU-R M.1371-5
 * (navigational status: §3.3.1.7; ship and cargo type: Table 53).
 */

const NAV_STATUS_LABELS: Readonly<Record<number, string>> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted maneuverability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Engaged in fishing",
  8: "Under way sailing",
  9: "Reserved (HSC)",
  10: "Reserved (WIG)",
  11: "Power-driven vessel towing astern",
  12: "Power-driven vessel pushing ahead",
  13: "Reserved",
  14: "AIS-SART / MOB-AIS / EPIRB-AIS",
  15: "Undefined",
};

export function navStatusLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return "—";
  return NAV_STATUS_LABELS[code] ?? `Unknown (${code})`;
}

/**
 * Maps AIS ship-type codes (0–99) to bucketed labels. ITU-R M.1371 reserves
 * the tens digit as the major category and the ones digit as a sub-type
 * (cargo class, hazard rating, …). For #9 the bucketed major category is
 * enough; type-specific silhouettes land in M4 #11.
 */
export function shipTypeLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return "—";
  if (!Number.isInteger(code) || code < 0 || code > 99) return `Unknown (${code})`;

  if (code === 0) return "Not available";
  if (code >= 20 && code <= 29) return "Wing in ground (WIG)";
  if (code === 30) return "Fishing";
  if (code === 31 || code === 32) return "Towing";
  if (code === 33) return "Dredging / underwater ops";
  if (code === 34) return "Diving ops";
  if (code === 35) return "Military ops";
  if (code === 36) return "Sailing";
  if (code === 37) return "Pleasure craft";
  if (code >= 40 && code <= 49) return "High-speed craft (HSC)";
  if (code === 50) return "Pilot vessel";
  if (code === 51) return "Search and rescue";
  if (code === 52) return "Tug";
  if (code === 53) return "Port tender";
  if (code === 54) return "Anti-pollution";
  if (code === 55) return "Law enforcement";
  if (code === 58) return "Medical transport";
  if (code === 59) return "Special craft";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 90 && code <= 99) return "Other";
  return `Reserved (${code})`;
}
