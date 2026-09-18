# Entries that pass the bar, and entries that don't

## Contents

- The test, in one line
- Vague vs useful
- Full entries by section
- Correcting an entry
- Things that look like insights but aren't

---

## The test, in one line

> Would an agent that has never seen this session read the entry and know exactly
> what to do?

If it needs the session's context to make sense, it is not an entry yet.

---

## Vague vs useful

| ❌ Noise | ✅ Lesson |
|---|---|
| "Promises can be tricky." | "`Promise.all()` on the ingest pipeline times out past 30 items — use `Promise.allSettled()` in batches of 10." |
| "Be careful with async." | "Checkout state goes through Zustand (`cartStore.ts`) because three components share the cart; local state silently desyncs them." |
| "Watch out for the ORM." | "Prisma Accelerate caps responses at 5 MB — use `select`, not `include`." |
| "Migrations can fail." | "`pnpm db:migrate` exits 0 on Windows without touching the database — verify with a table count in psql." |

The difference is not length. It is whether the entry names a thing you can act
on: a function, a threshold, a file, a command.

---

## Full entries by section

### What Doesn't Work

```markdown
### 2026-09-15 — two API processes on one database fight over run reaping
**Symptom:** a live run on process A is marked `failed` the moment process B boots.
**Cause:** boot-time reaping treats every `running` row as orphaned, because a
fresh process has no in-flight runs of its own to compare against.
**Rule:** one API per database. Replicas would need heartbeats or per-instance
scoping first — do not scale this out without adding them.
**Where:** `server/src/app.ts:41` (`buildApp`)
```

Note what makes it work: the failure is reproducible from the entry alone, and
`Rule:` blocks the tempting wrong move (just add replicas).

### Recurring Errors & Fixes

```markdown
### 2026-09-15 — a "missing" finding is the grounding gate, not the model
**Symptom:** the model clearly reported an issue and the UI shows fewer findings,
or none at all.
**Cause:** `groundFindings()` drops any finding whose line range does not
intersect a diff hunk for that file. Each drop is reported through `onEvent` and
lands in the run trace.
**Rule:** read the run trace before touching the prompt or switching models.
**Where:** `reviewer-core/src/grounding.ts:18`
```

This is the highest-value entry shape in the file: it redirects a debugging
session that would otherwise be spent in the wrong place.

### Tool & Library Notes

```markdown
### 2026-09-15 — pgvector is enabled by the migrate runner, not by a migration
**Symptom:** `type "vector" does not exist` on a database that is demonstrably up
and whose migrations all report as applied.
**Cause:** `0000_init.sql` contains no `CREATE EXTENSION`. The extension is
created by `CREATE EXTENSION IF NOT EXISTS vector` inside `runMigrations()`,
before the migrator runs — so anything that applies the SQL files without going
through that function leaves the extension missing.
**Rule:** enable the extension through `runMigrations()`, never by hand. If you
add a migration path that bypasses it, move the `CREATE EXTENSION` into
`0000_init.sql` instead of duplicating it.
**Where:** `server/src/db/migrate.ts:23`, `server/src/db/migrations/0000_init.sql`
```

### Codebase Patterns

```markdown
### 2026-09-15 — `@devdigest/shared` exists as two physical copies
**Symptom:** a contract change works in the API while the client still sends the
old shape, with no type error anywhere.
**Cause:** `shared` is vendored, not linked — `server/src/vendor/shared/` and
`client/src/vendor/shared/` are separate trees, each aliased to the same specifier
by its own tsconfig `paths`.
**Rule:** edit both copies in the same commit and typecheck both packages.
**Where:** `server/tsconfig.json:21`, `client/tsconfig.json:22` (`paths`)
```

The `Cause:` explains why an obvious-looking "fix" (make it a workspace package)
is not one. Without it, someone reverses the decision next month.

### What Works

```markdown
### 2026-09-15 — copy a neighbouring component folder before writing a new one
**Symptom:** a standalone `.tsx` reads fine alone but breaks every import
assumption and makes the diff unreviewable.
**Cause:** every component under `src/app/**/_components/` is a folder —
`<Name>.tsx` + `constants.ts` + `helpers.ts` + `styles.ts` + `index.ts` plus a
colocated test. The uniformity is deliberate.
**Rule:** copy the shape of the nearest sibling folder, then fill it in.
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx:26`
```

### Open Questions

Plain dated bullets — no four-field shape:

```markdown
- 2026-09-15 — does `selectMode()` need a token-count threshold instead of a line
  count? A 40-line minified diff costs more than a 400-line source diff, but
  nothing measures that yet. `reviewer-core/src/review/run.ts`
```

A good open question names what would answer it.

### Session Notes

One dated line, written last:

```markdown
- 2026-09-15 — traced empty review results to the grounding gate; added the
  run-trace rule. Left open whether `auto` should count tokens.
```

---

## Correcting an entry

Never delete, never rewrite. Append a dated correction to the entry:

```markdown
### 2026-03-02 — pgvector index build blocks writes on tables over 1M rows
**Symptom:** inserts hang during `CREATE INDEX`.
...
**Correction (2026-09-15):** superseded — pgvector 0.8 builds concurrently by
default. Keep the entry for anyone still on 0.7.
```

Two entries stating opposite rules with no correction line is worse than having
neither: an agent reading both picks one at random.

---

## Things that look like insights but aren't

| Draft | Why it gets dropped |
|---|---|
| "Added the `/repos/:id/pulls` endpoint." | A task log. Git already records this. |
| "`useEffect` runs after render." | Public API of the framework. |
| "Always validate input." | True in every repo, therefore says nothing about this one. |
| "The server uses Fastify and Drizzle." | Already in `server/CLAUDE.md`. One fact, one home. |
| "Something is weird with the seed script." | No `Where:`, no `Rule:`. Either finish the investigation or file it under Open Questions with a concrete next step. |
| "Fixed the flaky e2e test." | Names no cause. What made it flaky, and what stops it recurring? |
