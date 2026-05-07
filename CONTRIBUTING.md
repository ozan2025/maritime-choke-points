# Contributing

This is a portfolio project, but it follows team-grade conventions so the
GitHub history reads like a real product. The conventions below are enforced
by CI and by the pre-commit hook.

## Workflow

Every non-trivial change flows through an issue → branch → PR → squash-merge
cycle. Direct pushes to `main` are blocked by branch protection.

1. Open or pick a GitHub issue describing the work.
2. Self-assign and comment that you are picking it up.
3. Create a branch from up-to-date `main`:
   ```
   git checkout main && git pull
   git checkout -b issue-N-short-description
   ```
4. Make the change in one or more logical commits.
5. Push and open a PR with `Closes #N` in the body.
6. Wait for CI green, then hand off for review.
7. After approval, squash-merge with `gh pr merge <N> --squash --delete-branch`.

## Branch naming

`issue-N-short-description` — matches the issue number and gives a few
keywords of context. Example: `issue-1-tooling-foundation`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/). Allowed types:

- `feat:` — user-facing functionality
- `fix:` — bug fix
- `chore:` — tooling, dependencies, repository housekeeping
- `docs:` — documentation only
- `refactor:` — internal restructure with no behavior change
- `ci:` — GitHub Actions, Dependabot, branch protection
- `test:` — tests only
- `perf:` — performance work

Keep the subject under ~72 characters and in the imperative mood. Body is
optional; use it to explain _why_, not _what_. Multiple logical commits on a
feature branch are welcome — they squash on merge.

## PR titles

PR titles follow the same Conventional Commits format. Squash-merge uses the
PR title as the merge commit subject, so the title becomes the canonical
record on `main`.

## Pre-commit hook

Husky runs `lint-staged` on every commit:

- `*.{ts,tsx,js,jsx,mjs,cjs}` → `eslint --fix` then `prettier --write`
- `*.{json,md,yml,yaml}` → `prettier --write`

If a hook fails, fix the underlying issue. Do not bypass with `--no-verify`.

## Reviewer hand-off

The author session does **not** review its own work — cognitive bias from
having just written the code. Open the PR, then hand off to a separate Claude
Code session (or human reviewer) for review.

## Toolchain

- **Node** 22+ (required by `engines`)
- **pnpm** 9.x (pinned via `packageManager`; Corepack will fetch it)
- **TypeScript** strict, with `noUncheckedIndexedAccess` and `noImplicitOverride`
- **ESLint** flat config — a single root `eslint.config.mjs` that covers every
  workspace. ESLint 9 flat config does not auto-discover nested configs;
  workspace-specific rule sets are layered into the root config and scoped
  via `files:` (e.g. `files: ["apps/web/**/*.{ts,tsx}"]`). Issue #3 adds the
  Next.js rules this way once Next is installed in `apps/web`.
- **Worker module resolution** — `apps/worker/tsconfig.json` overrides
  `module` and `moduleResolution` to `NodeNext`. The base config defaults to
  bundler-style resolution (correct for Next.js), which would let extension-
  less imports pass typecheck and then fail at runtime under Node ESM.
- **`@maritime/shared`** ships raw TypeScript (no `dist/` build). The web app
  is bundled by Next; the worker will run via `tsx`. See
  `packages/shared/README.md` for when that changes.
- **Prettier** 3 with `printWidth: 100`, double quotes, `trailingComma: all`

Run `pnpm lint && pnpm typecheck && pnpm format:check` locally before pushing
— CI runs the same three commands.
