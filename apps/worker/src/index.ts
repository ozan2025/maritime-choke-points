import { getDb, getPool } from "@maritime/db";

import { loadConfig, type WorkerConfig } from "./config.js";
import { VesselServer } from "./server.js";
import { AisStreamSource } from "./sources/aisstream.js";
import type { VesselSource } from "./sources/source.js";
import { SyntheticSource } from "./sources/synthetic.js";
import { PostgresWriter } from "./writer/postgres.js";

async function main(): Promise<void> {
  const config = loadConfig();

  // getDb() throws if DATABASE_URL is missing — fail fast at boot, no
  // silent in-memory fallback. Mirrors the M3 #7 missing-AISSTREAM_KEY
  // policy. Probe the pool with a trivial query so a wrong host/auth
  // surfaces here rather than on the first AIS event.
  const db = getDb();
  await getPool().query("select 1");
  console.log("[worker] postgres pool ready");

  const writer = new PostgresWriter(db);
  writer.start();

  const source = createSource(config);
  const server = new VesselServer({ port: config.port, source, writer });
  server.start();
  console.log(`[worker] vessel source: ${config.source}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] received ${signal}; shutting down`);
    try {
      await server.stop();
      writer.stop();
      await getPool().end();
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
