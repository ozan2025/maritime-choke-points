import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

// Note: Next.js-specific rules (`eslint-config-next`) are intentionally NOT
// configured at the root. They will be added by issue #3 inside
// `apps/web/eslint.config.mjs` once Next.js itself is installed in that
// workspace — the standard monorepo pattern. The root config covers
// language-level (JS/TS) hygiene for every package.

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
