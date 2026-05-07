import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getDb, getPool } from "./index.js";

config({ path: "../../.env" });

await migrate(getDb(), { migrationsFolder: "./migrations" });
await getPool().end();

console.log("Migrations applied.");
