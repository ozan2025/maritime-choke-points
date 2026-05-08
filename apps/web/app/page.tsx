import { Suspense } from "react";

import VesselStatusBadge from "@/components/map/vessel-status-badge";
import VesselStreamProvider from "@/components/map/vessel-stream-provider";
import WorldMap from "@/components/map/world-map-loader";
import VesselStaticPanel from "@/components/sheet/vessel-static-panel";
import { VesselStaticSkeleton } from "@/components/sheet/vessel-static-skeleton";
import { VesselSheet } from "@/components/sheet/vessel-sheet";

interface HomePageProps {
  searchParams: Promise<{ mmsi?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { mmsi: mmsiParam } = await searchParams;
  const mmsi = parseMmsi(mmsiParam);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <WorldMap />
      <VesselStreamProvider />
      <VesselStatusBadge />
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
