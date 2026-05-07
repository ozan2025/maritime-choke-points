import { loadConfig } from "./config.js";
import { VesselServer } from "./server.js";
import { SyntheticSource } from "./sources/synthetic.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const source = new SyntheticSource();
  const server = new VesselServer({ port: config.port, source });
  server.start();

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

main().catch((err: unknown) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
