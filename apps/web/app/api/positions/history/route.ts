import { isRegionId, type HistoryResponseBody } from "@maritime/shared";
import { NextResponse, type NextRequest } from "next/server";

import { getPositionHistory } from "@/lib/queries/positions";

// Drizzle + node-postgres needs the Node runtime, not Edge.
export const runtime = "nodejs";

// 60 minutes — the scrubber's reach. Trail layer renders a 30-min visible
// window from this; the extra 30 min of head-room means a small scrubber
// nudge does not immediately invalidate the cached payload.
const HISTORY_WINDOW_MS = 60 * 60 * 1000;

// Hard cap matching the table's 48 h TTL. Buckets older than this would
// return increasingly partial data as the purge runs.
const TTL_GUARD_MS = 48 * 60 * 60 * 1000;

// Tolerate a minute of clock skew between client and server.
const FUTURE_SKEW_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const region = sp.get("region");
  const bucketParam = sp.get("bucket");

  if (!region || !isRegionId(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }

  const bucket = bucketParam ? new Date(bucketParam) : new Date();
  if (Number.isNaN(bucket.getTime())) {
    return NextResponse.json({ error: "invalid_bucket" }, { status: 400 });
  }

  const nowMs = Date.now();
  if (bucket.getTime() > nowMs + FUTURE_SKEW_MS) {
    return NextResponse.json({ error: "bucket_in_future" }, { status: 400 });
  }
  if (bucket.getTime() < nowMs - TTL_GUARD_MS) {
    return NextResponse.json({ error: "bucket_out_of_range" }, { status: 400 });
  }

  const windowStart = new Date(bucket.getTime() - HISTORY_WINDOW_MS);
  const dbRows = await getPositionHistory(region, windowStart, bucket);

  // Convert observedAt → epoch seconds at the wire boundary so the client
  // can feed deck.gl's TripsLayer (which wants numbers) without re-parsing.
  const rows = dbRows.map((r) => ({
    mmsi: r.mmsi,
    lat: r.lat,
    lon: r.lon,
    t: Math.floor(r.observedAt.getTime() / 1000),
  }));

  const body: HistoryResponseBody = {
    region,
    windowStart: windowStart.toISOString(),
    windowEnd: bucket.toISOString(),
    rows,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=60",
    },
  });
}
