import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Path is intentionally relative to cwd, not the source file. drizzle-kit
// transpiles this config to CJS via esbuild before loading it, which makes
// `import.meta.dirname` undefined here (unlike in `src/migrate.ts`). It is
// safe to assume the cwd is this package, because drizzle-kit always chdir's
// to the directory containing `drizzle.config.ts` before evaluating it.
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
