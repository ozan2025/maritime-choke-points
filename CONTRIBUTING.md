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

## Issue body

Issue bodies follow a descriptive shape, not a strict template. Every
non-trivial issue includes:

- **Motivation** — the why. What changed in the world to make this work
  necessary, what gap it closes, what bug or signal triggered it. Concrete
  causation reads better than aspirational framing.
- **Acceptance criteria** — the what. Each AC is a testable claim, not a
  vague intention. "BOSPHORUS tile populates within 60 s of load" beats
  "make Bosphorus work."
- **Out-of-scope** — explicit punts. The list of things this issue is _not_
  doing, with one-line reasons. Load-bearing on PRs that touch a broad
  area: it tells the reviewer what to ignore and the next-cycle author
  where the carryovers live.
- **Locked decisions** — carryovers from prior cycles that this issue must
  not relitigate. References to the PR or issue that locked the decision
  keep them traceable.
- **Minimum-scope first cut** — when the work is the first slice of a
  larger area, frame the cut explicitly. PR #38 demonstrated the value:
  scoping Bosphorus + Panama as a region-list extension (not a recenter
  selector and not a per-region filter) made the PR shippable without an
  ambiguous boundary. The follow-ups landed in `HANDOVER.md` as named
  next-cycle candidates.

The shape is descriptive — adapt the headings when the work is small
enough that one collapses to a single line. A bug fix might have just
Motivation + AC; a dep bump might fold Out-of-scope into a one-liner. Use
the headings when they earn their space.

## Plan-mode threshold

Plan mode pays for itself when the ticket lands a novel cross-cutting
decision, and adds ceremony when it doesn't.

**Use plan mode** when the work introduces:

- a new read-path pattern (RSC + Suspense slot in #25, Route Handler +
  bucket-rounded URL in #27)
- a new layer in the rendering stack (TripsLayer in #27, IconLayer in
  #29, heatmap in #32)
- a new HUD primitive whose visual treatment will be reused (the
  Constellation HUD in #29)
- a decision that requires consulting a skill (`nextjs-expert`,
  `frontend-design`) before writing code

**Skip plan mode** for:

- mechanical extensions of an existing pattern (#38 added two regions to
  an existing region list — same DB schema, same wire shape, same HUD row)
- bug fixes
- doc-only changes
- dependency bumps
- one-line changes (e.g. #31's pending `STYLE_URL` swap)

When plan mode is the right call, run it before opening the PR. Use
`AskUserQuestion` for the sharp trade-offs, then `ExitPlanMode` and
implement. The empirical record: #25/#27/#29/#32 invoked plan mode and
locked the right architectural decisions; #38 correctly skipped it and
shipped a 6-file mechanical PR without preamble.

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

## Verification

Local verification before pushing has two parts: the static gates
(`pnpm lint && pnpm typecheck && pnpm format:check`) and a chrome-devtools
walkthrough wrapped in a subagent (recipe at
`~/.claude/projects/.../memory/recipe_chrome_devtools_mcp.md`). The static
gates verify code correctness; the walkthrough verifies feature
correctness. Both are required before pushing — neither substitutes for
the other.

### Time-dependent behavior — load-bearing rule

When the PR touches anything that produces visible state over time —
counters, tiles, trails, async fetches that populate UI, WebSocket-driven
aggregates — the chrome-devtools walkthrough **must include a wait of at
least 60 seconds post-load and verify the state actually populated**, not
just that the surface rendered.

Author sessions may not downgrade this check to "optional," "noise," or
"covered by the static gates." It is a hard rule because:

PR #38 added Bosphorus and Panama as new regions. The data plumbing was
correct (worker subscribed, persistence wrote rows, HUD tiles rendered).
But the browser subscription was still pinned to `["malaccaSingapore"]`,
so the new tile counts would have been permanently zero in production.
The author's chrome-devtools walkthrough verified the tiles _rendered_ at
count = 0 and explicitly told the subagent to skip the 60-second wait as
"noise." That skipped wait is exactly what would have caught the bug
pre-review. It was caught by reviewer instead — which works, but moves a
discoverable defect off the author's checklist and onto the reviewer's.

In practice the rule means: after the walkthrough's static checks (page
loads, console clean, dialogs open, click handlers fire), keep the page
open for at least 60 seconds, then verify the state-driven surfaces have
non-zero, non-placeholder values. **Capture the actual numbers in the
verification log** so the reviewer sees them — not a "tiles rendered"
claim. PR #39's fixup re-verification ("BOSPHORUS = 4, PANAMA = 1,
MALACCA = 54 after ~165 s") is the right shape.

If the surface _cannot_ populate within 60 seconds (e.g. the upstream
signal is rare, like Bab el-Mandeb's permanent zero), say so explicitly
and explain why. That is the difference between "verified empty by
design" and "skipped the check."

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
- **`REVIEWER_PROMPT.md`** — briefing for the _first-pass_ reviewer
  session. Updated by the author session right before stopping the
  initial PR push. **Re-reviews are different** — see "Re-review
  cadence" below.

Both files are gitignored. Each is overwritten in place — never
accumulated. The verbal interface for switching sessions becomes:

| Situation                                                  | Say to the new session                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Starting a new ticket (fresh author session)               | "read `AUTHOR_PROMPT.md` and go"                                |
| Reviewing a fresh PR (fresh reviewer session)              | "read `REVIEWER_PROMPT.md` and proceed"                         |
| Reviewer just finished, your author session is still alive | "review is done, address it"                                    |
| Reviewer just finished, original author session is gone    | "read `AUTHOR_PROMPT.md` and address review"                    |
| Author pushed fixups (fresh reviewer session, re-review)   | "re-review the fixups on PR #N" — see "Re-review cadence" below |

### Re-review cadence (asymmetric with first-pass)

The first-pass review and the re-review have different information
needs, and the prompt files should reflect that:

- **First-pass review.** Reviewer is cold to the PR. The prompt should
  be detailed: bootstrap reading list, "things to focus on," locked
  decisions, verification recipe. The structure under "Conventional
  structure" applies in full.
- **Re-review.** Reviewer already cleared the prior pass and has all
  the project-convention context loaded. The fixup commit message and
  the author's PR comment already carry the item-by-item breakdown
  (which findings were taken, which punted with rationale). A
  rewritten `REVIEWER_PROMPT.md` would mostly duplicate the GH timeline.

  **Default for re-review: do not rewrite `REVIEWER_PROMPT.md`.** Hand
  off verbally instead — point at the PR and the fixup SHA. Only
  rewrite the file if there is something genuinely novel for the
  re-reviewer beyond the diff (e.g. "I took option B from your
  suggestion and option A tripped a lint rule — here's why," or "the
  fixup touches an unrelated area as a side-effect of X"). When you
  do rewrite for a re-review, keep it short — a one-screen pointer,
  not a recapitulation of the prior prompt.

  This trims the per-cycle overhead without weakening the discipline:
  even non-blocking fixups still go back through the reviewer session
  before squash-merge ("Reviewer hand-off" rule above).

### Conventional structure (first-pass prompts)

First-pass `AUTHOR_PROMPT.md` and `REVIEWER_PROMPT.md` are free-form
Markdown but conventionally lead with:

1. A one-sentence role line (`You are the author session for…`).
2. A bootstrap reading list pointing at `PRD.md`, `CONTRIBUTING.md`,
   `HANDOVER.md`, and the relevant GH issue / PR.
3. The cycle steps for that role.
4. Locked decisions and "things that bite if missed" carried from
   prior cycles.
5. The stop condition (e.g. "after PR opens with green CI, stop and
   tell the project owner to start a fresh reviewer session").

Re-review hand-offs do not need this structure — see the cadence note
above.

#### Size budget

Target ~80–120 lines for first-pass `AUTHOR_PROMPT.md` and
`REVIEWER_PROMPT.md`. PR #39's prompt at ~110 lines covered the role,
bootstrap, cycle, locked carryovers, and stop condition without padding;
PR #35's at ~130 lines felt over-engineered in retrospect.

If a briefing wants to grow past ~120 lines, the overflow probably
belongs elsewhere:

- **Architecture context, decision history, env keys** — `HANDOVER.md`.
  The prompt file points at it; doesn't duplicate it.
- **Acceptance criteria, out-of-scope, locked decisions for _this_
  ticket** — the issue body. The prompt file references the issue
  number; doesn't recapitulate.
- **Reusable conventions** — this file. The prompt file doesn't
  re-derive them.

The budget is a soft target, not a hard cap. A genuinely cross-cutting
cycle (a milestone-spanning epic, a stack migration) may legitimately
need a longer briefing. But if you find yourself padding the prompt to
feel "complete," the padding is a smell.

Re-reviews stay free-form per the asymmetric cadence above — typically
a few lines pointing at the fixup SHA.

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
