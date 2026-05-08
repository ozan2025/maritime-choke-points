import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.ts";

export * from "./schema.ts";
export { schema };

let pool: pg.Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

/**
 * Lazily-initialized singleton Postgres connection pool. Reads
 * DATABASE_URL from the environment on first call.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Copy .env.example to .env at the repo root, or export DATABASE_URL.",
      );
    }
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}

/**
 * Lazily-initialized typed Drizzle client bound to the schema in ./schema.ts.
 * Use this for all reads and writes from the worker (issue #8) and from web
 * server queries (issue #9).
 */
export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}
