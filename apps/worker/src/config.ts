export type VesselSourceKind = "aisstream" | "synthetic";

export interface WorkerConfig {
  port: number;
  source: VesselSourceKind;
  /** Required when {@link source} is `"aisstream"`. */
  aisStreamKey?: string;
}

const DEFAULT_PORT = 8787;
const DEFAULT_SOURCE: VesselSourceKind = "aisstream";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const port = parsePort(env.WORKER_WS_PORT);
  const source = parseSource(env.VESSEL_SOURCE);
  const aisStreamKey = env.AISSTREAM_KEY?.trim() || undefined;

  if (source === "aisstream" && !aisStreamKey) {
    throw new Error(
      "AISSTREAM_KEY is required when VESSEL_SOURCE=aisstream. " +
        "Set it in apps/worker/.env.local, or set VESSEL_SOURCE=synthetic to use the M2 simulator.",
    );
  }

  return { port, source, aisStreamKey };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid WORKER_WS_PORT: ${raw}`);
  }
  return parsed;
}

function parseSource(raw: string | undefined): VesselSourceKind {
  if (raw === undefined || raw === "") return DEFAULT_SOURCE;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "aisstream" || normalized === "synthetic") return normalized;
  throw new Error(`Invalid VESSEL_SOURCE: ${raw}. Expected "aisstream" or "synthetic".`);
}
