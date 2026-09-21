# Insights — cross-package

Append-only log of facts that cost someone time. Package-specific ones live in
`<pkg>/INSIGHTS.md`; this file is for what spans packages or belongs to the repo
itself — tooling, git, CI, `scripts/`.

Written by the `engineering-insights` skill. Sections are fixed and always
present, even when empty. Entries are newest first:

```
### YYYY-MM-DD — one-line title
**Symptom:** what you saw.
**Cause:** why it happens.
**Rule:** what to do from now on.
**Where:** path/to/file.ts:42
```

`Where:` carries a line number, not a bare path — a reader should land on the
code, not hunt for it. Name the symbol in parentheses when the line will drift.

Append only — never edit or delete an entry. Something proven wrong gets
`**Correction (YYYY-MM-DD):**` appended to it.

---

## What Works

### 2026-09-19 — test a command-text hook from a scratchpad script, not from a Bash command
**Symptom:** every attempt to pipe-test the `gh pr create` guard was blocked by
the guard itself, because the test command contained the trigger phrase.
**Cause:** the hook inspects the command text of the very call that tests it.
**Rule:** put the cases in a `.mjs` file in the scratchpad, run `node <file>`, and
build the trigger inside it by concatenation (`'gh' + ' pr ' + 'create'`) so the
outer command never carries it. Feed each case with
`execFileSync('node', [guard], { input: JSON.stringify({ tool_input: { command } }) })`
and assert on `"deny"` in stdout.
**Where:** `.claude/skills/pr-self-review/scripts/pr-guard.mjs:15` (the deny
payload the test asserts on)

## What Doesn't Work

### 2026-09-20 — two agent sessions in ONE checkout: a `git checkout --` and a branch switch both hit the other's work
**Symptom:** an uncommitted refactor of
`server/src/modules/settings/feature-models.ts` reverted itself mid-session — a
second Claude session saw the file failing `tsc` (it was half-applied: the
signature had changed, the callers had not) and ran `git checkout --` on it,
assuming stray output from one of its own subagents. Separately, that session's
three L02 commits landed on `lesson/L03-conventions`, because a checkout has one
HEAD and this one had been switched to the L03 branch.
**Cause:** this repo is a single working tree. Two sessions share its index, its
HEAD and its branch; neither can tell another agent's unfinished edit from its
own debris, and `git commit` writes to whatever branch HEAD points at, not to
the branch its author had in mind.
**Rule:** before starting parallel work here, say which paths you own — the two
sessions did, and nothing else collided afterwards. Never `git checkout --` a
file you did not write; ask the other session instead, because a half-applied
refactor is indistinguishable from garbage and looks exactly like a `tsc`
failure worth reverting. Commits already on the wrong branch are recoverable
without a checkout: `git branch -f <other-branch> <sha>` fast-forwards it in
place, and `git push origin <branch>` / `gh pr create --head <branch>` both work
by refspec. For genuinely independent work, use `git worktree add` instead of
sharing this one.
**Where:** `server/src/modules/settings/feature-models.ts:56`
(`resolveFeatureModel`, the file that was reverted)

### 2026-09-19 — a PreToolUse Bash hook sees raw command TEXT, so a substring matcher blocks innocent commands
**Symptom:** the `pr-self-review` guard, matching `/\bgh pr create\b/`, refused a
`node -e "…"` command whose only sin was containing that phrase inside a quoted
string. The hook error replaced the command's output, so the command never ran.
**Cause:** a hook receives `tool_input.command` as text and cannot know which part
of it is a command and which is an argument. Any substring match fires on
documentation, echoes and test fixtures. The `if: "Bash(gh pr create*)"` filter in
`.claude/settings.json` did **not** prevent the hook from running on the
non-matching command either, so the filter cannot be the guarantee.
**Rule:** anchor a command matcher to the start of a command —
`(^|[;&|(]|\n)\s*(\w+=\S+\s+)*(sudo\s+)?<cmd>` — and re-check the command
inside the script rather than relying on `if`. Accept that a literal
`; gh pr create` inside a quoted string still trips it.
**Where:** `.claude/skills/pr-self-review/scripts/pr-guard.mjs:37` (the matcher),
`.claude/settings.json:10` (the `if` filter)

### 2026-09-16 — `grep -r` over the repo doubles every hit and can hang
**Symptom:** a `grep -o -E` across the tree ran past 120s and returned two
matches for every real one, at paths like
`server/clones/<owner>/dev-digest/reviewer-core/src/review/run.ts`.
**Cause:** `server/clones/` is repo-intel's clone target, and a repo added to
the studio can be dev-digest itself — so the tree contains a full second
checkout of this project. It is gitignored (`.gitignore` → `clones/`), which
raw `grep`/`find` do not honour.
**Rule:** search with the gitignore-aware Grep tool, or exclude
`server/clones/` explicitly. Never edit a path containing `server/clones/` —
those files are indexed copies, not source.
**Where:** `.gitignore:21` (`clones/`), `server/clones/`

## Codebase Patterns

### 2026-09-16 — lesson features are built from scratch, never restored from history
**Symptom:** a lesson feature can be finished quickly by finding the commit that
removed it from the finished product and reverting it — per-run cost (L01) was
planned that way off `d45ab0d`.
**Cause:** the starter is the finished product with features taken out, so the
removed implementation usually still sits in git history. But the course exists
so the student builds each feature, and restoring it skips exactly the part the
lesson is for.
**Rule:** do not search git history for a removed implementation of the lesson
feature, and do not revert or copy one. Design it from the lesson brief and the
current code: read the modules it touches for conventions, then write the
contract, schema, API and UI yourself.
**Where:** `README.md:76` (*What you build in the course*)

### 2026-09-15 — `@devdigest/shared` exists in two physical copies
**Symptom:** a contract change works in the API but the client still sends/reads
the old shape, with no type error anywhere.
**Cause:** `shared` is *vendored*, not linked — `server/src/vendor/shared/` and
`client/src/vendor/shared/` are separate trees, each aliased to
`@devdigest/shared` by its own tsconfig `paths`.
**Rule:** edit both copies in the same commit; typecheck both packages.
**Where:** `server/tsconfig.json:21`, `client/tsconfig.json:22` (`paths`)

### 2026-09-15 — migrations do not run on boot
**Symptom:** `relation "..." does not exist` on a fresh clone or after
`docker compose down -v`.
**Cause:** deliberate — `buildApp()` never migrates, so a dev process cannot
mutate a database schema by accident.
**Rule:** `cd server && pnpm db:migrate` before the first run and after every
schema change. pgvector is enabled by migration `0000`.
**Where:** `server/src/app.ts:41` (`buildApp`)
**Correction (2026-09-15):** pgvector is **not** enabled by migration `0000`;
`0000_init.sql` contains no `CREATE EXTENSION`. It is created by
`CREATE EXTENSION IF NOT EXISTS vector` inside `runMigrations()`, before the
migrator runs, so any path that applies the SQL files without going through
that function leaves the extension missing.

### 2026-09-15 — the packages are not a workspace
**Symptom:** `pnpm install` at the root does nothing useful; imports resolve in
the editor but not at runtime.
**Cause:** four standalone packages with four lockfiles; cross-package imports
work only through tsconfig `paths`, consumed as TypeScript source (tsx/vitest).
**Rule:** install and run inside each package directory.
**Where:** `README.md:8`

## Tool & Library Notes

### 2026-09-19 — a hook cannot see an inline `VAR=1 cmd` prefix, but a brand-new `.claude/settings.json` takes effect at once
**Symptom:** two surprises while wiring the first hook in this repo. A documented
bypass `PR_SELF_REVIEW_SKIP=1 gh pr create` did nothing, and the hook started
firing immediately after `.claude/settings.json` was created — no `/hooks`, no
restart.
**Cause:** the shell applies an inline env prefix when it runs the command, which
is *after* the hook has already decided, so `process.env` in the hook never holds
it. And the settings watcher did pick up a settings file that did not exist when
the session started, contrary to the usual caveat.
**Rule:** read an escape-hatch variable out of `tool_input.command`, not only out
of `process.env`. After creating a settings file, test the hook instead of
assuming a restart is needed — and instead of assuming it is live.
**Where:** `.claude/skills/pr-self-review/scripts/pr-guard.mjs:42` (the bypass
check), `.claude/settings.json:1`

## Recurring Errors & Fixes

### 2026-09-16 — a shell-scripted edit silently corrupts line endings, both ways
**Symptom:** two failures in one session. A `perl -0pi` pattern written with a
bare \n matched nothing in `.ts`/`.json` files, and its replacement left a lone
LF among CRLFs that later patterns then skipped. Then the opposite: rewriting
`INSIGHTS.md` as CRLF turned a 47-line append into a 133-line whole-file diff.
**Cause:** `core.autocrlf=true` and the blobs are stored LF, but the working
copy is not uniform — most source files sit there as CRLF while some Markdown
is LF. Neither `perl` nor a `node` string replace knows which it is holding.
**Rule:** count `\r\n` vs bare `\n` in the file before editing it, match what you
find in BOTH the pattern and the replacement, then confirm with
`git diff --numstat` that the line count moved by roughly what you added. A
whole-file diff means you flipped the endings, not that you edited the file.
**Where:** any tracked source file; the repo has no `.gitattributes`, so
`core.autocrlf` decides per file. `INSIGHTS.md:1` and
`server/src/modules/pulls/routes.ts:1` are the two this bit.

## Open Questions

- 2026-09-15 — should the session-end capture hook be scoped to the skill
  (`hooks:` in SKILL.md frontmatter, alive only while the skill is active) or
  registered globally in `.claude/settings.json`? Scoped keeps it off by default
  and matches how the skill is invoked today; global is the only way it fires on
  a session that never loaded the skill — which is exactly the session that most
  needs capturing. Answering it needs one run of each.
  `.claude/skills/engineering-insights/references.md`

## Session Notes

- 2026-09-15 — built the `engineering-insights` skill and restructured all five
  `INSIGHTS.md` files onto its seven fixed sections. Existing entries were
  remapped, not rewritten. Closed the loop in `CLAUDE.md` with a session
  protocol: read the file before touching a package, run the skill when a task
  ends.
- 2026-09-16 — implemented L01 Run Cost Badge across shared contracts, server
  and client. The plan leaned on the removal commit `d45ab0d`; that approach is
  now ruled out for lesson work (see *Codebase Patterns*).
- 2026-09-20 — L03 Conventions extractor, built across `server/`, `client/` and
  both `vendor/shared` copies from `specs/L02-conventions-extractor.md`, in a
  checkout shared with a second session finishing L02.
- 2026-09-19 — built the `pr-self-review` skill: a pre-PR router and gate that
  maps the open diff onto the repo's other skills, runs deterministic gates
  G1–G12 plus `pnpm arch`, and blocks `gh pr create` through the first
  `.claude/settings.json` hook in this repo. Severity, verdict and the block rule
  are read from the product's own contracts rather than invented.
