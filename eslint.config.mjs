import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// Flat-config monorepo strategy
// ─────────────────────────────
// ESLint 9 flat config does NOT auto-discover nested `eslint.config.mjs`
// files in workspaces. There is exactly one config (this one), and `pnpm lint`
// runs `eslint .` from the repo root. Workspace-specific rule sets are added
// here as additional config objects scoped via the `files:` field.
//
// Issue #3 will add Next.js rules in this file along the lines of:
//
//   import { FlatCompat } from "@eslint/eslintrc";
//   const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
//   ...compat.extends("next/core-web-vitals").map((c) => ({
//     ...c,
//     files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
//   })),
//
// (with `next` and `@eslint/eslintrc` installed at that point). The root
// config remains the single source of truth; per-workspace ESLint configs
// would silently no-op under the current `pnpm lint` invocation.

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/.cache/**",
      "**/coverage/**",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
];
