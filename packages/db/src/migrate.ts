import path from "node:path";

import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getDb, getPool } from "./index.ts";

config({ path: path.join(import.meta.dirname, "../../../.env") });

const migrationsFolder = path.join(import.meta.dirname, "../migrations");

try {
  await migrate(getDb(), { migrationsFolder });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await getPool().end();
}
