# Insights — server

Append-only. Format, sections and cross-package entries:
[../INSIGHTS.md](../INSIGHTS.md). Covers `src/modules/repo-intel` too.

---

## What Works

*(nothing yet)*

## What Doesn't Work

### 2026-09-20 — `drizzle-kit generate` blocks forever when one migration both adds and drops a column
**Symptom:** `pnpm db:generate` printed
`Is scan_id column in conventions table created or renamed from another column?`
with a two-option arrow menu and never returned; the 120 s tool timeout killed
it and nothing was written. `yes '' | pnpm db:generate` failed the same way
(exit 143) — the prompt reads the TTY, not stdin, so it cannot be answered from
a non-interactive shell at all.
**Cause:** drizzle-kit asks, per added column, whether it is a rename of a column
dropped in the same diff. The schema change that triggered it added six columns
to `conventions` and dropped `accepted`, so every added column was a rename
candidate.
**Rule:** never let one schema edit add and drop columns in the same
`db:generate`. Generate in two passes — keep the doomed column in the schema for
the first (adds + new tables only, no prompt), remove it for the second (a pure
drop prompts nothing) — then fold the second SQL file into the first, delete the
second's journal entry, and move its snapshot over the first's with `prevId`
re-pointed at the migration before them. Confirm with a third `db:generate`: it
must say *No schema changes*.
**Where:** `server/src/db/migrations/0013_conventions_extract.sql:21` (the folded
`DROP COLUMN`), `server/package.json:15` (`db:generate`)

### 2026-09-20 — a runtime import from `vendor/shared` breaks the whole client
**Symptom:** every route 500s with
`./src/vendor/shared/index.ts: Can't resolve './contracts/findings.js'`, while
`pnpm typecheck` and all 111 client tests are green.
**Cause:** the vendored barrel re-exports with Node-style `./contracts/*.js`
specifiers. Vitest (vite) maps `.js` → `.ts`; the Next bundler does not. Until
L02 every `@devdigest/shared` import in `client/` was `import type`, erased
before any bundler saw it — so the barrel had never actually been bundled. The
first runtime import (`SkillType.options` for a picker) was enough to break
`next dev` and `next build` everywhere, not just on the new screen.
**Rule:** in `client/`, import **types only** from `@devdigest/shared`. A
runtime value belongs in `src/lib/` as a local const with a compile-time
exhaustiveness check against the contract — see `src/lib/skill-types.ts`.
And **run `pnpm build`**: neither the unit suite nor `tsc` can see this class of
failure.
**Where:** `client/src/vendor/shared/index.ts:17`, `client/src/lib/skill-types.ts`


### 2026-09-20 — parallel integration files silently skip themselves
**Symptom:** `pnpm exec vitest run .it.test` reports *3 passed, 6 skipped* with
`Docker not available — skipping integration tests`, on a machine where Docker
is running and where each of those files passes 12/12 when run **alone**. The
suite stays green, so the skip is invisible unless you read the file counts.
**Cause:** `test/helpers/pg.ts:27` probes with
`execSync('docker info', { timeout: 5000 })`. Vitest runs the files in parallel
workers, the cache (`dockerCache`) is per-worker, so every worker shells out at
once. Under that contention Docker Desktop on Windows regularly takes longer
than 5 s, the probe throws, and the worker caches `false` and skips the file.
**Why it matters:** a genuinely failing integration test is reported as
*skipped*, not as a failure. "Both suites pass" means much less than it looks.
**Rule:** when an integration run matters, check the **passed/skipped counts**,
not just the exit code — and re-run any skipped file on its own before believing
it. Adding integration files makes this worse: L02 took the suite from 6 files
to 9 and the skipping became routine.
**Where:** `server/test/helpers/pg.ts:23-33`


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

### 2026-09-20 — a feature module resolves its model through the container, never by importing `settings`
**Symptom:** the conventions service needs a provider+model, and the obvious
`import { resolveFeatureModel } from '../settings/feature-models.js'` fails
`pnpm arch` with `no-cross-module`. Moving the call behind the Container then
failed `no-circular`, because `feature-models.ts` took a `Container` and the
Container now imported it.
**Cause:** two arch rules close the obvious routes from both ends. Only the
composition root may know about several modules at once, and it can only do that
if the module it calls does not know about *it*.
**Rule:** call `container.featureModel(workspaceId, id)`. Anything else the
`settings` module owns and another module needs gets the same treatment: a thin
accessor on the Container, and the underlying function takes `Db` (or another
leaf dependency), never the Container. `tsPreCompilationDeps: true` means a
type-only `import type { Container }` still counts as the cycle.
**Where:** `server/src/platform/container.ts:247` (`featureModel`),
`server/src/modules/settings/feature-models.ts:56` (`resolveFeatureModel`, now
`db: Db`)

### 2026-09-20 — `pnpm typecheck` does not cover `test/`
**Symptom:** a test file with a genuine type error passes `pnpm typecheck`
clean, then fails at runtime — or, worse, never fails, because the error is in a
branch vitest does not reach. Two people hit this independently in one day while
building L02.
**Cause:** `server/tsconfig.json` sets `"include": ["src/**/*.ts"]`. The test
directory is outside it, so `tsc --noEmit -p tsconfig.json` never sees a single
file under `test/`.
**Rule:** when a test file's types matter, typecheck it explicitly — a scratch
tsconfig that `extends` the server one and includes `test/**/*.ts` does it in one
command. Do not assume a clean `pnpm typecheck` says anything about your tests.
**Where:** `server/tsconfig.json`


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

### 2026-09-20 — `--no-file-parallelism` is the fix for the integration suite skipping itself
**Symptom:** `pnpm exec vitest run .it.test` reported **3 passed / 7 skipped**
(20 of 73 tests) on a machine with Docker running — the failure mode already
recorded under *What Doesn't Work* (2026-09-20, "parallel integration files
silently skip themselves"). That entry's advice is to re-run each skipped file
alone, which is nine commands and several minutes.
**Cause:** same one — `dockerAvailable()` shells out to `docker info` with a 5 s
timeout, per worker, all at once. Serialising the files serialises the probes, so
the first one warms Docker Desktop and the rest hit the per-worker cache well
inside the timeout.
**Rule:** run the integration suite as
`pnpm exec vitest run .it.test --no-file-parallelism`. It reported **10 passed /
73 tests / 0 skipped** on the same tree that had just skipped seven files. Treat
a parallel run's green as unproven — check the skipped count either way.
**Correction (2026-09-20):** the title overstates it. A second session on this
machine ran the same `.it.test` command WITHOUT the flag and got 10 files /
73 tests / 0 skipped, having seen 3 passed / 6 skipped from it earlier the same
day. So the parallel run is flaky under machine load, not deterministically
broken, and `--no-file-parallelism` buys reliability rather than fixing a
certain failure. The Rule stands and its second sentence is the load-bearing
one: **read the skipped count**, because a suite that reports only "passed" is
saying nothing about the files it never ran.
**Where:** `server/test/helpers/pg.ts:27` (`execSync('docker info', …)`)

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
- 2026-09-20 — Conventions extractor (L02): new `modules/conventions/` (sample →
  model → evidence gate → store), migration `0013_conventions_extract`
  (`convention_scans` + six columns on `conventions`, `accepted` dropped), the
  first caller of `FEATURE_MODELS`, and `src/prompts/conventions.system.md`.
  18 unit + 13 integration tests.
- 2026-09-19 — built the skill on branch `skill/onion-architecture`: four rings
  documented in `.claude/skills/onion-architecture/`, enforced by
  `server/.dependency-cruiser.cjs` + `pnpm arch` with the 21 current violations
  grandfathered in a baseline and planned out in `specs/onion-debt.md`. Nothing
  under `src/` changed; `pnpm typecheck` and `pnpm arch` both exit 0.
