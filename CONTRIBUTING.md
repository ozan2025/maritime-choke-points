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
Code session (or human reviewer) for review. See "Session prompt files" below
for the file-based mechanism that carries the hand-off without copy-pasting
prompts between chats.

## Session prompt files

Two local-only files at repo root brief the next session about its role
and ticket without copy-pasting prompts between chats:

- **`AUTHOR_PROMPT.md`** — briefing for the next _author_ session. Updated
  by the previous author session at two cadence points: (1) at end-of-cycle
  post-merge, pointing at the next ticket; and (2) right before stopping
  each PR push, so a fresh author session can address review feedback if
  the original author session was terminated. Whichever cadence fired
  most recently, the file describes whatever the next author session
  needs to do.
- **`REVIEWER_PROMPT.md`** — briefing for the next _reviewer_ session
  (or re-review pass). Updated by the author session right before
  stopping each PR push (initial push and any fixup push).

Both files are gitignored. Each is overwritten in place — never
accumulated. The verbal interface for switching sessions becomes:

| Situation                                                  | Say to the new session                              |
| ---------------------------------------------------------- | --------------------------------------------------- |
| Starting a new ticket (fresh author session)               | "read `AUTHOR_PROMPT.md` and go"                    |
| Reviewing a fresh PR (fresh reviewer session)              | "read `REVIEWER_PROMPT.md` and proceed"             |
| Reviewer just finished, your author session is still alive | "review is done, address it"                        |
| Reviewer just finished, original author session is gone    | "read `AUTHOR_PROMPT.md` and address review"        |
| Author has pushed fixups (fresh reviewer session)          | "read `REVIEWER_PROMPT.md` and proceed" (re-review) |

### Conventional structure

Both files are free-form Markdown but conventionally lead with:

1. A one-sentence role line (`You are the author session for…`).
2. A bootstrap reading list pointing at `PRD.md`, `CONTRIBUTING.md`,
   `HANDOVER.md`, and the relevant GH issue / PR.
3. The cycle steps for that role.
4. Locked decisions and "things that bite if missed" carried from
   prior cycles.
5. The stop condition (e.g. "after PR opens with green CI, stop and
   tell the project owner to start a fresh reviewer session").

### Separation of concerns

- **`HANDOVER.md`** = persistent project state (history, locked
  decisions, open punts, env keys). Read by every session.
- **`AUTHOR_PROMPT.md` / `REVIEWER_PROMPT.md`** = ephemeral role
  briefing. Read by the session it's addressed to. Doesn't try to
  duplicate `HANDOVER.md`; it points at it.

### When neither file exists yet

Project genesis only. After the first cycle ships, there will always
be at least an `AUTHOR_PROMPT.md` queued for the next ticket. If you
do start cold, ask the project owner which ticket to pick up and write
both files as you go.

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
