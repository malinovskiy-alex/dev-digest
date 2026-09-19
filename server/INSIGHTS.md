# Insights — server

Append-only. Format, sections and cross-package entries:
[../INSIGHTS.md](../INSIGHTS.md). Covers `src/modules/repo-intel` too.

---

## What Works

*(nothing yet)*

## What Doesn't Work

### 2026-09-15 — a DB test named `*.test.ts` poisons the unit suite
**Symptom:** the hermetic run (`--exclude '**/*.it.test.ts'`) suddenly needs
Docker, and `server-unit.yml` fails on a machine without it.
**Cause:** the suites are split purely by filename; a test importing
`test/helpers/pg.ts` under the wrong suffix lands in the unit set.
**Rule:** anything touching Postgres is `*.it.test.ts`. No exceptions.
**Where:** `server/README.md:137`, `.github/workflows/server-unit.yml:98`

### 2026-09-15 — two API processes on one database fight over run reaping
**Symptom:** with two API processes on one database, a live run on process A is
marked failed when process B boots.
**Cause:** the reaper treats every `running` row as orphaned, since a fresh
process has no in-flight runs of its own.
**Rule:** one API per database. Multiple replicas would need heartbeats or
per-instance scoping first.
**Where:** `server/src/app.ts:75` (the run reaper)

## Codebase Patterns

### 2026-09-17 — the PR list's findings tally and a run's `blockers` count differently
**Symptom:** a PR shows `1 CRITICAL` in the list's Findings column while its run
row reports `0 blockers`, and the two look like they should agree.
**Cause:** they are different metrics. `PrMeta.findings` (via `rollupSeverities`)
counts every finding of the latest review, dismissed ones included, because the
PR detail page still renders a dismissed finding — greyed, but present — and the
column has to match what the reader will see. `agent_runs.blockers` is a CI-gate
number and excludes `dismissed_at`.
**Rule:** do not "fix" one into the other. If you change either definition, change
the comment at the other so the next reader finds the disagreement explained
rather than discovered.
**Where:** `server/src/modules/pulls/routes.ts:162` (the severity rollup),
`client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:56`

### 2026-09-16 — the PR list shows only the 50 most recently updated PRs
**Symptom:** a repo with 12 open PRs on GitHub lists 6 of them; the missing ones
are the open PRs updated longest ago.
**Cause:** `listPullRequests` makes one `pulls.list` call with `state: 'all'`,
`sort: 'updated'`, `per_page: 50` and never paginates. In a repo with many
recently closed PRs, the closed ones fill the page and push older open PRs off it.
**Rule:** do not read a missing PR as a sync failure — compare its `updated_at`
with the oldest PR on page one first. Anything that needs every open PR must
fetch `state: 'open'` separately, with pagination.
**Where:** `server/src/adapters/github/octokit.ts:36` (`listPullRequests`)

### 2026-09-15 — modules are encapsulated, so registration order decides behaviour
**Symptom:** a route ignores the rate limit or misses a security header.
**Cause:** Fastify plugin encapsulation — a module registered before helmet /
cors / rate-limit / the error handler does not inherit them.
**Rule:** anything cross-cutting registers in `buildApp()` above the module loop.
**Where:** `server/src/app.ts:89` (helmet / cors / rate-limit registration)

## Tool & Library Notes

### 2026-09-18 — current Anthropic models reject `temperature` with a 400
**Symptom:** a review run against `claude-opus-5` or `claude-sonnet-5` fails the
whole request; the run is recorded `failed` with `cost_usd` null, so the PR
list's Cost column reads `—` forever and nothing on screen says why.
**Cause:** Anthropic removed the sampling parameters (`temperature`, `top_p`,
`top_k`) with the current generation — Opus 4.7 and everything after it. Opus
4.6, Sonnet 4.6 and Haiku 4.5 still accept them, which is why the one Anthropic
agent seeded here (Haiku) never hit it.
**Rule:** route every Anthropic request through `samplingFor(model, temp)` and
keep it an ALLOW-list. `listModels()` is a live `GET /models`, so the studio
offers ids this repo has never heard of; omitting `temperature` for an unknown
model costs determinism, while sending it costs the whole run.
**Where:** `src/adapters/llm/anthropic.ts:42` (`samplingFor`), applied at
`src/adapters/llm/anthropic.ts:99` and `:134`

## Recurring Errors & Fixes

### 2026-09-16 — the PR list is empty while GitHub has PRs
**Symptom:** `/repos/:id/pulls` renders an empty state and `GET /repos/:id/pulls`
returns `[]`, with no error in the UI. The API log shows
`GitHub PR sync skipped` and a `401 Bad credentials` from api.github.com.
**Cause:** the route is local-first: every read tries a GitHub sync, catches any
failure, logs a warning and serves the PRs already in the database. A repo that
has never synced has none, so an expired token looks exactly like a repo
without PRs.
**Rule:** on an empty PR list, check the API log for `GitHub PR sync skipped`
before anything else. The fix is a fresh token in Settings (written to
`~/.devdigest/secrets.json`); no restart needed, the next list request syncs.
**Where:** `server/src/modules/pulls/routes.ts:37` (`GET /repos/:id/pulls`)

## Open Questions

*(nothing yet)*

## Session Notes

- 2026-09-16 — per-run cost (L01): `agent_runs.cost_usd` via migration `0010`,
  served on the runs list, the trace and the PR list. Also priced the current
  Anthropic models in `adapters/llm/pricing.ts`.
- 2026-09-17 — findings by severity (L02): `PrMeta.findings` on
  `GET /repos/:id/pulls`, rolled up by the previously dead `rollupSeverities`,
  whose keys moved to the `Severity` enum casing. Third "latest per PR" rollup in
  that route, after score and cost — all three share the one-IN-query + JS
  grouping shape.
