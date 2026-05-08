import { cn } from "@/lib/utils";

/**
 * Two-column label/value row for the vessel-detail Sheet. Values render in
 * Geist Mono with `tabular-nums` so columns align across rows. Used by
 * both the static (server) and live (client) panels so the layouts match.
 */
export function DataRow({
  label,
  value,
  mono = true,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-b-0",
        className,
      )}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-foreground",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
