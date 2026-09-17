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
**Where:** path/to/file.ts
```

Append only — never edit or delete an entry. Something proven wrong gets
`**Correction (YYYY-MM-DD):**` appended to it.

---

## What Works

*(nothing yet)*

## What Doesn't Work

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
**Where:** `server/clones/`, `.gitignore`

## Codebase Patterns

### 2026-09-16 — a missing feature is often a revert, not a gap
**Symptom:** per-run cost was specced as new work; it turned out to exist in
full upstream — `ReviewOutcome.costUsd`, the `PriceBook`, OpenRouter's
`usage.cost` — and to be dropped only at the last three hops.
**Cause:** the starter is the finished product with features *removed*, so a
lesson feature usually has an amputation commit behind it. Here it was
`d45ab0d` ("feat(reviews): remove per-PR/run cost, keep model pricing"), whose
migration `0009` dropped `agent_runs.cost_usd`.
**Rule:** before planning a lesson feature, run
`git log --all --oneline -S'<symbol>' -- <path>` and read the removal commit.
It names exactly which layers to restore and which were deliberately kept, and
it turns a green-field estimate into a targeted revert.
**Where:** `server/src/db/migrations/0009_complex_runaways.sql`

### 2026-09-15 — `@devdigest/shared` exists in two physical copies
**Symptom:** a contract change works in the API but the client still sends/reads
the old shape, with no type error anywhere.
**Cause:** `shared` is *vendored*, not linked — `server/src/vendor/shared/` and
`client/src/vendor/shared/` are separate trees, each aliased to
`@devdigest/shared` by its own tsconfig `paths`.
**Rule:** edit both copies in the same commit; typecheck both packages.
**Where:** `server/tsconfig.json`, `client/tsconfig.json`

### 2026-09-15 — migrations do not run on boot
**Symptom:** `relation "..." does not exist` on a fresh clone or after
`docker compose down -v`.
**Cause:** deliberate — `buildApp()` never migrates, so a dev process cannot
mutate a database schema by accident.
**Rule:** `cd server && pnpm db:migrate` before the first run and after every
schema change. pgvector is enabled by migration `0000`.
**Where:** `server/src/app.ts`
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
**Where:** `README.md`

## Tool & Library Notes

*(nothing yet)*

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
**Where:** any tracked source file

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
  and client. The plan came out of reading `d45ab0d` rather than the mockups
  alone, which cut the work to a targeted revert plus one new PR-list column.
