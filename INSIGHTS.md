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

*(nothing yet)*

## Codebase Patterns

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

*(nothing yet)*

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
