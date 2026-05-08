import VesselStatusBadge from "@/components/map/vessel-status-badge";
import VesselStreamProvider from "@/components/map/vessel-stream-provider";
import WorldMap from "@/components/map/world-map-loader";

export default function HomePage() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <WorldMap />
      <VesselStreamProvider />
      <VesselStatusBadge />
    </main>
  );
}
