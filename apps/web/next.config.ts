import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Source-only workspace packages — Next must transpile them through
  // its loader so Turbopack rewrites the NodeNext-style `.js` extensions
  // in their internal imports back to the `.ts` source. Without this,
  // `@maritime/db`'s `export * from "./schema.js"` cannot resolve.
  transpilePackages: ["@maritime/db", "@maritime/shared"],
};

export default nextConfig;
