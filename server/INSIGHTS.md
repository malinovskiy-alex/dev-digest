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

### 2026-09-19 — four modules query Drizzle straight from `routes.ts`, with no service
**Symptom:** `AGENTS.md` describes a routes → service → repository layering, but
`pulls`, `polling`, `settings` and `workspace` have no `service.ts` at all — their
route handlers import `drizzle-orm` and call `container.db` directly. A change to,
say, workspace scoping has to be made in both shapes.
**Cause:** the starter grew the layered shape only where a feature needed async
jobs (`repos`, `agents`, `reviews`, `repo-intel`); the read-mostly modules stayed flat.
**Rule:** do not copy the flat shape into a new module. New business logic goes in
`service.ts` and new SQL in `repository.ts`, even when the module is one endpoint —
and when you touch one of those four route files, move the query you touched down
rather than adding a sibling to it.
**Where:** `server/src/modules/pulls/routes.ts:238` (`container.db.delete`), plus
`settings/routes.ts:3`, `workspace/routes.ts:2`, `polling/routes.ts`

### 2026-09-19 — a service may `new` its repository, but nothing else
**Symptom:** `AGENTS.md` says "never construct an adapter with `new` inside a
service", yet every service opens with `this.repo = new XRepository(container.db)`.
Reads like a violation of the rule it sits next to.
**Cause:** the rule is about *adapters* — things with a port interface that tests
swap through `ContainerOverrides`. A repository has no port and no mock; it is
constructed from `container.db`, which is itself injectable. Cross-module
repositories are the exception and hang off the container (`container.reviewRepo`).
**Rule:** `new` a repository inside its own module's service; resolve everything
else — adapters, other modules' repositories — off the container. Do not "fix" the
`new XRepository` lines.
**Where:** `server/src/modules/repos/service.ts:36` (`RepoService` constructor),
container-owned exceptions at `server/src/platform/container.ts:96` (`agentsRepo`)

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

### 2026-09-19 — dependency-cruiser group references are `$1`, not `\1`
**Symptom:** the "a module must not import a sibling module" rule reported 61
violations, nearly all of them imports a module makes *inside itself*
(`repo-intel/service.ts → repo-intel/constants.ts`).
**Cause:** the rule was written as a negative lookahead with a backreference,
`to.path: '^src/modules/(?!\\1|_shared)[^/]+/'`. dependency-cruiser does not
evaluate `\1`; it substitutes a group captured in `from.path` into the `to`
clause as **`$1`**, and only there.
**Rule:** express "same module" as
`from: { path: '^src/modules/([^/]+)/' }` plus
`to: { path: '^src/modules/([^/]+)/', pathNot: '^src/modules/($1|_shared)/' }`.
After the fix the same rule reports one real violation. Also keep
`options.tsPreCompilationDeps: true` — without it type-only imports are
invisible, and most boundary leaks in this codebase are type-only.
**Where:** `server/.dependency-cruiser.cjs:121` (`no-cross-module`)

### 2026-09-19 — a pnpm path in the dep-cruiser baseline breaks on the next upgrade
**Symptom:** `.dependency-cruiser-known-violations.json` recorded edges as
`node_modules/.pnpm/drizzle-orm@0.38.4_postgres@3.4.9/node_modules/drizzle-orm/index.d.ts`.
**Cause:** pnpm resolves every package through its versioned virtual store, and
dependency-cruiser baselines the resolved path. A routine dependency bump
changes that string, so a *known* violation stops matching and `pnpm arch` fails
for a reason unrelated to the change. `enhancedResolveOptions.symlinks` would
avoid it but the 17.4.3 config schema rejects the key.
**Rule:** never let a node_modules edge into the baseline. Rules that carry debt
match source paths only (`^src/db/schema` — no real query exists without it);
keep package-name patterns only in rules that have zero violations.
**Where:** `server/.dependency-cruiser.cjs:96` (`routes-no-db`), baseline at
`server/.dependency-cruiser-known-violations.json`

### 2026-09-19 — `dependency-cruiser` is already installed, so import-boundary linting costs nothing
**Symptom:** enforcing layering looks like it needs a new devDependency and a CI
decision.
**Cause:** `dependency-cruiser@^17.4.3` is a **runtime** dependency here — the
`depgraph` adapter calls its `cruise()` API to build the repo-intel import graph.
There is no `.dependency-cruiser.*` config anywhere in the repo, so its rule
engine is unused.
**Rule:** to forbid a cross-layer import (routes → `drizzle-orm`, service →
`adapters/*`), add a `forbidden` rule to a new `server/.dependency-cruiser.cjs`
and a `depcruise` script — do not install a second architecture linter, and do not
drop the package thinking it is dev-only tooling.
**Where:** `server/src/adapters/depgraph/index.ts:17` (`import { cruise }`),
`server/package.json:24`

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
- 2026-09-19 — planned an `onion-architecture` skill: audited the server's rings
  (ports in `shared/adapters.ts`, adapters, container, modules) and recorded the
  layering divergences found.
- 2026-09-19 — built the skill on branch `skill/onion-architecture`: four rings
  documented in `.claude/skills/onion-architecture/`, enforced by
  `server/.dependency-cruiser.cjs` + `pnpm arch` with the 21 current violations
  grandfathered in a baseline and planned out in `specs/onion-debt.md`. Nothing
  under `src/` changed; `pnpm typecheck` and `pnpm arch` both exit 0.
