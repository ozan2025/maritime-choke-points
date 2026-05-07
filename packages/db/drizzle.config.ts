import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repo root.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
