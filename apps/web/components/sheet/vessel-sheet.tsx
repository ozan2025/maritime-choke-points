"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { VesselLivePanel } from "./vessel-live-panel";

/**
 * Controlled Sheet for vessel detail. Open state is derived from the
 * `?mmsi=` searchParam — a Server Component parent decides whether to
 * mount this and what mmsi to pass. Closing the Sheet (X, Escape, overlay
 * click, back-button) clears the searchParam via router.replace, which
 * unmounts the component on the next server render.
 *
 * The static-fields slot is a Server Component passed as `children`,
 * wrapped in <Suspense> by the parent. The live-fields slot is the
 * client-side <VesselLivePanel> rendered alongside.
 */
export function VesselSheet({ mmsi, children }: { mmsi: number; children: ReactNode }) {
  const router = useRouter();

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) router.replace("/", { scroll: false });
      }}
    >
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader className="border-b border-border/50">
          <SheetTitle>Vessel detail</SheetTitle>
          {/* Radix auto-associates this with SheetContent via aria-describedby — */}
          {/* don't override the id or aria-describedby manually, or the link breaks. */}
          <SheetDescription className="font-mono">MMSI {mmsi}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <VesselLivePanel mmsi={mmsi} />
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
