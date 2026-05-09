"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { shipTypeLabel } from "@/lib/ais/enums";
import { mmsiToFlag } from "@/lib/ais/mid";
import type { VesselSearchResult } from "@/lib/queries/vessel-search";
import { useVesselsStore } from "@/lib/vessels-store";

import { useVesselSearch } from "./use-vessel-search";

/**
 * ⌘K command palette. Searches vessels observed in the last 48 h by name,
 * MMSI, or flag. Result selection writes `?mmsi=N` — same selection
 * contract as a map click — and the existing Sheet picks it up from the
 * URL.
 *
 * Open state lives on the Zustand store so the global hotkey listener,
 * the trigger pill, and this dialog can all toggle without prop drilling.
 */
export function VesselPalette() {
  const router = useRouter();
  const open = useVesselsStore((s) => s.paletteOpen);
  const setOpen = useVesselsStore((s) => s.setPaletteOpen);
  const { q, setQ, results, status } = useVesselSearch();

  // Global ⌘K / Ctrl+K hotkey. Toggles open. Esc-to-close is handled by
  // Radix's built-in dialog dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useVesselsStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Reset the input each time the palette closes so a fresh ⌘K opens
  // empty — prevents stale results flashing on reopen.
  useEffect(() => {
    if (!open) setQ("");
  }, [open, setQ]);

  const onSelect = (mmsi: number) => {
    router.replace(`?mmsi=${mmsi}`, { scroll: false });
    setOpen(false);
  };

  const trimmedQ = q.trim();
  const showSpinner = status === "loading" && trimmedQ.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Vessel search"
      description="Search vessels observed in the last 48 hours by name, MMSI, or flag."
    >
      {/* shouldFilter=false: the server already ranked results; cmdk's
          client filter would re-score and could hide MID-derived hits
          whose visible label doesn't include the typed query. */}
      <Command shouldFilter={false}>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Search vessels by name, MMSI, or flag…"
        />
        <CommandList>
          {trimmedQ.length === 0 ? (
            <CommandEmpty>
              <div className="px-2 text-xs text-muted-foreground">
                Type a vessel name, an MMSI prefix, or a flag (e.g. <em>Singapore</em>).
              </div>
            </CommandEmpty>
          ) : showSpinner && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2Icon className="size-3 animate-spin" />
              Searching…
            </div>
          ) : status === "error" ? (
            <CommandEmpty>
              <div className="px-2 text-xs text-muted-foreground">Search failed. Try again.</div>
            </CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>
              <div className="px-2 text-xs text-muted-foreground">
                No vessels observed in the last 48 h match{" "}
                <span className="text-foreground">&ldquo;{trimmedQ}&rdquo;</span>.
              </div>
            </CommandEmpty>
          ) : (
            results.map((r) => <ResultRow key={r.mmsi} result={r} onSelect={onSelect} />)
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

interface ResultRowProps {
  result: VesselSearchResult;
  onSelect: (mmsi: number) => void;
}

function ResultRow({ result, onSelect }: ResultRowProps) {
  // Prefer the persisted flag, fall back to the MID-derived one when the
  // worker hasn't filled `flag_state` yet (HANDOVER punt #27).
  const flag = result.flagState ?? mmsiToFlag(result.mmsi);
  const name = result.shipName ?? `MMSI ${result.mmsi}`;
  const type = shipTypeLabel(result.shipType);

  return (
    <CommandItem
      value={String(result.mmsi)}
      onSelect={() => onSelect(result.mmsi)}
      className="flex flex-col items-start gap-0.5"
    >
      <div className="text-sm">{name}</div>
      <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
        {result.mmsi}
        <span className="px-2 text-foreground/30">·</span>
        {type}
        <span className="px-2 text-foreground/30">·</span>
        {flag ?? "Unknown flag"}
      </div>
    </CommandItem>
  );
}
