"use client";

import type { RegionId } from "@maritime/shared";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACTIVE = "#F4A258";

/**
 * Click-context copy. Verbatim from PRD §9 feature 5 — the copy is
 * calibrated to the project's voice and should not be paraphrased.
 */
const CONTEXT: Record<
  RegionId,
  { name: string; status: string; statusTone: "live" | "muted"; body: string }
> = {
  malaccaSingapore: {
    name: "Malacca / Singapore",
    status: "normal",
    statusTone: "live",
    body: "Terrestrial AIS coverage strong; ~25% of global trade.",
  },
  suez: {
    name: "Suez",
    status: "sparse",
    statusTone: "muted",
    body: "Canal-bound transits, sparse AISStream coverage; widen bbox or wait longer to see traffic.",
  },
  babElMandeb: {
    name: "Bab el-Mandeb",
    status: "dark",
    statusTone: "muted",
    body: "Houthi attack corridor since 2023; vessels deliberately AIS-dark for safety.",
  },
  hormuzApproaches: {
    name: "Hormuz",
    status: "closed",
    statusTone: "muted",
    body: "Strait effectively closed to commercial shipping since Feb 2026; counter will animate up if/when traffic resumes.",
  },
};

interface ChokePointDialogProps {
  region: RegionId | null;
  count: number;
  onOpenChange: (open: boolean) => void;
}

export function ChokePointDialog({ region, count, onOpenChange }: ChokePointDialogProps) {
  const open = region !== null;
  const ctx = region === null ? null : CONTEXT[region];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[rgba(8,12,22,0.92)] backdrop-blur-md ring-white/10">
        {ctx && (
          <>
            <DialogHeader>
              <DialogTitle
                className="font-mono text-[11px] uppercase tracking-[0.22em]"
                style={{ color: ACTIVE }}
              >
                {ctx.name}
              </DialogTitle>
              <div className="flex items-baseline gap-3">
                <div className="font-sans text-[40px] leading-none font-medium text-white tabular-nums">
                  {count.toLocaleString()}
                </div>
                <div
                  className="font-mono text-[11px] uppercase tracking-[0.2em]"
                  style={{
                    color: ctx.statusTone === "live" ? ACTIVE : "rgba(255,255,255,0.45)",
                  }}
                >
                  {ctx.status}
                </div>
              </div>
            </DialogHeader>
            <DialogDescription className="text-white/70">{ctx.body}</DialogDescription>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
