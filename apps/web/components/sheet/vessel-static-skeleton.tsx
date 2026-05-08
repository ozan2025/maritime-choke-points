import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

/**
 * Suspense fallback for VesselStaticPanel. Mirrors the row count so the
 * Sheet doesn't reflow when the static query resolves.
 */
export function VesselStaticSkeleton() {
  return (
    <section aria-busy="true" className="px-4 pt-1 pb-4">
      <h3 className="mb-2 text-xs font-medium text-muted-foreground uppercase">Vessel</h3>
      <div className="space-y-0">
        {Array.from({ length: ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border/40 py-2 last:border-b-0"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </section>
  );
}
