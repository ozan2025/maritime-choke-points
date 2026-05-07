import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// Flat-config monorepo strategy
// ─────────────────────────────
// ESLint 9 flat config does NOT auto-discover nested `eslint.config.mjs`
// files in workspaces. There is exactly one config (this one), and `pnpm lint`
// runs `eslint .` from the repo root. Workspace-specific rule sets are added
// here as additional config objects scoped via the `files:` field.
//
// Next.js 16+ ships native flat configs at `eslint-config-next/core-web-vitals`
// and `eslint-config-next/typescript`. We re-export them with a `files` filter
// so Next's React / a11y / image rules apply only inside `apps/web/**`.
// FlatCompat is no longer needed for this — Next 16 dropped the legacy
// `extends`-style export.

const webGlob = ["apps/web/**/*.{ts,tsx,js,jsx,mjs,cjs}"];

const scopeToWeb = (configs) => configs.map((c) => ({ ...c, files: webGlob }));

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
  ...scopeToWeb(nextCoreWebVitals),
  ...scopeToWeb(nextTypescript),
  {
    // App Router project — the no-html-link-for-pages rule is for the
    // legacy `pages/` router and emits a noisy "Pages directory cannot be
    // found" message at lint time. Turn it off for apps/web.
    files: webGlob,
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  prettier,
];
