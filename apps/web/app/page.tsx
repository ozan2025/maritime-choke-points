import { Suspense } from "react";

import { ChokePointsRow } from "@/components/hud/choke-points-row";
import { SelectionSync } from "@/components/hud/selection-sync";
import { SystemPill } from "@/components/hud/system-pill";
import { VesselsCounter } from "@/components/hud/vessels-counter";
import VesselStreamProvider from "@/components/map/vessel-stream-provider";
import WorldMap from "@/components/map/world-map-loader";
import Scrubber from "@/components/scrubber/scrubber";
import ScrubberProvider from "@/components/scrubber/scrubber-provider";
import VesselStaticPanel from "@/components/sheet/vessel-static-panel";
import { VesselStaticSkeleton } from "@/components/sheet/vessel-static-skeleton";
import { VesselSheet } from "@/components/sheet/vessel-sheet";

interface HomePageProps {
  searchParams: Promise<{ mmsi?: string; t?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { mmsi: mmsiParam, t: tParam } = await searchParams;
  const mmsi = parseMmsi(mmsiParam);
  const initialScrubAt = parseScrubAt(tParam);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <WorldMap />
      <VesselStreamProvider />
      <ScrubberProvider initialScrubAt={initialScrubAt} />
      <SelectionSync mmsi={mmsi} />
      <SystemPill />
      <VesselsCounter />
      <ChokePointsRow />
      <Scrubber />
      {mmsi !== null && (
        <VesselSheet mmsi={mmsi}>
          <Suspense fallback={<VesselStaticSkeleton />}>
            <VesselStaticPanel mmsi={mmsi} />
          </Suspense>
        </VesselSheet>
      )}
    </main>
  );
}

/**
 * Validates the `?mmsi=` searchParam. Standard ITU ship-station MMSIs are
 * 9-digit integers starting with a MID (200..799); auxiliary ranges
 * (group, base, SAR, AtoN, EPIRB) use other prefixes but are still
 * 9-digit integers. We accept any positive 9-digit integer here — the
 * Sheet will show "—" for fields that don't apply, rather than guessing
 * the wrong validation rule.
 */
function parseMmsi(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 100_000_000 || n > 999_999_999) return null;
  return n;
}

/**
 * Validates the `?t=` searchParam. Returns the ISO string back unchanged
 * if it parses to a finite Date and is not too far in the future. The
 * heavy validation (within the 48 h TTL window) lives in the route
 * handler; here we only reject obvious junk so the client doesn't
 * initialize scrubbed mode at NaN.
 */
function parseScrubAt(raw: string | undefined): string | null {
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() > Date.now() + 60_000) return null;
  return at.toISOString();
}
