import { loadConfig, type WorkerConfig } from "./config.js";
import { VesselServer } from "./server.js";
import { AisStreamSource } from "./sources/aisstream.js";
import type { VesselSource } from "./sources/source.js";
import { SyntheticSource } from "./sources/synthetic.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const source = createSource(config);
  const server = new VesselServer({ port: config.port, source });
  server.start();
  console.log(`[worker] vessel source: ${config.source}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] received ${signal}; shutting down`);
    try {
      await server.stop();
    } catch (err) {
      console.error("[worker] error during shutdown", err);
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

function createSource(config: WorkerConfig): VesselSource {
  if (config.source === "synthetic") return new SyntheticSource();
  // loadConfig guarantees aisStreamKey is present when source === "aisstream".
  if (!config.aisStreamKey) {
    throw new Error("AISSTREAM_KEY missing despite source=aisstream — config invariant broken");
  }
  return new AisStreamSource({ apiKey: config.aisStreamKey });
}

main().catch((err: unknown) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
