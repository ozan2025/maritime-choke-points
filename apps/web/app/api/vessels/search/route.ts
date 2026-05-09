import { NextResponse, type NextRequest } from "next/server";

import { flagsContaining } from "@/lib/ais/mid";
import {
  searchVessels,
  type SearchPredicates,
  type VesselSearchResult,
} from "@/lib/queries/vessel-search";

// Drizzle + node-postgres needs the Node runtime, not Edge.
export const runtime = "nodejs";

const MAX_Q_LEN = 64;
const RESULT_LIMIT = 25;

interface SearchResponseBody {
  results: VesselSearchResult[];
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q");
  const q = raw?.trim() ?? "";

  if (q.length === 0) {
    return NextResponse.json({ error: "missing_q" }, { status: 400 });
  }
  if (q.length > MAX_Q_LEN) {
    return NextResponse.json({ error: "q_too_long" }, { status: 400 });
  }

  const preds: SearchPredicates = {
    mmsiPrefix: /^\d{1,9}$/.test(q) ? q : null,
    namePattern: `%${escapeIlike(q)}%`,
    mmsiPrefixesFromMid: flagsContaining(q).map((mid) => String(mid)),
  };

  const results = await searchVessels(preds, RESULT_LIMIT);

  const body: SearchResponseBody = { results };

  // `private` because results are user-navigable; no shared CDN benefit
  // for typed queries. Short max-age covers rapid-fire keystrokes after
  // debounce; SWR smooths back-nav. See `nextjs-expert` consult notes
  // in HANDOVER for the M4 #12 cycle.
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
    },
  });
}

/** Escapes the two ILIKE wildcards so user input can't accidentally match
 *  half the table when the search contains `%` or `_`. */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
