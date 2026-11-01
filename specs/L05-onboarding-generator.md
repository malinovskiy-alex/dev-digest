# L05 — Onboarding Generator · implementation plan

**Requirements:** `specs/L05-onboarding-generator.requirements.md` (Status: Approved, 2026-10-31, **AC-01 … AC-88**, as amended on 2026-10-31: AC-21, AC-33, AC-40 and AC-72 changed; AC-86, AC-87 and AC-88 added)
**Execution:** multi-agent, given by the caller on 2026-10-31 (D-36). Same shape as `specs/L05-project-context.md` `## Execution`, with the e2e step routed to `implementer` (`INSIGHTS.md:48-52`)
**Branch:** `lesson/L05-onboarding-generator` (never `main`)
**Plan status:** complete and executable, revision 5 (2026-11-01). Revision 5 is wording only, after the pre-merge round (F-52…F-61):
- `source_unreadable` failure code, and facts are never cached after a git or importer-read failure (contract, D-20, step 22 i18n);
- incremental `filesIndexed` uses the full pass's terms (D-23, AC-87);
- the open-PR query is SQL-only (D-17);
- the same-stem test rule is limited by location (D-16);
- the skeleton critical-paths gap is `needs_index` when nothing is ranked.

Revision 4 (2026-11-01). Revision 4 changes wording and decisions only, to match what shipped after review and fix rounds (`findings.md` F-08…F-42):
- AC-83 is 10,000 output tokens;
- the facade gains `countIndexedFiles` and `getImporters` (INV-2);
- the prose guarantee lives at render in `inertLinks`, and the server scrub is best effort and insertion-only (D-26, R-2);
- generation ids own the lock (D-43);
- `TourLogger` (INV-9, R-11);
- D-16 uses importers;
- `## Visual design` was added (F-42).

Revision 3 (2026-11-01). Revision 3 changes wording only, to match fix round 1 (`findings.md` F-01, F-02, F-03, F-05): the generation is a JobRunner job (D-3), `statusLines` lives in `TourHeader/helpers.ts`, there is an `EXCLUDED_DIRS` parity test, and R-10 is new. Revision 2:
- The user decided REC-1 (a), REC-2 (a), REC-3 accepted (→ AC-86) and REC-4 accepted (→ AC-87).
- The cross-model (Sonnet) review `.devdigest/cache/sdd/L05-onboarding-generator/plan-review.md` ("approve with changes") is addressed. Every BLOCKER and MAJOR is fixed. The MINORs are handled in D-43 … D-50, and the ones rejected say why there.
- No open question remains.
- Only `implementation-planner` edits this file.

**How to read this plan cold.** You do not need the planner's conversation. You need four things: this file, the requirements file, the `INSIGHTS.md` lines cited in `## Constraints`, and the code paths named in each step. Every AC is traced from the requirements, to a step (`## Steps`), to a test step, to a commit (`## AC coverage matrix`). Where an AC leaves a detail open, a `D-n` in `## Decisions` fixes it, and the tests cite that `D-n`.

---

## Requirements check

Every ID from the requirements file. "already holds" means nothing is built, only tested. "planner detail" means the AC is buildable, but one detail was fixed by a `D-n`.

| Req | Verdict | Note | → |
|---|---|---|---|
| AC-01 | ok | `nav.ts:33-40` WORKSPACE has `pulls`, `context`. Insert between them. The label key `onboarding-tour` already exists (`shell.json:19`) | step 12 |
| AC-02 | ok | new route `client/src/app/repos/[repoId]/tour/` | step 14 |
| AC-03 | already holds | `/onboarding` is not touched. Flow `06` is unchanged | step 32 (run 06) |
| AC-04 | ok | `activeKeyFor` gets a `/repos/<id>/tour` rule | step 12 |
| AC-05 | ok | today `helpers.ts:29` maps any path containing `/onboarding` to `onboarding-tour`. That rule is removed | step 12 |
| AC-06 | ok | | steps 14, 15 |
| AC-07 | ok | `TourSections` always has five keys, and the client renders five sections in every state | steps 1, 7, 14 |
| AC-08 | ok | | step 16 |
| AC-09 | ok | | step 16 |
| AC-10 | ok | | step 16 |
| AC-11 | ok | | step 16 |
| AC-84 | ok | `provider`, `model` and `cost_usd` are stored in the tour envelope (D-4). The tooltip is a `title` (D-28) | steps 1, 10, 15 |
| AC-12 | planner detail | N = number of ranked files in the index at generation (D-23). The time is `generated_at` | steps 7, 10, 15 |
| AC-13 | planner detail | `coverage_partial = stats.bounded > 0 OR stats.softBudgetReached`, and M = `stats.totalCandidates` (D-23). Today incremental refresh drops those stats keys (`incremental.ts:245-255`). Step 2 writes them from the walk that the incremental pass already runs (AC-87) | steps 2, 7, 15 |
| AC-87 | needs a repo-intel fix | two problems today. M is lost after a refresh: incremental `stats` have no `totalCandidates`/`bounded`. N drifts: `newFilesIndexed = state.filesIndexed + filesIndexed` (`incremental.ts:260`) re-adds re-parsed files. Step 2 keeps the result of `walkClone` (`incremental.ts:218`) and writes `totalCandidates`, `bounded` and `skippedTooLarge` from **that** walk. Rev. 5 (F-54): it no longer adds to the old total. `filesIndexed` is computed with the full pass's terms through `refreshCounts`: the parsed walked files, with parse failures kept in `filesSkipped` and `indexed + skipped ≤ totalCandidates`. The tour's N is the `file_rank` row count either way (D-23) | steps 2, 7, 10 |
| AC-86 | ok (new, REC-3) | `GET` checks the key **without any model call and without building a provider client**, through a new `container.hasLlmKey(provider)` (D-42). Contract field `api_key`, plus `blockers` with a fixed precedence (D-41). Flow 09 keeps passing on the uncloned seed repo: both lines show, and the flow asserts the not-cloned line only | steps 1, 7, 10b, 10c, 11, 14, 15, 22 |
| AC-17 | ok | | step 14 |
| AC-18 | ok | | step 14 |
| AC-19 | ok | reuses `RepoNotFound` + `useRepoNotFound` (`repo-context.tsx:69`). The API uses `requireRepoInWorkspace` (`_shared/context.ts:35`) | steps 11, 14 |
| AC-14 | ok | | steps 7, 15 |
| AC-15 | planner detail | "has no file ranking" = `getIndexedFiles()` returns `[]`. The reason string is defined in D-24 | steps 2, 7, 15 |
| AC-16 | ok | | steps 7, 15 |
| AC-20 | planner detail | the stack, folder, route, script and candidate rules are in D-6 … D-19 | steps 2, 4, 10 |
| AC-21 | ok (amended) | the module makes exactly one `completeStructured` call with `maxRetries: 0`, so there is no schema re-ask or repair. The adapters' transport retries on 429/5xx before a usable answer stay as they are, and the AC allows them. For OpenAI/Anthropic, `withRetry` defaults to `retries ?? 3` (`resilience.ts:47`), so **up to 4** HTTP requests. For OpenRouter, the SDK's `maxRetries: 2` (`openrouter.ts:55`) gives up to 3. reviewer-core is unchanged (D-40) | steps 3, 10 |
| AC-22 | ok | `container.featureModel(ws, 'onboarding')` (`container.ts:265`, `server/INSIGHTS.md:110`) | step 10 |
| AC-23 | needs a repo-intel fix | ties are not broken today: `getRankedPaths` orders by `rank` only (`repo-intel/repository.ts:449-459`), and `getCriticalPaths` sorts adjacency by rank only (`repo-intel/service.ts:687-689`). Postgres tie order is arbitrary. Step 2 adds `path asc` tie-breaks | steps 2, 4 |
| AC-24 | ok | upsert on `onboarding.repo_id` (PK, `context.ts:120-126`), with the revision in the JSON envelope (D-4) | steps 8, 10 |
| AC-25 | ok | `GET` never resolves an LLM | step 10 |
| AC-26 | ok | | steps 7, 10, 14, 15 |
| AC-27 | ok | `POST …/tour/generate` → 202, then the client polls (D-2, D-39) | steps 10, 11, 13, 15 |
| AC-28 | ok | an in-process per-repo registry gives 409 `tour_generation_running` with the exact message (D-3) | steps 10, 11, 13, 15 |
| AC-29 | ok | the generation is a JobRunner job, so it outlives the request (D-3) | steps 10, 13 |
| AC-30 | ok | | steps 9, 18 |
| AC-31 | planner detail | the server wraps known bare paths in backticks (D-26). The client renders code spans verbatim | steps 6, 18 |
| AC-32 | ok | hand-drawn SVG, no dependency (INV-5) | step 18 |
| AC-33 | ok (amended) | a component survives only if its `ref` is an **indexed** file path, a top-level folder, or a dependency name of a manifest read under AC-68. A tree path does not count, and the compose file is never read (D-11, D-12) | steps 6, 9 |
| AC-85 | ok | | steps 6, 18 |
| AC-34 | planner detail | root-level files are not a "folder" (D-6) | steps 4, 7, 18 |
| AC-35 | ok | flatten `getCriticalPaths` chains, de-duplicate, take 6 | steps 2, 4 |
| AC-36 | ok | the server sends `importers` + `top_percent` + a nullable model `reason`. The client words the fallback (D-14) | steps 4, 6, 19 |
| AC-37 | ok | `githubBlobUrl(full_name, revision, path)` (`github-urls.ts:24`) | step 19 |
| AC-38 | ok | | steps 4, 7, 19 |
| AC-39 | ok | | step 20 |
| AC-40 | ok (amended) | `package.json` is the only manifest. Install **only** from a lockfile (no lockfile → no install command). Env-example copy. `docker compose up -d` from the file name. Scripts only from the AC's allow-list `dev, start, serve, build, test, migrate, db:migrate, seed, db:seed`. A manifest dir whose name is not shell-safe is skipped (D-7, D-9, D-44) | step 4 |
| AC-41 | planner detail | the model sends command **ids**. Unknown ids are dropped (D-10) | step 6 |
| AC-88 | ok (new) | derived commands the model omitted are appended after the model-ordered ones, in derivation order, with `comment: null` (D-10) | step 6 |
| AC-42 | ok | | steps 17, 20 |
| AC-43 | ok | | step 20 |
| AC-44 | ok (structural) | holds by construction: the module never imports `child_process`/`node:fs` and calls only the read methods `listFilesAt`/`readFileAt`/`currentHead` of `GitClient` (INV-7). The tests are a guard plus a behavioural spy on every `GitClient` method | step 10 |
| AC-45 | ok | | steps 4, 7, 20 |
| AC-46 | needs a repo-intel fix | the tie-break `path asc` is missing (see AC-23). The formula is unchanged: `rank = pagerank` today, and `hotness = 0` (`rank.ts:49-52`) | steps 2, 4 |
| AC-47 | needs a repo-intel fix | `JUNK_PATH_PATTERNS` (`repo-intel/service.ts:713-728`) matches `/test/`, `/tests/`, `/migrations/` only below the root. A root-level `test/x.ts` or `migrations/x.ts` passes today, and a plain `fixtures/` dir is not excluded. Step 2 fixes the matching (D-25) | step 2 |
| AC-48 | ok | | steps 4, 19 |
| AC-49 | ok | | steps 4, 6, 19 |
| AC-50 | planner detail | "in a different order" = the monotone rule in D-13 | step 6 |
| AC-51 | ok | | steps 7, 19 |
| AC-52 | planner detail | the scan set, the regex, ids and the missing-test rule are in D-15, D-16, D-17 | steps 4, 8, 10 |
| AC-53 | planner detail | the tie rules are in D-18 | step 4 |
| AC-54 | ok | | steps 6, 21 |
| AC-55 | ok | | step 6 |
| AC-56 | ok | the server marks fallback tasks `source: 'fallback'`. The client renders the fixed title from i18n | steps 6, 7, 21 |
| AC-57 | ok | | step 21 |
| AC-58 | ok | no clone → build only from DB rows (repo, index state, open PRs) | steps 7, 8, 10, 21 |
| AC-59 | ok | | steps 7, 21 |
| AC-60 | planner detail | "existing injection guard" = the `SECURITY:` paragraph of `onboarding.system.md:11-12`. reviewer-core's `INJECTION_GUARD` is not exported (`prompt.ts:16`) and stays as it is (D-27) | steps 5, 9 |
| AC-61 | planner detail | the known-path set and the prose scrub are in D-26. Rows, tasks and their links hold only paths taken from the facts, never from model text, so a model-supplied unknown path cannot reach them (steps 4, 6, 7) | steps 4, 6, 7 |
| AC-62 | already holds in the renderer | `UntrustedMarkdown` (`components/untrusted-markdown/UntrustedMarkdown.tsx:11-12,31-55`): no raw HTML, no `<img>`, relative links inert. Reused, still tested | step 18 |
| AC-63 | ok | SVG `<text>`, React-escaped, with no handlers or links | step 18 |
| AC-64 | ok | the env-example parser extracts names only. No `.env` path is ever read (D-8) | steps 4, 10 |
| AC-65 | ok | `requireRepoInWorkspace` before every id use, and open PRs are scoped by `workspace_id` | steps 8, 10, 11 |
| AC-66 | ok | | steps 3, 5 |
| AC-67 | ok | | step 5 |
| AC-68 | ok | all reads go through `GitClient.readFileAt` at one sha, each capped at 6,000 chars | steps 4, 10 |
| AC-83 | ok (amended, rev. 4) | `maxTokens: 10000`. The user raised it from 4,000 after F-37: the default model's reasoning tokens used up the 4,000 cap (`finish_reason: length`), and the answer came back as `invalid_output` | steps 3, 10 |
| AC-69 | ok | | steps 5, 7, 15 |
| AC-70 | planner detail | a missing key is detected by `container.llm(provider)` throwing `ConfigError` (`container.ts:218-238`), before any request. → 422 `tour_no_api_key` plus a recorded failure (D-22) | steps 10, 11, 15 |
| AC-71 | ok | `withTimeout(…, 120_000)` around the call (D-21). Nothing is stored | steps 10, 14, 15 |
| AC-72 | planner detail (amended) | provider "schema validation" errors are classified `invalid_output`, with `failure.message = "the model returned invalid output"`. There is no second call, because `maxRetries: 0` (D-20) | steps 6, 10 |
| AC-73 | ok | the failure is kept in memory. The stored tour is untouched. The notice is dismissed locally (D-32) | steps 10, 15 |
| AC-74 | planner detail | `outdated = stored.revision !== indexState.lastIndexedSha` (D-5) | steps 7, 15 |
| AC-75 | ok | | steps 15, 17 |
| AC-76 | ok | | step 17 |
| AC-77 | ok | | step 17 |
| AC-78 | ok | reuses `middleTruncate` (`lib/context-docs.ts:183`) with the full path in `title` | step 19 |
| AC-79 | ok | | step 19 |
| AC-80 | ok | Tailwind `lg:` (1024 px) | step 16 |
| AC-81 | ok | | step 16 |
| AC-82 | ok | the seeded demo repo has `clonePath: null` (`server/src/db/seed.ts:200`), so the tour is the AC-58 skeleton with all five titles. No seeding and no model call (D-34) | step 32 |

**Totals (88 IDs):** 67 ok (incl. the amended AC-21, AC-33, AC-40 and the new AC-86, AC-88) · 2 already hold (AC-03, AC-62) · 15 planner detail (AC-12, 13, 15, 20, 31, 34, 41, 50, 52, 53, 60, 61, 70, 72, 74) · 4 need a repo-intel fix (AC-23, AC-46, AC-47, AC-87) · **0 blocked, 0 open**.

---

## Decisions

D-1 … D-35 are routine calls by the planner. Each says what the implementation and the tests take as given. D-36 and D-37 come from the caller. D-12 and D-40 are the user's decisions on REC-2 and REC-1. D-41 … D-50 come from revision 2 (the AC amendments and the cross-model review); D-48 … D-50 record the review findings that were rejected or narrowed, with the reason.

| ID | Question | Answer | Source |
|---|---|---|---|
| D-1 | Module and file layout | New server module `server/src/modules/onboarding/`. Pure code is split **by subject** into `helpers.ts` files, because the arch `DOMAIN` regex classifies only `…/helpers.ts` as Ring 1 (`.dependency-cruiser.cjs:55`), so `core-no-io` checks those files only: `facts/helpers.ts`, `prompt/helpers.ts`, `grounding/helpers.ts`, `helpers.ts` (tour assembly). Plus `constants.ts`, `schema.ts`, `repository.ts`, `service.ts`, `routes.ts`. Precedent: `reviews/smart-diff/helpers.ts` | planner |
| D-2 | API shape | `GET /repos/:id/tour` → `OnboardingTour` (never calls a model). `POST /repos/:id/tour/generate` → **202** `{ running: true }` once the pre-checks pass and the generation has started. 404 for an unknown or foreign repo. 409 `tour_generation_running` "A tour is already being generated". 422 `tour_not_cloned`, `tour_index_not_ready`, `tour_no_api_key`. No other endpoints | planner |
| D-3 | Where the generation runs (rev. 3, findings F-03) | As a **`JobRunner` job** of kind `TOUR_JOB_KIND = 'onboarding-tour-generate'` (`onboarding/constants.ts`). The service registers the handler in its constructor through the `jobs: JobQueue` dep and enqueues one job per accepted `POST`. **The handler never throws**: it records any failure in `failures` itself and resolves. JobRunner retries a handler only when it rejects (`withRetry(retries: 2)`, `platform/jobs.ts:65-82`), so a retry never re-calls the model (AC-21). The synchronous per-repo lock (`running` map, D-43, INV-17) stays, and it is what gives the 409. One API per database is already assumed (`server/INSIGHTS.md:99-106`). JobRunner's 120 s wall covers the whole handler (R-10), and a restart mid-generation loses the run (R-3) | user, 2026-11-01 (F-03) |
| D-4 | Storage | Reuse the empty `onboarding` table (`context.ts:120-126`). **No migration.** `json` holds a versioned envelope `StoredTour = { v: 1, revision, index_files, source_files, coverage_partial, index_partial, trimmed, provider, model, cost_usd, sections }`. `generated_at` is set explicitly on every upsert, because `defaultNow()` fires only on insert. On read the envelope is `safeParse`d. A row that does not parse is treated as "no stored tour". Scoping goes through `repos` (the table has no `workspace_id`), and the route checks the workspace first | planner (`AGENTS.md`: an empty table is intentional) |
| D-5 | Which revision | `revision = indexState.lastIndexedSha`, falling back to `git.currentHead()` when that is empty. Every git read for one generation (`listFilesAt`, `readFileAt`) uses that one sha, so facts and index agree. If `readFileAt` at that sha fails because the object is gone, the whole fact set is read at `currentHead()` instead. `outdated = stored.revision !== current indexState.lastIndexedSha` | planner |
| D-6 | Manifests and folders | The only manifest type is `package.json`. Root `package.json` if present, plus at most **4** first-level `<dir>/package.json` files. The 4 are picked by the number of indexed files under `<dir>/` (desc), ties by `<dir>` asc. `EXCLUDED_DIRS` dirs are never picked. Top-level folders = the first path segment of indexed files, with counts, ordered by count desc then name asc, at most 30. Root-level files are not a folder | planner |
| D-7 | Install command (AC-40) | per manifest dir, **from a lockfile only**: `pnpm-lock.yaml` → `pnpm install`, `package-lock.json` → `npm ci`, `yarn.lock` → `yarn install`, `bun.lock`/`bun.lockb` → `bun install`. With several lockfiles, the first in that order wins. **No lockfile → no install command**, and the `packageManager` field is ignored. Script invocations then use `npm run` (D-9). Lockfiles are detected by **name** in the tree, never read | planner, revised after review §7 |
| D-8 | Env example, compose, README | Env example = the first existing of `.env.example`, `.env.sample`, `.env.template`, `example.env` in each manifest dir (root first). Command `cp <dir>/.env.example <dir>/.env` (no prefix at root). Only names are extracted, with `^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=` per line, at most 50. Compose = `docker-compose.yml`, `docker-compose.yaml`, `compose.yml` or `compose.yaml` at the **root**, detected by name only → `docker compose up -d`. README = the root file whose name matches `/^readme(\.md)?$/i` (first by path asc), excerpt 6,000 chars | planner |
| D-9 | Which scripts become commands (AC-40, AC-88) | Exactly the AC's allow-list, in **this derivation order**: `dev`, `start`, `serve`, `build`, `test`, `migrate`, `db:migrate`, `seed`, `db:seed`. No other script name, and no `dev:*` variant. The command is `<pm> run <script>`, with `<pm>` from that dir's lockfile, else `npm`. Outside the root it gets a `cd <dir> && ` prefix, where `<dir>` has passed D-44. Derived order: env copies (root, then dirs in D-6 order) → `docker compose up -d` → per manifest dir (root, then the D-6 order): install (if any), then scripts in allow-list order. Ids are `cmd-1 … cmd-n` in that order | planner, revised after review §7 |
| D-10 | "The model may only order the commands" (AC-41, AC-88) | The model returns `[{ id, comment }]`. Rows follow the model's order of **known, first-seen** ids. Unknown ids are dropped (AC-41). Derived commands the model did not mention are **appended** after them in derivation order with `comment: null` (AC-88), so the model cannot remove a derived command. Model output `[]` → all derived commands in derivation order, all comments `null`. A comment is cut to one line of ≤ 160 chars | planner, cites AC-88 |
| D-11 | Diagram data (AC-33 as amended) | The model returns `components: [{ id, label, kind, ref }]` and `connections: [{ from, to }]`. `kind ∈ TourComponentKind = ui · api · service · worker · data · external · library`. A component survives iff `ref` (trimmed, case-insensitive, trailing `/` removed) is an **indexed** file path, a top-level folder, or a dependency name (`dependencies` ∪ `devDependencies` keys) of a manifest read under AC-68. A tree-only path (`Dockerfile`, `docker-compose.yml`) does **not** count. The tree-path set K (D-26) is used only for the AC-61 prose scrub. Duplicate ids keep the first. At most 12 components, then at most 24 connections, both naming surviving ids, with self-loops and duplicates dropped. The label is cut to one line of ≤ 40 chars | planner, revised (REC-2 (a)) |
| D-12 | Compose content | **Never read.** Its presence by name gives `docker compose up -d` (AC-40). It is not a fact and not a diagram reference | user, 2026-10-31 (REC-2 (a)) |
| D-13 | Reading-path entries in "a different order" (AC-50) | The model's `reading_path` entries are walked in model order. An entry is **accepted** iff its path is in the ranked list **and** its ranked index is greater than the ranked index of the last accepted entry. Everything else is ignored. An accepted entry gives only its `why` (one line, ≤ 200 chars). Order and set always stay the ranked ones. The same per-path reason merge, without the order condition, applies to critical paths (AC-36) | planner |
| D-14 | The deterministic reason (AC-36, AC-49) | `importers` = number of distinct `file_edges.from_file` importing the path. `top_percent = max(1, 100 − percentile)` from `file_rank.percentile`. The client renders "imported by {importers} files · top {top_percent}% by rank" | planner |
| D-15 | TODO candidates (AC-52) | Scan set = `getTopFilesByRank(repoId, 30)` (junk excluded, AC-47). For each file, the first 6,000 chars at the revision. A line is a candidate iff it matches `/(?:\/\/|\/\*|^\s*\*|#)\s*.*?\b(TODO|FIXME|HACK)\b[:\s]?(.*)$/` (the marker inside a comment). Line numbers start at 1. Text = the trimmed rest of the line, ≤ 200 chars. Id `todo:<path>:<line>` | planner |
| D-16 | Missing-tests candidates (AC-52, rev. 4, F-39) | For each file of the same 30 that is not itself a test, it is a candidate iff **both** rules find no test:<br>(1) **importers:** no test path imports it, from `repoIntel.getImporters`, where the importers are filtered by the junk/test path rule. This catches `test/*.ts` suites that import `source/index.ts`;<br>(2) **name:** no tree path's basename matches `^<stem>\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$`, where `<stem>` = basename without extension. Rev. 5 (F-55): such a same-stem test covers the file **only** when it sits in one of three places: (a) the file's own directory; (b) a test directory (`test`, `tests`, `__tests__`) whose parent is the file's directory; (c) the `src`-mirror of a test tree (`test/x/a.test.ts` covers `src/x/a.ts`). A same-name test elsewhere does not count.<br>Id `missing-tests:<path>` | planner, revised (F-39, F-55) |
| D-17 | Open-PR candidates (AC-52, AC-58) | `pull_requests` rows of this workspace and repo with `status NOT IN ('merged','closed')` (`pulls/status.ts:49-58`), ordered `updated_at desc nulls last, number desc`, at most 50. Id `open-pr:<number>`. The title is untrusted text. Rev. 5 (F-61): the filter, sort and limit live **only in SQL** in `OnboardingRepository.listOpenPulls`. No helper re-filters or re-sorts | planner, revised (F-61) |
| D-18 | Candidate order (AC-53) | File candidates by the file's ranked index (ascending = highest rank first). Within one file: `todo` before `missing-tests`, then line asc. Then open PRs in D-17 order. Keep the first 15 | planner |
| D-19 | Fallback tasks (AC-56) | Fallback = the first 5 ordered candidates, `source: 'fallback'`, `title: null`, `reason: null`. The client words them: titles "Resolve the TODO in {path}:{line}", "Add tests for {path}", "Review PR #{n}: {title}". The one-line reason (AC-57) is the TODO text, or "imported by N files · top P% by rank", or "opened by {author}" | planner |
| D-20 | Classifying a failure (AC-72) | `ConfigError` → `no_api_key`. `TimeoutError` (`resilience.ts:6`) → `timeout`. A message matching `/failed schema|schema validation/i` → `invalid_output` with `message: "the model returned invalid output"`. These are the thrown messages at `openai.ts:132`, `openrouter.ts:115`, the same loop in `anthropic.ts`, and `mocks.ts:96`. `not valid JSON` was dropped, because no adapter throws it: `structured.ts:67` is only a reprompt text. Anything else → `provider_error` with the error message, ≤ 300 chars, e.g. `OpenRouter returned no choices…` (`openrouter.ts:91`).<br>**Rev. 5 — `source_unreadable` (F-52):** if any git read for the facts failed (`listFilesAt`, a `readFileAt` of a fact file, or the importer read), the generation is **refused before the model call**: failure `source_unreadable`, no `completeStructured`, nothing stored. Facts built after a git or importer-read failure are **never cached** (D-33), so the next request reads again. The skeleton on `GET` may still show the partial facts | planner, revised after review §2 and F-52 |
| D-21 | Timeout | `withTimeout(llm.completeStructured({ …, timeoutMs: 120_000 }), 120_000)`. The outer wall is needed because `OpenRouterProvider` ignores `req.timeoutMs` (`openrouter.ts:51-56`). `deps.generationTimeoutMs` overrides it in tests | planner |
| D-22 | No API key (AC-70) | Checked synchronously in `startGeneration` before the 202: `await deps.llm(provider)` rejecting with `ConfigError` → the failure `{ code: 'no_api_key', provider }` is recorded and `AppError('tour_no_api_key', 'No API key for <provider>', 422, { provider })` is thrown. No request is sent | planner |
| D-23 | Header numbers (AC-12, AC-13, AC-87) | N = `getIndexedFiles().length` at generation, i.e. the count of `file_rank` rows (= files the index holds after a full or incremental pass). M = `stats.totalCandidates` of the **latest walk**, or `null` when absent. Full index writes it at `full.ts:254-267`. Incremental writes it from its own `walkClone` (step 2, AC-87). `coverage_partial = stats.bounded > 0 OR stats.softBudgetReached === true`. Separately, step 2 stops the `files_indexed` drift at the source (`incremental.ts:260`).<br>**Rev. 5 (F-54):** incremental `filesIndexed` uses the **full pass's terms**, via `refreshCounts`: it counts walked files that parsed. Parse failures stay in `filesSkipped`, and `filesIndexed + filesSkipped ≤ totalCandidates`. It is **not** `walk.files.length`. The tour header's N still reads the `file_rank` row count, not `files_indexed` | planner, revised (REC-4 accepted, F-54) |
| D-24 | Status and reason codes | `status`: `not_cloned` (`clonePath` null) · `index_not_ready` (index `degraded`/`failed`, or no ranked file) · `ready` (generatable, nothing stored) · `generated`. `index_reason` = `degradedReason ?? reason ?? status`, or `'not_ranked'` when only the ranking is missing. The client maps known codes (`no_data`, `no_clone`, `no_files`, `index_failed`, `repo_too_large`, `flag_off`, `not_ranked`) to text and falls back to the raw code | planner |
| D-25 | repo-intel fixes the tour depends on | (a) `getRankedPaths`: `.orderBy(desc(rank), asc(filePath))`. (b) `getCriticalPaths`: the adjacency sort breaks rank ties by path asc. (c) `isJunkPath` tests the patterns against `'/' + lower` (so root-level `test/`, `tests/`, `migrations/`, `__fixtures__/` match) and adds `'/fixtures/'`. (a) and (c) also change the conventions sample (`getConventionSamples` → `getTopFilesByRank`), deterministically, towards fewer test files. Left to reviewers | planner |
| D-26 | Paths and links in model text (AC-31, AC-61) | Known set K = tree paths at the revision ∪ indexed paths ∪ every directory prefix of those (with and without a trailing `/`). Prose scrub:<br>(1) an inline code span that looks like a path (contains `/`, or ends in a known source/config extension) and is not in K is **removed**;<br>(2) a markdown link with a relative href not in K becomes its text;<br>(3) **every markdown link with an absolute `http(s)` href becomes its text** (review §6: a prompt-injected README could otherwise make the model emit a phishing link);<br>(4) an occurrence of a K path outside code spans, at a word boundary, is wrapped in backticks.<br>Structured paths (rows, tasks) come from the facts, never from the model.<br>**Rev. 4 — where the guarantee lives (F-29, F-30, F-36):**<br>- **the guarantee is at render.** Tour prose is rendered with `UntrustedMarkdown inertLinks`, which turns every link in the markdown AST into inert text, whatever the source spelling (entity-encoded, escaped, autolink literal). The `OnboardingTour` contract comment states that `prose` must be rendered with `inertLinks`;<br>- the server scrub is **best effort** and **insertion-only.** It never deletes prose: a link definition is neutralised by escaping its `[` at a real line start, never by removing the line. A round-trip test pins that unchanged input stays byte-identical | planner, revised after review §6 and F-29/F-30/F-36 |
| D-27 | "Existing injection guard" (AC-60) | The `SECURITY:` paragraph of `server/src/prompts/onboarding.system.md:11-12` is kept verbatim. All repo-derived text goes through `wrapUntrusted` from `@devdigest/reviewer-core` (`prompt.ts:63`). No keyword scanning. reviewer-core is unchanged | planner |
| D-28 | Tooltips | the `title` attribute. There is no tooltip primitive in `@devdigest/ui`, and adding one would be a vendor edit. A disabled button gets its `title` on a wrapping `<span>` so it shows | planner |
| D-29 | i18n namespace | `client/messages/en/onboarding.json` is rewritten. Today it holds stale strings of an older tour and no code reads it (`grep useTranslations("onboarding")` → none) | planner |
| D-30 | Sidebar item | `{ key: "onboarding-tour", label: "Onboarding Tour", icon: "Workflow", href: "/repos/:repoId/tour" }`, no `gKey`. `Workflow` already exists in `icons.tsx:79`. A new icon would be a vendor edit | planner |
| D-31 | Relative time | `useFormatter().relativeTime(new Date(generated_at))` from next-intl. No helper is promoted out of `pulls/helpers.ts` | planner |
| D-32 | Dismissing the failure notice (AC-73) | client-local state keyed by `failure.at`. The server keeps the failure until the next generation starts or succeeds | planner |
| D-33 | Fact cache | The git-derived facts are memoised in the service per `(repoId, revision, indexState.updatedAt)`, keeping 20 entries (LRU), as project-context REC-2 does. Open PRs are re-read on every request. Facts built after **any** git or importer-read failure are never cached (rev. 5, F-52, D-20) | planner, revised (F-52) |
| D-34 | e2e data (AC-82) | none. The seeded demo repo is not cloned, so `/repos/<demo>/tour` is the AC-58 skeleton, and "Generate tour" is disabled | planner |
| D-35 | Old `Onboarding*` contract shapes | **Replaced.** `OnboardingLink`, `OnboardingSection` and `Onboarding` (`knowledge.ts:28-47`) have no importer in any package (grep). The new shapes go under the same `// ---- Onboarding ----` header | planner |
| D-36 | Execution mode | multi-agent, the same shape as L05 Project Context. e2e goes to `implementer` | caller, 2026-10-31 |
| D-37 | Commits | the main session commits: (1) this plan; (2) **implementation** = steps 1–22, after the review/fix loop; (3) **tests** = steps 23–32. A product bug found by tests is fixed by `implementer` in a separate `fix(onboarding): …` commit, so commit (2) stays what was reviewed | caller, 2026-10-31 |
| D-38 | Where the service instance lives | built once in `onboarding/routes.ts` from container accessors (the conventions precedent, `conventions/routes.ts:61`). One plugin instance per app gives one running-registry. No container getter, because no other module needs it | planner |
| D-39 | Polling | `useTour` refetches every 2,000 ms while `generation.running`. Otherwise it does not poll | planner |
| D-40 | Transport retries (AC-21 as amended) | The service makes one `completeStructured` call with `maxRetries: 0`, so there is no schema re-ask or repair. The adapters' transport retries stay as they are: `withRetry` (default `retries ?? 3`, `resilience.ts:47`) on 429/5xx/ECONNRESET/ETIMEDOUT/ENOTFOUND in `openai.ts:97` and `anthropic.ts:139`, which is up to **4** requests; and the OpenAI SDK `maxRetries: 2` in `openrouter.ts:55`, up to **3**. No change to reviewer-core or to the `LLMProvider` port | user, 2026-10-31 (REC-1 (a)) |
| D-41 | Blockers and precedence (AC-14, AC-15, AC-70, AC-86) | `OnboardingTour.blockers: TourBlocker[]`, in fixed order: `not_cloned`, `index_not_ready`, `no_api_key`. Every applicable blocker is listed, and the client shows **one status line per blocker in that order**. A not-cloned repo without a key shows "Not cloned — clone to generate" first and "No API key for <provider>" second. `can_generate = blockers.length === 0 && !generation.running`. So flow 09 (seed repo uncloned, CI may have no key) always finds the not-cloned line | planner (review §1, AC-86) |
| D-42 | Key check on `GET` (AC-86) | New `Container.hasLlmKey(provider): Promise<boolean>`. It returns true when `overrides.llm?.[provider]` is set, else `!!(await this.secrets.get(KEY_FOR[provider]))`, where `KEY_FOR = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openrouter: 'OPENROUTER_API_KEY' }`. `buildLlm` uses the same const, so the two cannot drift. It builds no client and makes no network call. `GET` calls `featureModel(ws)` + `hasLlmKey(provider)` and never `llm()` or `completeStructured`. `api_key = { provider, model, missing }`. `POST` keeps the `ConfigError` path of D-22 as a second line of defence | planner (review §1) |
| D-43 | Race-free lock (AC-28) | `startGeneration` checks `running.has(repoId)` and, in the **same synchronous tick, before the first `await`**, sets `running.set(repoId, lock.promise)` (a deferred). Every pre-check runs inside `try`. If a pre-check throws: `running.delete(repoId)`, resolve the deferred, rethrow. Otherwise the deferred resolves when `run()` settles. Two `startGeneration` calls with no `await` between them → exactly one passes, the other gets 409.<br>**Rev. 4 — generation ids own the lock (F-19, F-33, F-35):**<br>- every accepted start gets a fresh generation id, stored with the lock and passed in the job payload;<br>- the handler, its `finally` and the `job.done.catch` release path act only if `running.get(repoId)` still holds **that** id. A re-run handler, such as a JobRunner retry after a DB update error, therefore can neither overwrite another generation's result nor release its lock;<br>- if the runner fails before the handler runs (F-33), `job.done.catch` releases the lock and first records a `provider_error` failure, so the generation never silently vanishes (F-35) | planner (review §3), revised (F-19, F-33, F-35) |
| D-44 | Shell-safe directory names (AC-40, security) | A manifest dir is used for commands only if every path segment matches `^[A-Za-z0-9._-]+$` and is neither `.` nor `..`. A dir that fails is skipped entirely: no `cd`, no `cp`, no install, no scripts. Root commands need no dir. Env-example names come from the fixed `ENV_EXAMPLE_NAMES`, so their file names are constant. Script names come from the allow-list, so they are safe. No quoting, because a skipped dir is simpler to reason about than an escaped one | planner (review §6) |
| D-45 | Stored tour vs clone/index state (review §2) | A valid stored tour is **always** shown (`status: 'generated'`), even if the clone was removed or the index degraded since. The paid-for tour is not hidden. The blockers still list `not_cloned` / `index_not_ready`, so Regenerate is disabled with the reason, and `meta.outdated` follows D-5 | planner |
| D-46 | i18n file timing (review §3) | Step 14 creates `messages/en/onboarding.json` with the full key list of step 22 **first**. Step 22 is the final pass that checks every key is used and there are no hardcoded strings | planner |
| D-47 | Step sizing (review §3) | Step 10 is split into **10a** (fact collection + cache), **10b** (`getTour`) and **10c** (`startGeneration` + `run`), each with a checkpoint. Test step 30 is split into **30a** (view, header, nav-adjacent, copy) and **30b** (sections, diagram). Step 4 stays one step: its functions are small, pure and listed one by one | planner |
| D-48 | Restart "interrupted" hint (review §6) | **Rejected.** After a restart `running` is false and there is no failure, so the client stops polling (D-39) and shows the skeleton or the previous tour with an enabled button. Nothing is stuck. Persisting run state would need a table or the jobs row, which costs more than the case is worth for a local-first single process. Documented as R-3 | planner |
| D-49 | Pruning `failures` (review §6) | **Rejected as a change.** The map has at most one entry per repo, and each entry is replaced or cleared on the next start or success. Its size is bounded by the number of repos in the workspace | planner |
| D-50 | Source-text hygiene test (review §5) | **Kept**, as a guard. A behavioural case is added: a spy on every `GitClient` method shows only `listFilesAt`/`readFileAt`/`currentHead` are called (AC-44). The AC-21 test asserts only the call count, `maxRetries: 0` and `maxTokens`, not the prompt content | planner |

## Recommendations

| ID | Recommendation | Why / cost of not doing it | Status |
|---|---|---|---|
| REC-1 | Tighten the adapters' transport retries to network-only | the literal reading of the old AC-21 | **rejected**: the user chose (a), and AC-21 was amended. → D-40. No step |
| REC-2 | Read the compose file for AC-33 | AC-33 named compose services | **rejected**: the user chose (a), and AC-33 was amended. → D-11, D-12. No step |
| REC-3 | Check the API key on page open | AC-70 alone shows it only after the click | **accepted** → AC-86 · D-41, D-42 · steps 1, 7, 10b, 14, 15, 22 |
| REC-4 | Fix the `filesIndexed` drift and the stale M after incremental refreshes | header N/M must stay honest | **accepted** → AC-87 · D-23 · step 2 |

## Touches

server: `vendor/shared/contracts/knowledge.ts`, `modules/repo-intel/{types,repository,service}.ts`, `modules/repo-intel/pipeline/incremental.ts`, `modules/onboarding/**` (new), `modules/index.ts`, `platform/container.ts` (`hasLlmKey` + the shared `KEY_FOR` const, D-42), `prompts/onboarding.system.md`
client: `vendor/shared/contracts/knowledge.ts` (mirror), `vendor/ui/nav.ts`, `components/app-shell/helpers.ts`, `lib/hooks/onboarding.ts` (new), `app/repos/[repoId]/tour/**` (new), `messages/en/onboarding.json` (rewrite)
reviewer-core: **none** (AC-21 as amended)
e2e: `specs/09-onboarding-tour.flow.json` (new)
**Not touched:** any `package.json` or lockfile, any migration, `db/schema/*`, `src/adapters/*`, `vendor/shared/adapters.ts`, `platform/resilience.ts`, `client/src/vendor/ui/**` except `nav.ts`.

## Contract

Both trees, **byte-identical**, in one commit: `server/src/vendor/shared/contracts/knowledge.ts` and `client/src/vendor/shared/contracts/knowledge.ts`. They replace lines 28-47 (D-35). `vendor/shared/index.ts` already re-exports `knowledge`, so no barrel edit is needed (check the header comment at `index.ts:7` and update its wording). The client imports these **type-only** (`server/INSIGHTS.md:54-69`).

```ts
// ---- Onboarding ----
// The repository tour (L05 Onboarding Generator). Deterministic facts first;
// model text only where a field says so. Every section key is always present —
// a skeleton fills it from facts and says what is missing through `gap`.
export const TourComponentKind = z.enum(['ui', 'api', 'service', 'worker', 'data', 'external', 'library']);
export type TourComponentKind = z.infer<typeof TourComponentKind>;
export const TourComponent = z.object({ id: z.string(), label: z.string(), kind: TourComponentKind });
export type TourComponent = z.infer<typeof TourComponent>;
export const TourConnection = z.object({ from: z.string(), to: z.string() });
export type TourConnection = z.infer<typeof TourConnection>;

export const TourSectionGap = z.enum([
  'needs_clone',    // AC-58 "Needs a clone and an index"
  'needs_index',    // AC-15 index not ready (architecture folders)
  'not_ranked',     // AC-51
  'no_edges',       // AC-38
  'no_manifest',    // AC-45
  'no_candidates',  // AC-59
]);
export type TourSectionGap = z.infer<typeof TourSectionGap>;

export const TourStack = z.object({
  languages: z.array(z.object({ name: z.string(), files: z.number().int() })), // by indexed file count desc
  frameworks: z.array(z.string()),
  runtime: z.array(z.string()),
});
export type TourStack = z.infer<typeof TourStack>;
export const TourFolder = z.object({ path: z.string(), files: z.number().int() });
export type TourFolder = z.infer<typeof TourFolder>;

export const TourArchitecture = z.object({
  prose: z.string().nullable(),          // model markdown, best-effort scrubbed (D-26); null in a skeleton.
                                          // MUST be rendered with <UntrustedMarkdown inertLinks> — that is the link guarantee (F-29, F-36)
  components: z.array(TourComponent),     // grounded (AC-33); [] in a skeleton
  connections: z.array(TourConnection),
  stack: TourStack,                       // AC-34
  folders: z.array(TourFolder),           // AC-34, ≤ 30
  gap: TourSectionGap.nullable(),
});
export type TourArchitecture = z.infer<typeof TourArchitecture>;

export const TourFileRow = z.object({
  path: z.string(),
  reason: z.string().nullable(),          // model's one line, or null → client words the deterministic reason
  importers: z.number().int(),            // D-14
  top_percent: z.number().int(),          // D-14
});
export type TourFileRow = z.infer<typeof TourFileRow>;
export const TourFileList = z.object({ rows: z.array(TourFileRow), gap: TourSectionGap.nullable() });
export type TourFileList = z.infer<typeof TourFileList>;

export const TourCommand = z.object({ step: z.number().int(), command: z.string(), comment: z.string().nullable() });
export type TourCommand = z.infer<typeof TourCommand>;
export const TourCommands = z.object({ commands: z.array(TourCommand), gap: TourSectionGap.nullable() });
export type TourCommands = z.infer<typeof TourCommands>;

export const TourTaskKind = z.enum(['todo', 'missing-tests', 'open-pr']);
export type TourTaskKind = z.infer<typeof TourTaskKind>;
export const TourTask = z.object({
  candidate_id: z.string(),
  kind: TourTaskKind,
  source: z.enum(['model', 'fallback']),
  title: z.string().nullable(),           // model title; null for fallback (client words it, D-19)
  reason: z.string().nullable(),          // model reason; null for fallback
  path: z.string().nullable(),
  line: z.number().int().nullable(),
  pr_number: z.number().int().nullable(),
  pr_title: z.string().nullable(),
  detail: z.string().nullable(),          // TODO text | PR author — deterministic context
  importers: z.number().int().nullable(),
  top_percent: z.number().int().nullable(),
});
export type TourTask = z.infer<typeof TourTask>;
export const TourTasks = z.object({ tasks: z.array(TourTask), gap: TourSectionGap.nullable() });
export type TourTasks = z.infer<typeof TourTasks>;

export const TourSections = z.object({
  architecture: TourArchitecture,
  critical_paths: TourFileList,
  run_locally: TourCommands,
  reading_path: TourFileList,
  first_tasks: TourTasks,
});
export type TourSections = z.infer<typeof TourSections>;

export const TourStatus = z.enum(['generated', 'ready', 'not_cloned', 'index_not_ready']); // which sections are shown; blockers say why Generate is off
export type TourStatus = z.infer<typeof TourStatus>;
// 'source_unreadable' (rev. 5, F-52): a git read for the facts failed → refused before the model call, nothing stored
export const TourFailureCode = z.enum(['no_api_key', 'timeout', 'provider_error', 'invalid_output', 'source_unreadable']);
export type TourFailureCode = z.infer<typeof TourFailureCode>;
export const TourGeneration = z.object({
  running: z.boolean(),
  failure: z
    .object({ code: TourFailureCode, message: z.string(), provider: z.string().nullable(), at: z.string() })
    .nullable(),
});
export type TourGeneration = z.infer<typeof TourGeneration>;

export const TourMeta = z.object({
  revision: z.string(),
  generated_at: z.string(),
  index_files: z.number().int(),          // AC-12 N
  source_files: z.number().int().nullable(), // AC-13 M
  coverage_partial: z.boolean(),          // AC-13
  index_partial: z.boolean(),             // AC-16
  trimmed: z.boolean(),                   // AC-69
  provider: z.string(),                   // AC-84
  model: z.string(),
  cost_usd: z.number().nullable(),
  outdated: z.boolean(),                  // AC-74
});
export type TourMeta = z.infer<typeof TourMeta>;

// Why generation is not possible right now, in display order (D-41). Several may apply.
export const TourBlocker = z.enum(['not_cloned', 'index_not_ready', 'no_api_key']);
export type TourBlocker = z.infer<typeof TourBlocker>;
export const TourApiKey = z.object({ provider: z.string(), model: z.string(), missing: z.boolean() }); // AC-86
export type TourApiKey = z.infer<typeof TourApiKey>;

export const OnboardingTour = z.object({
  repo_id: z.string(),
  full_name: z.string(),                  // owner/name — breadcrumb (AC-06)
  name: z.string(),                       // heading accent (AC-06)
  default_branch: z.string(),
  status: TourStatus,                     // 'generated' whenever a valid stored tour exists (D-45)
  index_reason: z.string().nullable(),    // AC-15, AC-51 (D-24)
  revision: z.string().nullable(),        // sha that GitHub links point at; null without a clone
  blockers: z.array(TourBlocker),         // AC-14, AC-15, AC-86 — ordered not_cloned, index_not_ready, no_api_key
  api_key: TourApiKey,                    // AC-86 — checked on GET, no model call (D-42)
  can_generate: z.boolean(),              // blockers.length === 0 && !generation.running
  generation: TourGeneration,
  meta: TourMeta.nullable(),              // non-null iff status === 'generated'
  sections: TourSections,
});
export type OnboardingTour = z.infer<typeof OnboardingTour>;

export const TourGenerateAccepted = z.object({ running: z.literal(true) });
export type TourGenerateAccepted = z.infer<typeof TourGenerateAccepted>;
```

The model's answer schema is **internal** to the server (`onboarding/schema.ts`, step 3), as in conventions (`conventions/constants.ts:66-73`). The stored envelope `StoredTour` is internal too.

## Architectural invariants (for `architecture-reviewer`)

Each invariant is checkable on its own. `architecture-reviewer` runs `pnpm arch` first, then checks these by reading the files.

| ID | Invariant | How to check |
|---|---|---|
| INV-1 | **Ring per new file**, as in the table below. Imports point inward only | `pnpm arch` green with **no new** violation; read the imports |
| INV-2 | **repo-intel stays the only reader of the index tables** (`repo_index_state`, `file_rank`, `file_edges`, `file_facts`, `symbols`, `references`, `repo_map_cache`). No file outside `server/src/modules/repo-intel/` names `t.fileRank`, `t.fileEdges`, `t.fileFacts`, `t.repoIndexState`, `t.symbols`, `t.references`, `t.repoMapCache`. Onboarding reaches the index **only** through `container.repoIntel`, and only through these facade reads: `getIndexState`, `getIndexedFiles`, `countIndexedFiles` (F-13: the count for N and the readiness check without loading every row), `getImporters` (F-39: the test-path importers used by `missingTestCandidates`), `getEndpoints`, `getTopFilesByRank` and `getCriticalPaths`. It types it with a **local structural interface** (`IndexFacade`, declared in `onboarding/service.ts`) and never imports `../repo-intel/*` | `grep -rn "fileRank\|fileEdges\|fileFacts\|repoIndexState\|repoMapCache" server/src --include=*.ts` → only `repo-intel/` and `db/`. `grep -rn "repo-intel" server/src/modules/onboarding` → nothing |
| INV-3 | **The model goes through the existing port.** `LLMProvider` is resolved by `container.llm(provider)` (in `startGeneration` only), provider and model by `container.featureModel(ws, 'onboarding')`, and the key check by `container.hasLlmKey(provider)` (on `GET`, D-42). All three reach the service as injected functions. No import of `src/adapters/*`, of an SDK (`openai`, `@anthropic-ai/*`), or of `modules/settings/*` (`server/INSIGHTS.md:110-126`) | read `onboarding/routes.ts` (the wiring), `onboarding/service.ts` (the imports) and `platform/container.ts` (`hasLlmKey` builds no client) |
| INV-4 | **One request per generation.** Exactly one `completeStructured` **call site** in `server/src/modules/onboarding/`, with `maxRetries: 0`, `maxTokens: 10000` (AC-83 as amended), `temperature: 0`, `timeoutMs: 120_000`, inside `withTimeout`. No loop around it, no per-section call | `grep -rn "completeStructured(" server/src/modules/onboarding`: review each hit; one is a call, the rest may only be comments |
| INV-5 | **No new dependency anywhere.** No `package.json` and no lockfile change in any of the five packages. The diagram is hand-drawn SVG (no mermaid, no graph-layout library) | `git diff --stat -- '*/package.json' '*lock*'` → empty |
| INV-6 | **Vendored `@devdigest/shared` is mirrored.** The two `contracts/knowledge.ts` are byte-identical, and `adapters.ts` is unchanged. The client imports `@devdigest/shared` **type-only** | `diff server/src/vendor/shared client/src/vendor/shared -r` → nothing. `grep -rn "from \"@devdigest/shared\"" client/src/app/repos/\[repoId\]/tour client/src/lib/hooks/onboarding.ts` → every hit is `import type` |
| INV-7 | **No I/O but the git port.** `onboarding/**` imports no `node:fs`, `node:child_process`, `execa` or `simple-git`. File content comes only from `GitClient.listFilesAt`/`readFileAt` at **one** sha per generation (D-5). Nothing is executed (AC-44), and no `.env` other than the example is read (AC-64) | `grep -rn "node:fs\|child_process\|execa\|simple-git" server/src/modules/onboarding` → nothing |
| INV-8 | **Ring-1 helpers are pure.** `onboarding/**/helpers.ts` import only `zod`, `@devdigest/shared` (types/enums), `@devdigest/reviewer-core` (`wrapUntrusted` only), sibling `constants.ts`/`schema.ts`/`helpers.ts`. No `async` I/O | `core-no-io` in `pnpm arch` (`.dependency-cruiser.cjs:64-73`) |
| INV-9 | **Explicit deps, no cycle.** `OnboardingService` takes `{ db, repos, repoIntel, git, featureModel, llm, hasLlmKey, jobs: JobQueue, logger: TourLogger, now?, generationTimeoutMs? }`. `TourLogger` is a local structural `{ warn, error }`, wired to `app.log` in `routes.ts` (F-37). `JobQueue` is a local structural interface (`register`, `enqueue`), satisfied by `container.jobs`. It never imports `Container` (not even `import type`: `tsPreCompilationDeps`, `server/INSIGHTS.md:121-123`). It `new`s only its own `OnboardingRepository` | `no-circular` in `pnpm arch`; read the constructor |
| INV-10 | **Routes are transport only.** zod `params` (`IdParams`), `requireRepoInWorkspace` before the id reaches the service, errors thrown as `AppError` subclasses (never `reply.send({ error })`), no `db/schema` import | `routes-no-db`, `app-no-fastify` in `pnpm arch`; read `routes.ts` |
| INV-11 | **No schema change.** The empty `onboarding` table is reused. No new table, no migration, `db/schema/*` unchanged | `git diff --stat -- server/src/db` → empty |
| INV-12 | **Client structure.** `page.tsx` is thin. Feature code lives in `tour/_components/` (route-private). No `fetch` in a component: data comes through `lib/hooks/onboarding.ts` → `lib/api.ts`. The only `src/vendor/` edits are `ui/nav.ts` and `shared/contracts/knowledge.ts`. No hardcoded user-facing string in JSX | read the tree; `frontend-ui-architecture` red flags |
| INV-13 | **reviewer-core unchanged**, and the `LLMProvider` port and the LLM adapters too (AC-21 as amended). Logging the raw model output, the zod issues and `finish_reason` needs an adapter change, so the user deferred it to a **separate PR** (F-37). This feature logs only the classified failure | `git diff --stat -- reviewer-core server/src/adapters server/src/vendor/shared/adapters.ts client/src/vendor/shared/adapters.ts server/src/platform/resilience.ts` → empty |
| INV-14 | The dep-cruiser baseline is **not regenerated** | `git diff -- server/.dependency-cruiser-known-violations.json` → empty |
| INV-15 | **Every command string is built from validated tokens.** A command is assembled only from: fixed templates (`cp`, `docker compose up -d`, the D-7 install commands, `<pm> run`), allow-listed script names (D-9), fixed env-example file names, and directory segments matching `^[A-Za-z0-9._-]+$`, neither `.` nor `..` (D-44). No model text and no other repo string ever reaches a command (AC-40, AC-41) | read `facts/helpers.ts` `deriveCommands`; test 23 (unsafe dir names) |
| INV-16 | **`GET` never starts a generation and never calls a model.** `getTour` does not touch `running`, `llm()` or `completeStructured`. It may call `featureModel` and `hasLlmKey` only (AC-25, AC-74, AC-86) | read `service.ts` `getTour`; tests 27 and 29 (0 `completeStructured` calls, no new row after `GET`) |
| INV-17 | **The generation lock is taken before any `await`.** In `startGeneration`, `running.has` and `running.set` sit in the same synchronous prefix, ahead of the first `await`, and every pre-check failure releases the lock in `catch`/`finally` (D-43, AC-28) | read `startGeneration`; test 27 (two un-awaited calls → one 409) |

**Ring of every new or changed server file:**

| File | Ring | Why |
|---|---|---|
| `modules/onboarding/facts/helpers.ts`, `prompt/helpers.ts`, `grounding/helpers.ts`, `helpers.ts` | 1 · domain | computed from their arguments alone (`DOMAIN` regex) |
| `modules/onboarding/constants.ts`, `schema.ts` | 1 (**not** classified by the regex, so `pnpm arch` does not check them; they are checked by reading their imports: `zod` + shared only) | literals and zod schemas |
| `platform/container.ts` (`hasLlmKey`) | 3 · composition root | reads `SecretsProvider`, builds nothing |
| `modules/onboarding/service.ts` | 2 · application | orchestrates the facade, git, the repository and the LLM port |
| `modules/onboarding/repository.ts` | 3 · infrastructure | the only onboarding file with SQL (`onboarding`, `pull_requests` read) |
| `modules/onboarding/routes.ts` | 4 · transport | |
| `modules/repo-intel/{types,service,repository}.ts`, `pipeline/incremental.ts` | unchanged rings (1/2/3/2) | the facade grows two reads; incremental writes walk stats (AC-87) |

---

## Skill map

Derived from `.claude/skills/pr-self-review/references/routing.md` (first match wins), then reconciled with the implementation skill list. `perf-prompt` is **not a skill**: where this map says "perf rubric", read `docs/agent-prompts/performance-reviewer.md`.

| Step | Path | Skills the implementer loads |
|---|---|---|
| 1 | `*/vendor/shared/contracts/knowledge.ts` | `zod` |
| 4 | `deriveCommands` (shell-safe dir names, D-44) | also `security` |
| 2 | `server/src/modules/repo-intel/service.ts`, `pipeline/incremental.ts` | `onion-architecture`, perf rubric |
| 2 | `server/src/modules/repo-intel/repository.ts` | `drizzle-orm-patterns`, `onion-architecture`, perf rubric |
| 2 | `server/src/modules/repo-intel/types.ts` | `onion-architecture`, `typescript-expert` (routing: "any other `server/src/**/*.ts`") |
| 3 | `modules/onboarding/{constants,schema}.ts` | `zod`, `onion-architecture` |
| 4–7 | `modules/onboarding/**/helpers.ts` | `onion-architecture`, `security` (steps 4–6: untrusted text, env names, path checks), `typescript-expert`. **Not in routing.md** as a pattern: it falls to "any other `server/src/**/*.ts`". The planner added `security` for 4–6 |
| 8 | `modules/onboarding/repository.ts` | `drizzle-orm-patterns`, `onion-architecture`, perf rubric |
| 9 | `server/src/prompts/onboarding.system.md` | `security`. **Not in routing.md**: `*.md` is gates-only. The planner picked `security` for the injection guard and grounding rules. Also read `docs/agent-prompts/README.md` for prompt hygiene, though this is not a reviewer prompt |
| 10a–10c | `modules/onboarding/service.ts` | `onion-architecture`, `security`, perf rubric |
| 10c | `server/src/platform/container.ts` (`hasLlmKey`) | `fastify-best-practices`, `onion-architecture`, `security` (routing: `server/src/platform/**`; secrets) |
| 11 | `modules/onboarding/routes.ts`, `modules/index.ts` | `fastify-best-practices`, `onion-architecture`, `security`, `zod` |
| 12 | `client/src/vendor/ui/nav.ts` | `frontend-ui-architecture`. **Not in routing.md** (`vendor/ui` is unrouted). It is the sanctioned exception (`client/AGENTS.md` *Do not touch*) |
| 12 | `client/src/components/app-shell/helpers.ts` | `frontend-ui-architecture`, `react-best-practices` |
| 13 | `client/src/lib/hooks/onboarding.ts` | `frontend-ui-architecture`, `typescript-expert`, `react-best-practices` |
| 14 | `client/src/app/repos/[repoId]/tour/page.tsx` | `frontend-ui-architecture`, `next-best-practices`, `react-best-practices` |
| 14–21 | `client/src/app/repos/[repoId]/tour/_components/**/*.tsx?` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices`, `security` (steps 18 and 21: rendering model and repo text) |
| 22 | `client/messages/en/onboarding.json` | none (gate G12 only) |
| 23–27 | `server/test/onboarding-*.test.ts` | **not in routing.md**. Planner's pick: `onion-architecture` (which suite), `typescript-expert` |
| 28, 29 | `server/test/*.it.test.ts` | **not in routing.md**. Planner's pick: `onion-architecture`, `drizzle-orm-patterns` |
| 30a, 30b, 31 | `client/src/**/*.test.tsx`, `*.test.ts` | `react-testing-library` |
| 32 | `e2e/specs/09-onboarding-tour.flow.json` | none. Follow the checklist in `e2e/AGENTS.md` |

## Constraints

| Constraint | Source |
|---|---|
| `@devdigest/shared` is vendored twice. Every contract edit goes into both copies in one commit, and both packages are typechecked | `AGENTS.md` hard rules; `client/INSIGHTS.md:187-193` |
| the client imports **types only** from `@devdigest/shared`, or `next dev`/`build` break while `tsc` stays green. A runtime list (e.g. kind → colour) is a local const keyed by the inferred type. Run `pnpm build` with `pnpm dev` stopped | `server/INSIGHTS.md:54-69`; `client/INSIGHTS.md:44-64` |
| a feature resolves its model through `container.featureModel`, never by importing `settings`. A type-only `import type { Container }` counts as a cycle | `server/INSIGHTS.md:110-126` |
| a service may `new` only its own repository. Adapters and other modules' collaborators come from the container | `server/INSIGHTS.md:156-168` |
| a new module gets `service.ts` + `repository.ts`, never the flat routes-with-Drizzle shape | `server/INSIGHTS.md:142-154` |
| a module never imports a sibling module's folder, so onboarding declares local structural types for what it needs from repo-intel and repos | `.dependency-cruiser.cjs:120-131`; `server/INSIGHTS.md:204-218` |
| the facade is tenant-agnostic. The workspace check happens in the route **before** the id reaches it | `repo-intel/routes.ts:36-41`; `_shared/context.ts:26-43` |
| registration is static: one import plus one entry in `modules/index.ts` | `server/AGENTS.md` Conventions; `modules/index.ts:20-23` |
| a DB test is named `*.it.test.ts`. Run it with `--no-file-parallelism` and **read the skipped count** | `server/INSIGHTS.md:72-97`, `:271-293` |
| `pnpm typecheck` does not cover `server/test/`, so typecheck test files with a scratch tsconfig | `server/INSIGHTS.md:128-139` |
| JobRunner retries a handler that rejects, and times it out at 120 s. The tour handler therefore never rejects (it records its own failure), so a retry never re-calls the model (D-3) | `server/src/platform/jobs.ts:40-42,65-82` |
| do not commit, check out or reformat `server/src` while anything is running under `pnpm dev` (tsx watch restarts kill in-flight work, including a tour generation) | `server/INSIGHTS.md:14-31` |
| one API process per database (the in-memory running-registry relies on it) | `server/INSIGHTS.md:99-106` |
| an empty table is intentional. `onboarding` is the table to use, and `code_chunks` is not touched | `AGENTS.md` hard rules |
| `getIndexState` never throws and synthesises `degraded/no_data`. Array facade methods return `[]` when degraded or when `repoIntelEnabled` is off | `repo-intel/types.ts:15-22`; `repo-intel/service.ts:189-205,644` |
| the index holds at most 5,000 JS/TS files. `stats.bounded` and `softBudgetReached` record the gap. Incremental refresh rewrites `stats` without those keys | `repo-intel/constants.ts:14,42`; `pipeline/walk.ts:65-68`; `pipeline/full.ts:254-267`; `pipeline/incremental.ts:245-255` |
| untrusted repo markdown is rendered through `UntrustedMarkdown`, which uses the `context` namespace, so every test provider rendering it needs `context` and `common` messages | `client/INSIGHTS.md:139-153`, `:256`; `UntrustedMarkdown.tsx:24` |
| stripping markdown emphasis mangles identifiers, so never strip `_` from model text | `client/INSIGHTS.md:128-137` |
| tests use `fireEvent`. There is no `user-event`, and installing it would rewrite the lockfile | `client/INSIGHTS.md:197-208` |
| `findByRole` on a non-unique name passes by timing. "Open", "Copy command N" and the two "Generate" buttons need path- or step-bearing names, or `getAllByRole` | `client/INSIGHTS.md:66-84` |
| a component folder copies a neighbour's shape. New components use Tailwind class strings in `styles.ts` | `client/INSIGHTS.md:10-18`; `client/AGENTS.md` Naming |
| overlays and tooltips are in-tree. There is no portal and no tooltip primitive | `client/INSIGHTS.md:157-172` |
| one checkout, one writer at a time. Never two writing agents in parallel | `INSIGHTS.md:60-74` |
| `test-writer` cannot write `e2e/`, so e2e steps go to `implementer` | `INSIGHTS.md:48-52` |
| a global install (`agent-browser`) must be run by the user, not by a subagent | `INSIGHTS.md:42-46` |
| `server/test/indexer-pipeline.test.ts` has 6 failures on a clean Windows tree. They land in the baseline as `baseline`, not as regressions | user memory *Windows indexer test failures* |

---

## Visual design (rev. 4, F-42)

**The visual spec is the two mockup images**, `C:\Users\malin\GoITCourse\lab5.5-1.png` (header, architecture, critical paths, top of run locally) and `C:\Users\malin\GoITCourse\lab5.5-2.png` (run locally, guided reading path). The user asked for the page to be "as close to the mockups as possible". The working gap list is `.devdigest/cache/sdd/L05-onboarding-generator/design-gaps.md`. Its IDs (D-1…D-16) are separate from this plan's `## Decisions` and are cited here as **UI-D-n**.

This is a styling pass over steps 14–21:
- it adds no scope and no dependency (INV-5);
- it uses existing `@devdigest/ui` primitives/tokens and Tailwind `styles.ts`;
- it keeps every AC behaviour (aria names, copy, links, statuses, skeleton, `inertLinks`).

| UI-D | Decision |
|---|---|
| 1, 2 | "ON THIS PAGE" is a sticky **left** column between the app sidebar and the content, with a small uppercase muted label. It keeps `hidden lg:block` (AC-80). Plain items run along a thin left rule; the active one is white with a 2 px accent left segment (AC-81) |
| 3, 4, 5 | top padding of about 32–40 px. A large bold heading "Onboarding for" + the repo name in **accent mono** (AC-06). The meta line is muted, under the heading (AC-12/13) |
| 6 | **outlined (secondary) header buttons** with leading icons, right-aligned on the heading row: ⟳ "Generate tour"/"Regenerate" and 🔗 "Share link" (AC-26/27/75) |
| 7, 8 | rounded-xl section cards (~24 px padding and gap). The header has an **accent-tinted icon tile**: Architecture = network, Critical paths = activity, Run locally = command, Reading path = list-checks, First tasks = check-square or flag. The chevron points up when open (AC-10/11) |
| 9, 10 | inline code in prose as accent mono chips (AC-31). The diagram sits in a darker inset panel. Nodes are rounded rectangles with a border colour per kind, mono labels and grey arrows (AC-32, still hand-drawn SVG) |
| 11 | the skeleton stack and folder lists use the same section style (AC-34) |
| 12 | each critical-path row is an **inner card**: file icon, mono path without a chip, " — reason" in muted text, and a small outlined "Open" button on the right (AC-35…37, AC-79) |
| 13 | each command is a **full-width row box**: muted step number, mono command with its `# comment` inline, and the copy icon button at the far right (AC-39, AC-42/43, AC-76/77) |
| 14 | each reading-path item has a **circular numbered badge**, the mono path on line 1 and the "why" on line 2 in muted text. "Open" stays as an unobtrusive outlined small button with its accessible name (AC-37, AC-48/49) |
| 15 | first tasks look like the critical-path inner cards: kind badge, title, reason on line 2, outlined "Open" (AC-57) |
| 16 | status and notice lines render as a compact notice (icon + text) (AC-14/15/70/71/73/86) |

Done when: screenshots at ≥ 1280 px (light and dark where supported) compared with both mockups, and every gap left is listed with its reason. Client tests stay green. Where the DOM shape changed, only the queries are updated, never weakened, and any test change is reported to `test-writer`.

---

## Steps

Each step names its files, its skill(s) (see the Skill map), and the ACs it covers. Steps 1–22 are code (`implementer`, commit 2). Steps 23–31 are tests (`test-writer`, commit 3). Step 32 is the e2e flow (`implementer`, commit 3). `implementer` writes no test file in phase 1.

### contracts (both packages)

1. **server + client** · `{server,client}/src/vendor/shared/contracts/knowledge.ts`, the header comment in `{server,client}/src/vendor/shared/index.ts:7` · skill `zod` · covers AC-07, AC-12, AC-13, AC-16, AC-32, AC-35, AC-39, AC-48, AC-57, AC-69, AC-74, AC-84
   - Replace `knowledge.ts:28-47` with exactly the block in `## Contract`, identical in both trees (D-35).
   - Checkpoint: `pnpm typecheck` in **both** `server/` and `client/`. Nothing imports the removed shapes, so both stay green.

### server — repo-intel facade

2. **server** · `modules/repo-intel/types.ts`, `repository.ts`, `service.ts`, `pipeline/incremental.ts` · skills `onion-architecture`, `drizzle-orm-patterns`, perf rubric · covers AC-13, AC-15, AC-20, AC-23, AC-35, AC-38, AC-46, AC-47, AC-87
   - `types.ts`:
     - add `export interface IndexedFileRow { path: string; rank: number; percentile: number; importers: number }` and `export interface EndpointRow { file: string; endpoint: string }`;
     - add to `IndexState` `coverage?: { totalSourceFiles: number | null; bounded: number; softBudgetReached: boolean }`;
     - add to `RepoIntel` `getIndexedFiles(repoId: string): Promise<IndexedFileRow[]>` and `getEndpoints(repoId: string): Promise<EndpointRow[]>`, under the `T3: onboarding` comment.
   - `repository.ts`:
     - `getRankedPaths`: `.orderBy(desc(t.fileRank.rank), asc(t.fileRank.filePath))` (D-25a).
     - New `getIndexedFiles(repoId)`: **one** query, `file_rank` LEFT JOIN `(SELECT to_file, count(DISTINCT from_file) AS importers FROM file_edges WHERE repo_id = $1 GROUP BY to_file)`. Return `{ path, rank, percentile, importers }` ordered `rank desc, path asc`. Use drizzle query-builder or a parameterised `sql\`\`` (no string interpolation).
     - New `getAllFileFacts(repoId)`: `file_facts` rows for the repo ordered by `file_path asc`.
     - `tryGetIndexState`: project `coverage` from `stats`. `totalSourceFiles` = `stats.totalCandidates` when it is a number, else `null`; `bounded` = number or 0; `softBudgetReached` = `=== true`.
   - `service.ts`:
     - `getIndexedFiles(repoId)` returns `[]` when `!config.repoIntelEnabled`, else delegates to the repository.
     - `getEndpoints(repoId)`: `[]` when the flag is off. Otherwise flatten `getAllFileFacts` → `{ file, endpoint }` for every `endpoints` entry, ordered by file asc then endpoint asc. De-duplicate equal `(file, endpoint)` pairs.
     - `getCriticalPaths`: in the adjacency sort at `:687-689`, break rank ties with `a.localeCompare(b)`. `roots` already come from the tie-broken `getRankedPaths`.
     - `isJunkPath`: test the patterns against `'/' + path.toLowerCase()` and add `'/fixtures/'` to `JUNK_PATH_PATTERNS` (D-25c). Update the doc comment at `:708-712`.
   - `pipeline/incremental.ts` (AC-87). Do **not** carry the prior stats forward: a carried value goes stale as soon as a file is added.
     - At `:218`, keep the whole walk: `const walk = await walkClone(repo.clonePath)` declared before the `try`, so its stats are available after it. Use `walk.files` where `allFiles` is used today.
     - In `stats` (`:245-255`), add `totalCandidates: walk.stats.totalCandidates`, `bounded: walk.stats.bounded`, `skippedTooLarge: walk.stats.skippedTooLarge`, `filesSeen: walk.files.length` and `softBudgetReached: false`. The incremental pass has no soft budget.
     - If the walk itself threw (it is inside the graph `try`), fall back to carrying `state.coverage` forward and set `graphFailed`, as today.
     - At `:260`, replace `newFilesIndexed = state.filesIndexed + filesIndexed` with the full pass's terms (rev. 5, F-54): `refreshCounts` gives `filesIndexed` = walked files that parsed and `filesSkipped` = too-large plus parse failures, with `filesIndexed + filesSkipped ≤ totalCandidates`. Nothing is re-added on every refresh, so there is no drift. The tour's N still reads the `file_rank` count (D-23).
     - Keep `newFilesSkipped = walk.stats.skippedTooLarge + filesSkipped` (this slice's parse failures).
     - The `sha_unchanged` and `no_supported_changes` branches do not rewrite `stats` (`touchIndexState(repoId)` without stats, `advanceSha`), so M stays the latest walk's value.
   - Checkpoint: server verify `--related` on the four files, **plus** `test/repo-intel-rank-map.test.ts`, `test/conventions-extract.test.ts`, `test/repo-intel-facade-degraded.test.ts` and `test/indexer-pipeline.test.ts` (unit), and `test/conventions.it.test.ts` (`--it`). These can pin the old ranking order and junk filter. A failure that is a **pinned old order** gets the new order in this step and is reported under `## Deviations`. Any other failure is a regression. `pnpm arch` green.

### server — onboarding module

3. **server** · `modules/onboarding/constants.ts`, `modules/onboarding/schema.ts` (new) · skills `zod`, `onion-architecture` · covers AC-21, AC-35, AC-48, AC-52, AC-53, AC-66, AC-71, AC-83
   - `constants.ts`, each with a one-line comment naming its AC or D:
     - `FACTS_MAX_CHARS = 40_000`, `EXCERPT_MAX_CHARS = 6_000`, `MAX_ROUTES = 60`, `MAX_FOLDERS = 30`, `MAX_SUB_MANIFESTS = 4` (AC-66, AC-68);
     - `MAX_CRITICAL_ROWS = 6`, `READING_PATH_SIZE = 8`, `TODO_SCAN_FILES = 30`, `MAX_CANDIDATES = 15`, `MIN_MODEL_TASKS = 3`, `MAX_TASKS = 5`;
     - `OUTPUT_MAX_TOKENS = 10_000` (AC-83 as amended, F-37), `GENERATION_TIMEOUT_MS = 120_000`, `GENERATION_TEMPERATURE = 0`, `GENERATION_MAX_RETRIES = 0`;
     - `TOUR_SCHEMA_NAME = 'OnboardingTour'`, `TOUR_PROMPT_FILE = 'onboarding.system.md'`, `TOUR_LANGUAGE = 'English'`;
     - `TODO_TEXT_MAX = 200`, `ONE_LINE_MAX = 200`, `COMMENT_MAX = 160`, `LABEL_MAX = 40`, `MAX_COMPONENTS = 12`, `MAX_CONNECTIONS = 24`, `MAX_ENV_NAMES = 50`, `OPEN_PR_LIMIT = 50`, `FACTS_CACHE_ENTRIES = 20`, `FAILURE_MESSAGE_MAX = 300`, `STORED_TOUR_VERSION = 1`;
     - `SCRIPT_ALLOW_LIST = ['dev','start','serve','build','test','migrate','db:migrate','seed','db:seed'] as const`, exactly AC-40 and in D-9 order;
     - `LOCKFILE_INSTALL` (D-7, lockfile → command, no fallback), `SAFE_DIR_SEGMENT = /^[A-Za-z0-9._-]+$/` (D-44), `ENV_EXAMPLE_NAMES`, `COMPOSE_FILE_NAMES` (D-8), `FRAMEWORK_DEPENDENCIES`. The last maps a dependency name to a label: `next`→Next.js, `react`→React, `vue`→Vue, `svelte`→Svelte, `@angular/core`→Angular, `fastify`→Fastify, `express`→Express, `@nestjs/core`→NestJS, `koa`→Koa, `hono`→Hono, `drizzle-orm`→Drizzle ORM, `prisma`/`@prisma/client`→Prisma, `typeorm`→TypeORM, `mongoose`→Mongoose, `vitest`→Vitest, `jest`→Jest, `@playwright/test`→Playwright, `tailwindcss`→Tailwind CSS, `zod`→Zod, `@tanstack/react-query`→TanStack Query;
     - `EXTENSION_LANGUAGE`: `.ts .tsx` → TypeScript, `.js .jsx .mjs .cjs` → JavaScript.
   - `schema.ts`:
     - `TourNarrative`, the model's answer. Every field is required (strict json_schema mode). No `.min`/`.max`: caps are enforced by grounding (step 6). `.describe()` carries field meaning, as in `conventions/constants.ts:75-101`:
       ```ts
       z.object({
         architecture: z.object({
           prose: z.string(),
           components: z.array(z.object({ id: z.string(), label: z.string(), kind: TourComponentKind, ref: z.string() })),
           connections: z.array(z.object({ from: z.string(), to: z.string() })),
         }),
         critical_paths: z.array(z.object({ path: z.string(), reason: z.string() })),
         commands: z.array(z.object({ id: z.string(), comment: z.string() })),
         reading_path: z.array(z.object({ path: z.string(), why: z.string() })),
         tasks: z.array(z.object({ candidate_id: z.string(), title: z.string(), reason: z.string() })),
       })
       ```
     - `StoredTour` (D-4): `z.object({ v: z.literal(1), revision, index_files, source_files: nullable, coverage_partial, index_partial, trimmed, provider, model, cost_usd: nullable, sections: TourSections })`.
4. **server** · `modules/onboarding/facts/helpers.ts` (new, pure) · skills `onion-architecture`, `security`, `typescript-expert` · covers AC-20, AC-23, AC-34, AC-35, AC-36, AC-38, AC-40, AC-45, AC-46, AC-48, AC-49, AC-52, AC-53, AC-61, AC-64, AC-68, AC-88 (derivation order)
   - Every function is pure and deterministic. Every sort has a total tie-break.
   - `parseManifest(text)` → `{ scripts: Record<string,string>; deps: string[]; packageManager: string | null; enginesNode: string | null } | null`. This is a `JSON.parse` inside try/catch, plus a zod `safeParse` of the four fields. Invalid input → `null`.
   - `isSafeDir(dir)` (D-44): every segment matches `SAFE_DIR_SEGMENT` and is not `.`/`..`.
   - `pickSubManifestDirs(treePaths, indexedPaths)` → at most 4 dirs (D-6), unsafe dirs excluded **before** the pick, so they do not use up a slot.
   - `installCommand(dir, treePaths)` (D-7) → the lockfile's command, or `null` when the dir has no lockfile.
   - `deriveCommands({ treePaths, manifests })` → `{ id, command }[]` in D-9 order with ids `cmd-<n>`. Only allow-listed script names, only safe dirs (INV-15). An empty result means AC-45 applies.
   - `envExampleNames(text)` (D-8). It returns **names only**, de-duplicated in file order, at most 50. Values are never returned or kept.
   - `findReadme(treePaths)`, `findEnvExample(dir, treePaths)`, `findCompose(treePaths)` (D-8).
   - `excerpt(text)` → the first `EXCERPT_MAX_CHARS` chars (AC-68).
   - `detectStack({ indexed, manifests, treePaths })` → `TourStack`:
     - languages from `EXTENSION_LANGUAGE` over indexed paths, count desc then name asc;
     - frameworks: labels of `FRAMEWORK_DEPENDENCIES` hits across manifests, in table order, de-duplicated;
     - runtime: `"Node.js"` (+ `" <engines.node>"` from the root manifest when present) when any manifest parsed, then the lockfile managers' names, then `"Docker Compose"` when a compose file exists.
   - `topLevelFolders(indexedPaths)` → `TourFolder[]`, at most 30 (D-6).
   - `readingRows(topPaths, indexedFiles)` → `TourFileRow[]` with `reason: null`, `importers` and `top_percent` (D-14). The input is already ranked and junk-filtered by the facade.
   - `criticalRows(chains, indexedFiles)` → flatten in chain order, keep the first occurrence, take 6 (AC-35). `[]` when `chains` is empty (AC-38).
   - `scanTodos(path, text)` (D-15), `missingTestCandidates(scanPaths, treePaths)` (D-16), `openPrCandidates(pulls)` (D-17), `orderCandidates(fileCandidates, prCandidates, rankIndex)` → at most 15 (D-18).
   - `topPercent(percentile)`, `oneLine(text, max)` (collapse whitespace and newlines, cut with `…`).
5. **server** · `modules/onboarding/prompt/helpers.ts` (new, pure) · skills `onion-architecture`, `security` · covers AC-60, AC-66, AC-67, AC-69
   - `renderFactBlocks(facts)` → an ordered list `{ key, droppable: 'readme' | 'manifest' | 'route' | 'folder' | null, text }`. Each block is `wrapUntrusted(label, body)`, imported from `@devdigest/reviewer-core`. Labels: `stack`, `folders`, `routes`, `readme`, `manifest:<path>`, `env-example-names`, `reading-path`, `critical-paths`, `commands`, `task-candidates`.
   - Each of these is inside an untrusted block: README excerpt, manifest excerpts, every file path, TODO text, route strings, PR titles (AC-60).
   - Routes come first sorted by the file's ranked index then endpoint asc, then cut to 60. Folders are cut to 30.
   - `fitBudget(blocks)` → `{ text, trimmed }`. While `text.length > FACTS_MAX_CHARS`, drop in this order (AC-67):
     1. the README block;
     2. non-root manifest blocks, last first;
     3. route lines, from the end of the list;
     4. folder lines, from the end of the list.
     Reading path, critical paths, commands and candidates are never dropped. `trimmed` is true iff anything was dropped (AC-69). If it still does not fit, return what is left with `trimmed: true` (R-6).
   - `buildUserMessage(repoFullName, factsText)`: one trusted instruction line naming the repo and the five sections, then the facts. No keyword scanning anywhere (`reviewer-core/AGENTS.md` invariant 3).
6. **server** · `modules/onboarding/grounding/helpers.ts` (new, pure) · skills `onion-architecture`, `security` · covers AC-31 (server part), AC-33, AC-36, AC-41, AC-49, AC-50, AC-54, AC-55, AC-56, AC-61, AC-72, AC-85 (server part), AC-88
   - `buildKnownSet({ treePaths, indexedPaths })` (D-26). It is used for the prose scrub only.
   - `groundComponents(components, connections, refs)` (D-11). `refs` = **indexed paths ∪ top-level folder names ∪ dependency names of manifests read under AC-68**, lower-cased. Not the tree, and not the compose file. When fewer than 2 components or 0 connections survive, return `{ components: [], connections: [] }` (AC-85).
   - `mergeReasons(rows, modelEntries, { ordered })`:
     - critical paths use `ordered: false`: a model reason for a path in `rows` fills that row's `reason`, and other entries are ignored (AC-36);
     - reading path uses `ordered: true`, the monotone rule (D-13, AC-49, AC-50).
     - Reasons go through `oneLine(…, ONE_LINE_MAX)`. An empty reason → `null`.
   - `orderCommands(derived, modelCommands)` (D-10, AC-41, AC-88) → `TourCommand[]` with `step` 1..n: model-ordered known ids first, then the omitted derived commands in derivation order with `comment: null`.
   - `groundTasks(candidates, modelTasks)` (AC-54, AC-55, AC-56):
     - walk the model tasks and keep a task iff its `candidate_id` is a known candidate not used by an earlier kept task;
     - take the first 5, with `source: 'model'`, title and reason one-lined;
     - if fewer than 3 survive, return `fallbackTasks(candidates)` = the first 5 candidates with `source: 'fallback'` (D-19).
   - `scrubProse(prose, known)` (D-26, AC-31, AC-61). It does **not** strip `_`, and it does not parse or emit HTML.
   - `classifyGenerationError(err)` → `{ code: TourFailureCode, message }` (D-20, AC-72). For `invalid_output`, `message` is exactly `"the model returned invalid output"`.
7. **server** · `modules/onboarding/helpers.ts` (new, pure, tour assembly) · skills `onion-architecture`, `typescript-expert` · covers AC-07, AC-12, AC-13, AC-14, AC-15, AC-16, AC-26, AC-34, AC-38, AC-45, AC-51, AC-56, AC-58, AC-59, AC-61, AC-69, AC-74, AC-84, AC-86, AC-87
   - `deriveStatus({ clonePath, indexState, indexedCount, storedValid, keyMissing, running })` → `{ status, index_reason, blockers, can_generate }` (D-24, D-41, D-45):
     - `status`: `generated` if `storedValid` (D-45), else `not_cloned` / `index_not_ready` / `ready`;
     - `blockers`, in order: `not_cloned` if no clone; `index_not_ready` if cloned and the index is not ready; `no_api_key` if `keyMissing` (AC-86, independent of the other two);
     - `can_generate = blockers.length === 0 && !running`.
   - `noCloneSections(openPrCandidates)` (AC-58):
     - architecture: empty stack and folders, `gap: 'needs_clone'`;
     - critical paths, run locally and reading path: `gap: 'needs_clone'`;
     - first tasks: `fallbackTasks` of the open-PR candidates, or `gap: 'no_candidates'` when there are none (AC-59).
   - `skeletonSections(facts)` (AC-26, AC-15, AC-34):
     - architecture: `prose: null`, `components: []`, `stack`, `folders`, with `gap: 'needs_index'` when the index has no ranking;
     - critical paths: `criticalRows`, with `gap: 'needs_index'` when nothing is ranked (rev. 5, F-57), else `gap: 'no_edges'` when empty (AC-38);
     - run locally: `commands` from `deriveCommands` with `comment: null` (`gap: 'no_manifest'` when empty, AC-45);
     - reading path: `readingRows` (`gap: 'not_ranked'` when not ranked, AC-51);
     - first tasks: `fallbackTasks` (`gap: 'no_candidates'` when empty, AC-59).
   - `generatedSections(facts, grounded)`: the same rows plus the model reasons, ordered commands, model tasks and scrubbed prose.
   - `toTourDto({ repo, status, stored | skeleton, generation, currentIndexSha })` → `OnboardingTour`. `meta` is built from the stored envelope, plus `outdated = stored.revision !== currentIndexSha` (AC-74). `meta` is null unless the status is `generated`. `sections` always has five keys (AC-07).
8. **server** · `modules/onboarding/repository.ts` (new) · skills `drizzle-orm-patterns`, `onion-architecture`, perf rubric · covers AC-24, AC-25, AC-52, AC-58, AC-65
   - `export class OnboardingRepository { constructor(private db: Db) }`. Its methods:
     - `getStored(repoId)` → `{ json: unknown; generatedAt: Date } | undefined`;
     - `upsert(repoId, json, generatedAt)`: `insert … onConflictDoUpdate({ target: t.onboarding.repoId, set: { json, generatedAt } })` (AC-24, replacing);
     - `listOpenPulls(workspaceId, repoId, limit)`: `pull_requests` where `workspace_id = ws AND repo_id = repo AND status NOT IN ('merged','closed')`, ordered `updated_at desc nulls last, number desc`, limit (D-17). Selected columns: `number, title, author, updatedAt`.
   - It touches only `onboarding` (read/write) and `pull_requests` (read), never an index table (INV-2).
9. **server** · `server/src/prompts/onboarding.system.md` (rewrite) · skill `security` · covers AC-21, AC-30, AC-31, AC-33, AC-41, AC-50, AC-54, AC-60, AC-62
   - Keep line 1's role, the `SECURITY:` paragraph (`:11-12`) **verbatim** (D-27), and the grounding rules (`:14-18`). Keep `{{language}}` and the "do not translate identifiers" lines (`:42-44`).
   - Remove `{{sections}}`, every mermaid instruction (`:6-9`, `:23-37`), and `routes_and_apis`.
   - Add the five-part answer, one field each:
     - `architecture.prose`: stack, entry points and request flow, in 2–5 short paragraphs or bullets. Every path and identifier goes in backticks;
     - `architecture.components`/`connections`: each `ref` must be an indexed file path, a top-level folder, or a dependency name copied from the facts. No URLs;
     - `critical_paths`: one reason per given path, and paths only from the `critical-paths` block;
     - `commands`: order the given command ids for a first run and comment each. Never write a command;
     - `reading_path`: one `why` per given path, in the given order;
     - `tasks`: 3–5 tasks, each with exactly one `candidate_id` from `task-candidates`.
   - "Markdown only, no HTML" stays (`:38-40`).
10. **server** · `modules/onboarding/service.ts` (new), `platform/container.ts` (10c) · skills `onion-architecture`, `security`, perf rubric · covers AC-14, AC-15, AC-16, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-28, AC-29, AC-44, AC-60, AC-64, AC-65, AC-68, AC-70, AC-71, AC-72, AC-73, AC-74, AC-83, AC-84, AC-86, AC-87. The step has three units, each with its own checkpoint (D-47): **10a** types, deps and `collectFacts` + cache; **10b** `getTour`; **10c** `hasLlmKey`, `startGeneration` and `run`.
    - **10a.** Local structural types, with no import from another module:
      - `RepoLocator = { id; owner; name; fullName; defaultBranch; clonePath: string | null }`;
      - `IndexFacade = { getIndexState(repoId): Promise<{ status; lastIndexedSha; updatedAt: Date; reason?; degradedReason?; coverage? }>; getIndexedFiles(repoId); getEndpoints(repoId); getTopFilesByRank(repoId, n); getCriticalPaths(repoId) }` (row shapes declared locally, structurally equal to step 2's).
    - `OnboardingServiceDeps = { db: Db; repos: { getById(ws, id): Promise<RepoLocator | undefined> }; repoIntel: IndexFacade; git: GitClient; featureModel: (ws: string) => Promise<FeatureModelChoice>; llm: (provider: Provider) => Promise<LLMProvider>; hasLlmKey: (provider: Provider) => Promise<boolean>; now?: () => Date; generationTimeoutMs?: number }`. The constructor does `this.store = new OnboardingRepository(deps.db)`.
    - State:
      - `private running = new Map<string, Promise<void>>()`;
      - `private failures = new Map<string, TourGeneration['failure']>()`;
      - `private factsCache`: an LRU `Map` of 20 entries (D-33).
    - Checkpoint 10a: typecheck plus `--related` on `service.ts`.
    - **10b.** `async getTour(ws, repoId): Promise<OnboardingTour>` (AC-25, INV-16: **never** calls `deps.llm`, `completeStructured` or touches `running`):
      - unknown repo → `NotFoundError`;
      - read `indexState`, `stored` (`StoredTour.safeParse`) and open PRs;
      - `{ provider, model } = await deps.featureModel(ws)`, then `missing = !(await deps.hasLlmKey(provider))`. This gives `api_key` and the `no_api_key` blocker (AC-86, D-42). No client is built and no request is sent;
      - if a valid stored tour exists → its sections, **whatever** the clone and index state (D-45);
      - else if there is no clone → `noCloneSections`;
      - else → `skeletonSections(await this.collectFacts(…))`;
      - return `toTourDto` with `deriveStatus` (D-41).
      - Checkpoint 10b: `--related`.
    - **10a (continued).** `private async collectFacts(repo, indexState)` (AC-20, AC-68, AC-64, AC-23):
      - revision per D-5;
      - `treePaths = (await git.listFilesAt(ref, revision)).map(f => f.path)`;
      - `indexed = await repoIntel.getIndexedFiles(id)`;
      - `top8 = getTopFilesByRank(id, 8)`, `top30 = getTopFilesByRank(id, 30)`, `chains = getCriticalPaths(id)`, `endpoints = getEndpoints(id)`;
      - manifests via `readFileAt` for the root and ≤ 4 sub dirs, excerpted;
      - README and env-example via `readFileAt`, excerpted;
      - TODO scan over `top30`, excerpted;
      - a read error on one file → that fact is absent, never a throw.
      - `readFileAt` is called **only** on: `package.json` paths, the README, the env-example, and the `top30` paths. Lockfiles and compose files are matched by name from `treePaths` and never read (AC-68, AC-64).
      - Memoised per D-33.
    - **10c.** `platform/container.ts`: hoist the provider → secret-key mapping out of `buildLlm` (`:218-238`) into a module const `KEY_FOR`, and use it in `buildLlm`. Add `async hasLlmKey(id): Promise<boolean>` (D-42): `true` when `this.overrides.llm?.[id]` is set, else `!!(await this.secrets.get(KEY_FOR[id]))`. No client is built. `routes.ts` (step 11) passes `hasLlmKey: (p) => app.container.hasLlmKey(p)`.
    - `startGeneration(ws, repoId): Promise<{ done: Promise<void> }>`, race-free (D-43, INV-17):
      0. **Synchronously, before any `await`:** `if (running.has(repoId)) throw new AppError('tour_generation_running', 'A tour is already being generated', 409)` (AC-28). Then `const lock = deferred<void>(); running.set(repoId, lock.promise)`.
      1. `try {` unknown repo → `NotFoundError`.
      2. No clone → `AppError('tour_not_cloned', …, 422)` (AC-14). Index not ready (D-24) → `AppError('tour_index_not_ready', …, 422)` (AC-15). A `partial` index with a ranking passes (AC-16).
      3. `{ provider, model } = await deps.featureModel(ws)` (AC-22).
      4. `llm = await deps.llm(provider)`. On `ConfigError` → record the failure `no_api_key` and throw 422 `tour_no_api_key` "No API key for <provider>" (AC-70, D-22).
      5. `} catch (e) { running.delete(repoId); lock.resolve(); throw e; }`
      6. Clear the previous failure. `const job = await deps.jobs.enqueue(ws, TOUR_JOB_KIND, { workspaceId, repoId, provider, model })` (D-3). `done = job.done.finally(() => { running.delete(repoId); lock.resolve(); })`. Return `{ done }` without awaiting it (AC-29). A rejected `enqueue` is a pre-check failure: the lock is released as in 5.
    - The job handler, registered in the constructor with `deps.jobs.register(TOUR_JOB_KIND, (p) => this.handleJob(p))`, calls `run(…)` inside a `try/catch` that records the failure and **never rethrows** (D-3).
    - `private async run(…)`:
      - `facts = collectFacts` → `fitBudget(renderFactBlocks(facts))` → `system = renderPrompt(TOUR_PROMPT_FILE, { language: TOUR_LANGUAGE })` (from `platform/prompts.ts`);
      - **exactly one** call, `withTimeout(llm.completeStructured({ model, schema: TourNarrative, schemaName: TOUR_SCHEMA_NAME, temperature: 0, maxTokens: 10000, timeoutMs, maxRetries: 0, messages: [system, user] }), timeoutMs)` (AC-21, AC-71, AC-83, INV-4);
      - ground (step 6) → `generatedSections` → `store.upsert(repoId, StoredTour, now())` with `provider`, `model`, `cost_usd: result.costUsd`, `revision`, `index_files: indexed.length`, `source_files`, `coverage_partial`, `index_partial: indexState.status === 'partial'`, `trimmed` (AC-24, AC-84, AC-12, AC-13, AC-16, AC-69);
      - any error → `failures.set(repoId, { ...classifyGenerationError(err), provider, at: now().toISOString() })`. **Nothing is stored**, and the previous stored row is untouched (AC-71, AC-72, AC-73). The promise resolves; it never rejects to the caller.
    - No `child_process`, no `node:fs`, no `.env` read (AC-44, AC-64, INV-7).
    - Checkpoint 10c: `--related` on `service.ts` and `container.ts`, then `pnpm arch`.
11. **server** · `modules/onboarding/routes.ts` (new), `modules/index.ts` · skills `fastify-best-practices`, `onion-architecture`, `security`, `zod` · covers AC-19, AC-27, AC-28, AC-65, AC-86
    - Build the service once (D-38): `new OnboardingService({ db: app.container.db, repos: app.container.reposRepo, repoIntel: app.container.repoIntel, git: app.container.git, featureModel: (ws) => app.container.featureModel(ws, 'onboarding'), llm: (p) => app.container.llm(p), hasLlmKey: (p) => app.container.hasLlmKey(p) })`.
    - `GET /repos/:id/tour`, `{ schema: { params: IdParams } }`: `getContext` → `requireRepoInWorkspace` (404 for unknown or foreign, AC-19, AC-65) → `service.getTour`.
    - `POST /repos/:id/tour/generate`, same schema: `getContext` → `requireRepoInWorkspace` → `await service.startGeneration(…)` → `reply.code(202); return { running: true }`. Errors propagate as `AppError`s and are never built by hand.
    - `modules/index.ts`: one import, plus one entry `onboarding`.
    - Checkpoint: server verify `--baseline … --it` shows no `new` failure. `pnpm arch` green with no new violation (INV-1, INV-2, INV-9, INV-10, INV-14).

### client

12. **client** · `src/vendor/ui/nav.ts`, `src/components/app-shell/helpers.ts` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-01, AC-04, AC-05
    - `nav.ts`: insert `{ key: "onboarding-tour", label: "Onboarding Tour", icon: "Workflow", href: "/repos/:repoId/tour" }` **between** `pulls` and `context` (D-30). Extend the header comment (`:21-32`) to name this item for a re-vendor.
    - `helpers.ts:29`: replace `if (pathname.includes("/onboarding")) return "onboarding-tour";` with `if (/^\/repos\/[^/]+\/tour(\/|$)/.test(pathname)) return "onboarding-tour";`. Now `/onboarding` maps to `""` (AC-05).
13. **client** · `src/lib/hooks/onboarding.ts` (new) · skills `frontend-ui-architecture`, `typescript-expert`, `react-best-practices` · covers AC-17, AC-18, AC-25, AC-27, AC-28, AC-29
    - `useTour(repoId)`: `useQuery({ queryKey: ["tour", repoId], queryFn: () => api.get<OnboardingTour>(\`/repos/${repoId}/tour\`), enabled: !!repoId, refetchInterval: (q) => (q.state.data?.generation.running ? 2000 : false) })` (D-39). It refetches on mount, so a user who returns sees the result (AC-29).
    - `useGenerateTour(repoId)`: `useMutation({ mutationFn: () => api.post<TourGenerateAccepted>(\`/repos/${repoId}/tour/generate\`) })`. `onSuccess`: patch the cache to `generation.running = true`, then `invalidateQueries(["tour", repoId])`. `onError` also invalidates, because the server recorded a `no_api_key` failure.
    - `import type` only from `@devdigest/shared`. No `fetch` here: it goes through `api`.
14. **client** · `src/app/repos/[repoId]/tour/page.tsx` (thin), `_components/TourView/{TourView.tsx,constants.ts,helpers.ts,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `next-best-practices`, `react-best-practices` · covers AC-02, AC-06, AC-07, AC-14, AC-15, AC-17, AC-18, AC-19, AC-26, AC-27, AC-28, AC-70, AC-71, AC-73, AC-86
    - **First** create `client/messages/en/onboarding.json` with the full key list of step 22 (D-46), so every component written in steps 14–21 renders real strings.
    - `page.tsx` follows `context/page.tsx`: a header comment, then `return <TourView />`.
    - `TourView` states, in order (the `ProjectContextView.tsx:28-139` pattern):
      - `useRepoNotFound(routeRepoId)`, **or** the query failing with `ApiError.status === 404` → `<RepoNotFound />` (AC-19);
      - loading → five section-shaped `Skeleton`s under the header (AC-17);
      - error → `ErrorState` with `ApiError.message` and Retry → `refetch()` (AC-18);
      - data → the `TourHeader`, the `OnThisPage` aside, and the five `TourSection`s in `SECTION_ORDER` (AC-07), whatever the status.
    - The crumb is `[{ label: full_name, mono: true }, { label: t("title") }]` (AC-06).
    - `constants.ts`: `SECTION_ORDER = ["architecture", "critical-paths", "run-locally", "reading-path", "first-tasks"]`, with the title keys and DOM ids `tour-<key>`.
    - `TourHeader/helpers.ts` (step 15's folder, F-01; not `TourView/helpers.ts`): the `StatusLine` type and `statusLines(tour)` → an ordered list (D-41):
      - one line per entry of `tour.blockers`, in order: `not_cloned` → "Not cloned — clone to generate"; `index_not_ready` → "Index not ready — {reason}"; `no_api_key` → "No API key for {api_key.provider}" with a Settings link (AC-14, AC-15, AC-86);
      - then the failure line "Generation failed — {reason}" when `generation.failure` is set and `status !== 'generated'` (AC-71). For `failure.code === 'no_api_key'`, this line is skipped when the `no_api_key` blocker already shows (AC-70), so there is no duplicate.
      - The notice rule: a failure **with** `status === 'generated'` → the dismissible notice (AC-73).
15. **client** · `TourView/_components/TourHeader/{TourHeader.tsx,helpers.ts,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-06, AC-12, AC-13, AC-14, AC-16, AC-26, AC-27, AC-28, AC-69, AC-70, AC-71, AC-73, AC-74, AC-75, AC-76, AC-77, AC-84, AC-86, AC-87 (renders the N/M the server sends)
    - `<h1>` "Onboarding for <span accent>{name}</span>" (AC-06).
    - When `meta` is set, the header line reads "Generated from index of {N} files · last refreshed {relative}" (D-31). With `coverage_partial` it reads "… index of {N} of {M} source files indexed …" (AC-12, AC-13).
    - The line's `title` is "{provider} / {model} · {cost}", or "… · cost unknown" (AC-84, D-28).
    - Badges next to the line: "partial index" (AC-16) and "built from a trimmed fact set" (AC-69).
    - The primary button:
      - "Generate tour" when `status !== 'generated'`, "Regenerate" otherwise (AC-26, AC-27);
      - disabled with "Generating…" while `generation.running` or the mutation is pending (AC-28);
      - disabled when `!can_generate`, i.e. any blocker. With `not_cloned` the wrapping `<span title>` reads "A clone and an index are required" (AC-14). With only `no_api_key` the title reads "No API key for {provider}" (AC-86).
    - Next to the button, the badge "Outdated — the repository has changed since this tour was generated" when `meta.outdated` (AC-74).
    - The status lines from `statusLines` in this folder's `helpers.ts`, each `no_api_key` line with a link `/settings/api-keys` (AC-70, AC-86). The dismissible notice "Regeneration failed — {reason}" (AC-73, D-32).
    - The "Share link" `CopyControl` copies `${window.location.origin}/repos/${repoId}/tour` (AC-75).
16. **client** · `TourView/_components/OnThisPage/{OnThisPage.tsx,helpers.ts,styles.ts,index.ts}`, `TourView/_components/TourSection/{TourSection.tsx,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-08, AC-09, AC-10, AC-11, AC-80, AC-81
    - `TourSection` props `{ id, title, children }`. It holds a `<section aria-labelledby>`, an `<h2 id tabIndex={-1}>`, and a collapse `<button aria-expanded aria-controls>` named "Collapse {title}"/"Expand {title}". Local `useState(true)` makes every section open on load (AC-10, AC-11).
    - `OnThisPage`:
      - a `<nav aria-label="On this page">` with five buttons in `SECTION_ORDER` (AC-08);
      - a click runs `el.scrollIntoView({ behavior: "smooth", block: "start" })`, then `heading.focus()` (AC-09);
      - the active entry gets `aria-current="true"` from `activeSection(tops)` in `helpers.ts`: the id whose heading `top` is the closest to 0, ties to the earlier one. It is recomputed on a passive `scroll` listener on `window` (AC-81).
    - The aside has `hidden lg:block`, and the sections column takes the full width below `lg` (1024 px, AC-80).
17. **client** · `TourView/_components/CopyControl/{CopyControl.tsx,helpers.ts,constants.ts,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-42, AC-75, AC-76, AC-77
    - Props `{ text, label, ariaLabel }`. A click calls `copyText(text)` from `helpers.ts`: `navigator.clipboard?.writeText` → true, false on reject or absence.
    - On success it shows "Copied" for `COPIED_MS = 2000` next to the control, via a `role="status"` live region (AC-76).
    - On failure it shows a read-only `<input>` with the text selected on focus, plus "Copy it manually" (AC-77).
18. **client** · `TourView/_components/ArchitectureSection/{ArchitectureSection.tsx,styles.ts,index.ts}`, `TourView/_components/ArchitectureDiagram/{ArchitectureDiagram.tsx,helpers.ts,constants.ts,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices`, `security` · covers AC-30, AC-31, AC-32, AC-34, AC-62, AC-63, AC-85
    - When `prose` is set: `<UntrustedMarkdown inertLinks>{prose}</UntrustedMarkdown>` (AC-30, AC-31, AC-62). `inertLinks` renders every link as inert text and is the link guarantee (D-26, F-29), then the diagram iff `components.length >= 2 && connections.length >= 1` (AC-85: otherwise nothing, and no error).
    - Without `prose` (skeleton): a stack list (languages with counts, frameworks, runtime) and a folder list with counts (AC-34). A `gap` → its message.
    - `ArchitectureDiagram`:
      - `layoutDiagram(components, connections)` in `helpers.ts`, pure and deterministic: layer = the longest path from the sources over the connections, with back-edges ignored by DFS in input order; order within a layer is input order; fixed box size and gaps → `{ nodes: {id,x,y,w,h}[], edges: {x1,y1,x2,y2}[], width, height }`;
      - render: an `<svg role="img" aria-label={t("diagramLabel",{count})}>` with `<rect>`, `<text>` (plain text, label from props, AC-63) and `<line markerEnd>`;
      - `KIND_COLORS: Record<TourComponentKind, string>` in `constants.ts` (CSS variable tokens), with the type import only (AC-32);
      - no `onClick`, no `<a>`, no `dangerouslySetInnerHTML` (AC-63);
      - a visually hidden `<ul>` lists "A → B" for screen readers.
19. **client** · `TourView/_components/FileRow/{FileRow.tsx,helpers.ts,styles.ts,index.ts}`, `TourView/_components/CriticalPathsSection/`, `TourView/_components/ReadingPathSection/` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-35, AC-36, AC-37, AC-38, AC-48, AC-49, AC-51, AC-78, AC-79
    - `FileRow` props `{ index?, row, repoFullName, revision }`. It shows the path as `<code title={path}>{middleTruncate(path, PATH_MAX)}</code>` (AC-78), then " — ", then `row.reason ?? t("reason.index", { importers, top })` (AC-36, AC-49).
    - "Open" is an `<a href={githubBlobUrl(repoFullName, revision, path)} target="_blank" rel="noopener noreferrer" aria-label={t("open", { path })}>` (AC-37, AC-79). It is hidden when `revision` is null.
    - `CriticalPathsSection`: unnumbered rows (AC-35), and the `no_edges` message (AC-38).
    - `ReadingPathSection`: an `<ol>` of numbered rows (AC-48), and the `not_ranked` message with `index_reason` (AC-51).
20. **client** · `TourView/_components/RunLocallySection/{RunLocallySection.tsx,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices` · covers AC-39, AC-42, AC-43, AC-45
    - An `<ol>`. Each row shows the step number, a monospace `<code>{command}</code>`, an optional comment, and a `CopyControl` with `text={command}` (no number) and `ariaLabel={t("copyCommand", { n: step })}` → "Copy command N" (AC-39, AC-42, AC-43).
    - `no_manifest` → "No run commands found in the repository's manifests" (AC-45). `needs_clone` → the AC-58 message.
21. **client** · `TourView/_components/FirstTasksSection/{FirstTasksSection.tsx,helpers.ts,styles.ts,index.ts}` · skills `frontend-ui-architecture`, `react-best-practices`, `security` · covers AC-54, AC-56, AC-57, AC-58, AC-59
    - Each task shows a title, a one-line reason, a kind tag `Badge` ("TODO" / "Missing tests" / "Open PR") and a link (AC-57):
      - title: `source === 'model'` → `title`; fallback → the fixed i18n title per kind (AC-56, D-19);
      - reason: model `reason`, or for a fallback the deterministic `detail` / index reason;
      - link: a file at its line, `githubBlobUrl(…, path, line)`, or a PR, `githubPrUrl(full_name, pr_number)`, in a new tab with `rel="noopener noreferrer"`.
    - All repo and model text renders as plain text.
    - `no_candidates` → "No starter tasks found in this repository" (AC-59). In the no-clone state only open-PR tasks appear (AC-58).
22. **client** · `client/messages/en/onboarding.json` (rewrite, D-29) · covers the text of every UI AC
    - Keys:
      - `title` "Onboarding Tour", `heading` "Onboarding for {name}";
      - `header.generated` "Generated from index of {files} files · last refreshed {when}", `header.generatedPartial` "Generated from index of {files} of {total} source files indexed · last refreshed {when}";
      - `header.modelTooltip` "{provider} / {model} · {cost}", `header.costUnknown` "cost unknown", `header.partialIndex` "partial index", `header.trimmed` "built from a trimmed fact set";
      - `actions.generate` "Generate tour", `actions.regenerate` "Regenerate", `actions.generating` "Generating…", `actions.needsCloneTooltip` "A clone and an index are required", `actions.noKeyTooltip` "No API key for {provider}", `actions.share` "Share link";
      - `status.notCloned` "Not cloned — clone to generate", `status.indexNotReady` "Index not ready — {reason}", `status.noApiKey` "No API key for {provider}", `status.apiKeysLink` "Settings → API Keys", `status.failed` "Generation failed — {reason}";
      - `notice.regenFailed` "Regeneration failed — {reason}", `notice.dismiss`, `outdated` "Outdated — the repository has changed since this tour was generated";
      - `failure.{no_api_key,timeout,provider_error,invalid_output,source_unreadable}` (`invalid_output` = "the model returned invalid output", AC-72; `source_unreadable` = the repository files could not be read, F-52), `indexReason.{no_data,no_clone,no_files,index_failed,repo_too_large,flag_off,not_ranked}`;
      - `sections.{architecture,criticalPaths,runLocally,readingPath,firstTasks}` (the exact AC-07 titles), `onThisPage` "On this page", `collapse` "Collapse {title}", `expand` "Expand {title}";
      - `gaps.needsClone` "Needs a clone and an index", `gaps.needsIndex`, `gaps.noEdges` "No critical paths — the import graph is empty", `gaps.notRanked` "No reading path — the repository has not been ranked yet", `gaps.noManifest` "No run commands found in the repository's manifests", `gaps.noCandidates` "No starter tasks found in this repository";
      - `reason.index` "imported by {importers} files · top {top}% by rank", `open` "Open {path}", `copyCommand` "Copy command {n}", `copied` "Copied", `copyManually` "Copy it manually";
      - `tasks.kind.{todo,missing-tests,open-pr}` ("TODO", "Missing tests", "Open PR"), `tasks.fallback.todo` "Resolve the TODO in {path}:{line}", `tasks.fallback.missingTests` "Add tests for {path}", `tasks.fallback.openPr` "Review PR #{n}: {title}", `tasks.openedBy` "opened by {author}";
      - `stack.*`, `diagramLabel` "Architecture diagram with {count} components", `loadError`.
    - No hardcoded user-facing string in the new JSX (INV-12). This step is the final pass over the file created in step 14 (D-46): every key used, none missing.
    - Checkpoint: client verify shows no `new` failure. `pnpm build` passes with `pnpm dev` stopped (`client/INSIGHTS.md:44-64`).

### tests (`test-writer`, phase 4)

**How these steps are written.** Each bullet is `AC-NN — given …, then …`. It can be authored from the requirements file plus the cited `D-n`, without reading the implementation. A test fails if and only if the observable behaviour breaks. Where a function name is given, it is the seam the plan defines in steps 1–22. Use it to reach the behaviour, but assert on outputs, not on internals.

23. **server-unit** · `server/test/onboarding-facts.test.ts` (new) · facts, commands, candidates
    - AC-40, AC-88 (derivation order) — given a tree with `pnpm-lock.yaml`, `package.json` (`scripts: { "db:seed", test, serve, dev, lint, typecheck, setup, "dev:api", release }`), `.env.example` and `docker-compose.yml`, the commands are exactly, in this order:
      - `cp .env.example .env`;
      - `docker compose up -d`;
      - `pnpm install`;
      - `pnpm run dev`, `pnpm run serve`, `pnpm run test`, `pnpm run db:seed` (allow-list order, D-9).
      `lint`, `typecheck`, `setup`, `dev:api` and `release` are **not** included (AC-40 allow-list).
    - AC-40 — every allow-list name (`dev, start, serve, build, test, migrate, db:migrate, seed, db:seed`) becomes a command when declared.
    - AC-40 — `package-lock.json` → `npm ci`; `yarn.lock` → `yarn install`; `bun.lock` → `bun install`. **No lockfile** (even with `packageManager: "pnpm@9"`) → **no install command**, and scripts use `npm run` (D-7). A sub-manifest gets the prefix `cd server && `.
    - AC-40 — a tree **without** a compose file or an env-example gives no compose or copy command. A compose file's content is never needed (the builder receives tree paths only).
    - AC-40, INV-15 (shell safety, D-44) — sub-dirs named `a b`, `x;rm -rf ~`, `$(id)`, `` `id` ``, `..` and `..` segments in a nested path produce **no** command at all: no `cd`, `cp` or script with that name. A safe dir `web-app_2` is used. No returned command contains `;`, `$(`, a backtick, `&&` other than the single `cd <dir> && ` prefix, `|` or a space-containing dir.
    - AC-45 — no `package.json` and no lockfile → an empty command list.
    - AC-64 — `envExampleNames("A=1\nexport B_KEY=secret\n# C=3\nD = x")` returns `["A","B_KEY","D"]`, and the string `secret` appears in no returned value.
    - AC-68 — `excerpt` of a 10,000-char text is 6,000 chars. With 6 first-level `*/package.json`, at most 4 dirs are picked, by indexed-file count (D-6).
    - AC-34, AC-20 — `detectStack` over indexed `a.ts, b.tsx, c.js` → languages `[{TypeScript,2},{JavaScript,1}]`; frameworks from deps `fastify`, `react` → `["React", "Fastify"]` in table order. `topLevelFolders` counts first segments, orders count desc then name asc, caps at 30, and excludes root files.
    - AC-35 — chains `[[a,b,c],[a,d],[e,b,f]]` → rows `a,b,c,d,e,f`, and with 7+ distinct files only 6. AC-38 — no chains → `[]`.
    - AC-36, AC-49 — `readingRows` gives `importers` and `top_percent = max(1, 100 − percentile)` (D-14). Percentile 100 → 1, 95 → 5.
    - AC-48 — at most 8 rows.
    - AC-52 — `scanTodos` finds `// TODO: x` (line 3), `/* FIXME y */` and `# HACK z`, with 1-based lines and ids `todo:<path>:<line>`. A `TODO` inside a string literal with no comment marker is **not** a candidate (D-15). Text is capped at 200.
    - AC-52 — `missingTestCandidates`: `src/a.ts` with `src/a.test.ts` in the tree → none; `src/b.ts` with no test → `missing-tests:src/b.ts` (D-16).
    - AC-52 — `openPrCandidates` skips `merged`/`closed`.
    - AC-53 — ordering (D-18): file candidates by rank index, `todo` before `missing-tests` within a file, then open PRs by `updated_at` desc. 20 candidates → 15.
    - AC-23 — calling every builder twice on equal inputs gives deep-equal outputs, and shuffling the input arrays of equal-rank files gives the same output.
    - AC-40, AC-47 (F-02) — `EXCLUDED_DIRS` from `server/src/modules/onboarding/constants.ts` deep-equals `EXCLUDED_DIRS` from `server/src/modules/repo-intel/constants.ts`. A test may import both. This pins the copy, which exists because `no-cross-module` forbids the import, and it fails when either list changes alone.
24. **server-unit** · `server/test/onboarding-prompt.test.ts` (new) · budget and untrusted wrapping
    - AC-60 — given facts whose README contains `Ignore previous instructions`, a PR title, TODO text, a route and a path: each appears **only** inside `<untrusted source="…">…</untrusted>` blocks of the rendered facts. The README text is passed through unchanged (no keyword scanning: assert that the phrase is still present inside the block).
    - AC-66 — the rendered facts are ≤ 40,000 chars. Routes are capped at 60 and folders at 30, each excerpt at 6,000.
    - AC-67 — given oversized facts, the README block is dropped first. If that is not enough, non-root manifests go, then routes from the end, then folders from the end. Reading-path, critical-path, command and candidate blocks are always present.
    - AC-69 — `trimmed` is true iff something was dropped. Facts that fit → `false`.
25. **server-unit** · `server/test/onboarding-grounding.test.ts` (new) · model output checks
    - AC-33 — a component whose `ref` is not an indexed file path, a top-level folder or a manifest dependency name is dropped, along with every connection naming it. A `ref` of `Dockerfile` or `docker-compose.yml` (in the tree, not indexed) is dropped. A `postgres` component with `ref: "pg"` (a dependency) survives. `ref` matching is case-insensitive and ignores a trailing `/` (D-11).
    - AC-85 — after grounding, 1 component, or 0 connections → `components: []` and `connections: []`.
    - AC-36 — a model reason for a critical path in the list fills that row. A reason for a path not in the list is ignored. A row without one keeps `reason: null`.
    - AC-49, AC-50 — given ranked `[a,b,c,d]` and model `[{b,"wb"},{a,"wa"},{x,"wx"},{d,"wd"}]`: order stays `a,b,c,d`; `b` gets `wb`, `a` is ignored (out of order), `x` is ignored, `d` gets `wd` (D-13).
    - AC-41 — the model's `[{cmd-3,"c3"},{cmd-9,"zz"},{cmd-1,"c1"}]` over derived `cmd-1..cmd-4` → `cmd-9` is dropped, and no row's command text is model-written (D-10).
    - AC-88 — the same input → rows `cmd-3 ("c3"), cmd-1 ("c1"), cmd-2 (null), cmd-4 (null)` with steps 1–4: the omitted ones come after the ordered ones, in derivation order, with no comment. Model `[]` → `cmd-1 … cmd-4` in derivation order, all comments `null`. A repeated id keeps its first position only.
    - AC-54, AC-55 — tasks referencing an unknown id, no id, or an id already used are dropped. 7 valid → 5.
    - AC-56 — 2 valid model tasks → the result is the top 5 candidates with `source: 'fallback'`. 0 candidates → `[]`.
    - AC-61, AC-31 — `scrubProse`: `` `src/ghost.ts` `` (not in K) is removed; `[see](docs/ghost.md)` becomes `see`; a bare `src/my_file.ts` (in K) becomes `` `src/my_file.ts` ``; `` `src/__init__.py` `` (in K) keeps both underscores; `[login](https://evil.example/x)` becomes `login`, with no `http` URL left in a link (D-26 (3)).
    - AC-61 — tasks and rows: a model task whose title names `src/ghost.ts` still links only to its candidate's fact path, and no grounded row has a path outside the facts.
    - AC-72 — `classifyGenerationError(new Error("OpenRouter structured output failed schema validation for OnboardingTour"))` → `{ code: 'invalid_output', message: 'the model returned invalid output' }`. The same for the OpenAI message (`openai.ts:132`) and `MockLLMProvider fixture failed schema`. A `TimeoutError` → `timeout`, a `ConfigError` → `no_api_key`. `new Error("OpenRouter returned no choices for OnboardingTour: quota")` → `provider_error`, as does anything else (D-20).
26. **server-unit** · `server/test/onboarding-tour.test.ts` (new) · status and assembly
    - AC-14, AC-58 — a repo with `clonePath: null` → `status: 'not_cloned'`, `can_generate: false`. Architecture, critical paths, run locally and reading path have `gap: 'needs_clone'`, and first tasks holds only `open-pr` fallback tasks.
    - AC-59 — the same with no PRs → `gap: 'no_candidates'`.
    - AC-15 — a cloned repo with index status `degraded`, or `failed`, or `full` but zero indexed files → `status: 'index_not_ready'`, `can_generate: false`, a non-null `index_reason`. Reading path `gap: 'not_ranked'` (AC-51).
    - AC-16 — `partial` + ranked files → `can_generate: true`. A generated tour from it has `meta.index_partial: true`.
    - AC-26 — cloned, ranked, nothing stored → `status: 'ready'`, `can_generate: true`, `meta: null`, deterministic sections.
    - AC-07 — every status yields `sections` with exactly the five keys.
    - AC-34, AC-38, AC-45 — skeleton architecture has `prose: null` and `components: []` with stack and folders; no edges → `no_edges`; no manifest → `no_manifest`.
    - AC-12, AC-13 — a stored envelope with `index_files: 4200`, `source_files: 12450`, `coverage_partial: true` → the same numbers in `meta`. `coverage_partial` is computed as true for `bounded: 7450` and for `softBudgetReached: true`, false for neither (D-23).
    - AC-74 — stored `revision: "abc"` and current index sha `"def"` → `meta.outdated: true`; equal → `false`.
    - AC-84 — `meta.provider`, `model` and `cost_usd` come from the envelope, and `cost_usd: null` is preserved.
    - AC-69 — `meta.trimmed` mirrors the envelope.
    - AC-86 — `keyMissing: true` on a cloned, ranked repo → `blockers: ['no_api_key']`, `can_generate: false`. On an uncloned repo → `blockers: ['not_cloned', 'no_api_key']`, in that order (D-41). Key present → no `no_api_key`.
    - D-45 — a valid stored tour on a repo whose clone is now `null` → `status: 'generated'`, the stored sections, `blockers` containing `not_cloned`, `can_generate: false`. The same with a now-`degraded` index → `generated` plus `index_not_ready`.
27. **server-unit** · `server/test/onboarding-service.test.ts` (new) · the service with `MockGitClient`, a stub `IndexFacade`, a recording `MockLLMProvider` and a stub `featureModel`. `db` uses a stub `OnboardingRepository` or an injected fake (`vi.mock` of the repository module is acceptable in a unit test).
    - **`jobs` dep:** a small `JobQueue` stub. `register(kind, handler)` stores the handler; `enqueue(ws, kind, payload)` runs it and returns `{ id, done }`, where `done` is the handler's promise. A test that wants the generation held open uses an LLM promise held open, not a deferred `enqueue`.
    - Add one case for D-3: when the LLM rejects, the stored handler's promise **resolves** (never rejects), so a JobRunner retry could never re-call the model, and exactly one `completeStructured` call is recorded.
    - AC-21 — one `startGeneration` + `await done` → the LLM's `calls` holds **exactly one** `completeStructured` entry, with `maxRetries: 0` (D-50: no assertion on prompt content here).
    - AC-83 — that call has `maxTokens: 10000`.
    - AC-22 — the `featureModel` stub returns `{ provider: 'anthropic', model: 'm-x' }` → the `anthropic` provider is resolved and the call uses `model: 'm-x'`.
    - AC-25, INV-16 — `getTour` on a repo with a stored tour, and on one without → the LLM's `calls` stays empty, the `llm` dep is never invoked, and nothing is stored.
    - AC-86 — `hasLlmKey` stub → `false`: `getTour` returns `api_key: { provider, model, missing: true }` and a `no_api_key` blocker, still with 0 `completeStructured` calls and 0 `llm()` calls. `true` → `missing: false`.
    - AC-24 — after a successful generation the stored envelope carries `revision` = the index sha and the five sections. A second successful generation replaces it.
    - AC-28 — a second `startGeneration` while the first is pending (an LLM promise held open) rejects with status 409 and message "A tour is already being generated". After `done`, a new start is accepted.
    - AC-28, INV-17 (race) — `featureModel` stub delayed by a pending promise; call `const a = svc.startGeneration(ws, r); const b = svc.startGeneration(ws, r);` with **no** `await` between them → exactly one resolves and the other rejects 409. After everything settles, exactly one `completeStructured` call was made.
    - AC-28 (lock release) — a first call that fails a pre-check (e.g. `tour_not_cloned`) leaves no lock: a second call after fixing the stub is accepted.
    - AC-29 — `startGeneration` resolves before the LLM answers, and the store is written after the LLM resolves without any further call.
    - AC-70 — `llm` rejects with `ConfigError` → `startGeneration` rejects 422 `tour_no_api_key` "No API key for openrouter". No `completeStructured` call. `getTour().generation.failure.code === 'no_api_key'`.
    - AC-71 — an LLM that never resolves, with `generationTimeoutMs: 50` → after `done`, nothing is stored and `failure.code === 'timeout'`. A provider error → `provider_error`, nothing stored.
    - AC-72 — an LLM fixture that fails the schema → `failure.code === 'invalid_output'`, `failure.message === 'the model returned invalid output'`, exactly one call, nothing stored.
    - AC-73 — with a stored tour, a failing regeneration leaves the stored envelope byte-equal. `getTour` returns `status: 'generated'` plus a `failure`.
    - AC-14, AC-15 — `startGeneration` on a repo without a clone → 422 `tour_not_cloned`; on a degraded index → 422 `tour_index_not_ready`. No LLM call.
    - AC-16 — a `partial` + ranked index → accepted.
    - AC-23 — two generations over the same facts with **different** LLM fixtures → equal reading-path order, critical-path files, command texts and candidate ids.
    - AC-60 — the recorded user message contains `<untrusted source=` blocks holding the README text, the PR title and the TODO text. The system message contains the `SECURITY:` paragraph.
    - AC-64 — with `.env.example` = `SECRET_KEY=hunter2` and a `.env` file in the tree: `readFileAt` (spy) is never called with `.env`, and `hunter2` appears neither in the recorded messages nor in the stored envelope; `SECRET_KEY` does.
    - AC-68 — the set of paths passed to `readFileAt` (spy) is a subset of {root and ≤ 4 sub `package.json`, the README, the env-example, the top-30 paths}. Lockfiles and compose files are never read. A tree entry under a dir named `..x;y` or `a b` is never read.
    - AC-44 (behavioural) — with every `GitClient` method wrapped in a spy, a full `getTour` + generation calls only `listFilesAt`, `readFileAt` and `currentHead`. `clone`, `sync`, `fetchPullHead`, `diff`, `blame` and `log` are never called. A manifest script `"dev": "rm -rf /"` yields only the command `pnpm run dev`: the script body never appears.
    - AC-44, AC-65 (guard) — reading every file under `server/src/modules/onboarding/` as text: no `child_process`, `node:fs`, `execa`, `simple-git`, `spawn(` or `exec(` (AC-44, INV-7). `getTour`/`startGeneration` with a repo that `repos.getById` does not return for that workspace → `NotFoundError` (AC-65).
28. **server-integration** · `server/test/repo-intel-onboarding-reads.it.test.ts` (new), plus two cases appended to `server/test/repo-intel-facade-degraded.test.ts` · real Postgres. Rows are inserted directly into `file_rank`, `file_edges`, `file_facts` and `repo_index_state` (a test may write index tables, INV-2 binds `src/` only)
    - AC-46, AC-23 — three files with equal `rank` → `getTopFilesByRank` and `getIndexedFiles` return them in path order, and repeated calls return the same order.
    - AC-47 — `test/a.ts`, `migrations/0001.ts`, `fixtures/x.ts`, `src/a.test.ts`, `src/b.d.ts` and `vitest.config.ts`, all top-ranked, are never returned by `getTopFilesByRank`. `src/core.ts` is.
    - AC-36 — `getIndexedFiles` reports `importers` = distinct importers (two edges from one file count once), and `percentile` as stored.
    - AC-35, AC-23 — `getCriticalPaths` with tied adjacency picks the path-ascending target, the same on every call.
    - AC-20 — `getEndpoints` returns every `(file, endpoint)` from `file_facts`, ordered.
    - AC-13 — `getIndexState().coverage` reflects `stats.totalCandidates`/`bounded`/`softBudgetReached`.
    - AC-87 — on a real temp-dir git repo used as the clone (the indexer walks the filesystem, so `MockGitClient` alone is not enough; `diffNameOnly`/`currentHead` can come from the real repo or from `MockGitClient` with `head`/`diffNameOnly` options matching the edits):
      1. full index with 5 source files;
      2. incremental refresh after **adding** 2 files and editing 1;
      3. incremental refresh after **removing** 1 file and editing another.
      After each pass: `getIndexedFiles().length` equals the source files present on disk (5, 7, 6), `repo_index_state.files_indexed` equals the walked files that parsed (no drift from re-parsed files; `files_indexed + files_skipped ≤ totalCandidates`, F-54), and `coverage.totalSourceFiles` equals the walk's count.
      A fourth refresh with an unchanged sha keeps all three numbers.
      Use `ContainerOverrides.depgraph` with a stub if building edges is slow.
    - The two new methods return `[]` with `repoIntelEnabled: false` (append to `repo-intel-facade-degraded.test.ts`).
    - Run it with `--no-file-parallelism` and report the passed/skipped counts.
29. **server-integration** · `server/test/onboarding.it.test.ts` (new) · real Postgres, the built app (which wires the real `container.jobs`, so no `JobQueue` stub is needed here), `MockGitClient({ files })` and recording `MockLLMProvider`s through `ContainerOverrides.llm`, with index rows inserted directly
    - AC-19, AC-65 — `GET /repos/<foreign or unknown id>/tour` → 404, and so does `POST …/generate`.
    - AC-25 — `GET` with and without a stored tour → the LLM mock records 0 calls.
    - AC-26 — a cloned + indexed repo, nothing stored → `status: 'ready'`, deterministic sections, 0 LLM calls.
    - AC-27, AC-24, AC-12, AC-84 — `POST …/generate` → 202 `{ running: true }`. Poll `GET` until `generation.running === false` → `status: 'generated'`; the `onboarding` row exists with `json.revision` = the index sha; `meta.index_files` = the number of `file_rank` rows; `meta.provider/model/cost_usd` match the mock (cost 0.001).
    - AC-22 — a feature model for `onboarding` set to `anthropic` / `claude-x` through the settings API → the `anthropic` mock receives the call with `model: 'claude-x'`.
    - AC-28 — with an LLM mock whose promise is held open, a second `POST` → 409 with message "A tour is already being generated", and `GET` shows `generation.running: true`.
    - AC-28 (concurrent) — two `POST …/generate` fired with `Promise.all` (`app.inject` twice, not awaited in between) → one 202 and one 409, and the LLM mock records exactly one call.
    - AC-86 — no `llm` override and no `OPENROUTER_API_KEY` in the test secrets → `GET` (before any POST) returns `api_key.missing: true`, `blockers` containing `no_api_key` and `can_generate: false`, with 0 LLM calls. With the key set through the settings API → `missing: false`. On a `clone_path NULL` repo without a key → `blockers: ['not_cloned', 'no_api_key']`.
    - AC-87 — after the AC-87 refresh sequence of step 28 on this app's repo, a generation stores `meta.index_files` and `meta.source_files` equal to the walk's numbers.
    - AC-29 — `POST`, then **no** client waiting: poll `GET` later → the stored tour is present (the generation finished on its own).
    - AC-71 — a mock that rejects → `generation.failure.code = 'provider_error'` and no `onboarding` row.
    - AC-73 — with a stored row, a failing regeneration → the row is unchanged and `GET` = `generated` + `failure`.
    - AC-70 — no `llm` override and no `OPENROUTER_API_KEY` in the test secrets → `POST` → 422 `tour_no_api_key`, and `GET` shows `failure.code = 'no_api_key'`.
    - AC-74, INV-16 — after a generation, update `repo_index_state.last_indexed_sha` → `GET` returns `meta.outdated: true`, and no generation starts by itself (0 new LLM calls, `generation.running: false`).
    - AC-58 — a repo with `clone_path NULL` and two open PRs plus one merged PR → `status: 'not_cloned'`, and first tasks are the two `open-pr` tasks in update order.
    - AC-14, AC-15 — `POST` on that repo → 422 `tour_not_cloned`. On a cloned repo with `repo_index_state.status = 'degraded'` → 422 `tour_index_not_ready`.
    - AC-20, AC-52 — after a generation, the recorded user message contains the stack, folders, a route from `file_facts`, the scripts, the reading paths, the critical-path files and the candidate ids (`todo:…`, `missing-tests:…`, `open-pr:…`).
    - Run it with `--no-file-parallelism` and report the passed/skipped counts.
30. **client** · colocated `*.test.tsx` under `src/app/repos/[repoId]/tour/_components/` · RTL + `fireEvent`, with `fetch` mocked through `api`. Providers carry the `onboarding`, `context` and `common` namespaces (`client/INSIGHTS.md:139-153`). Two passes (D-47): **30a** = `TourView`, `TourHeader`, `OnThisPage`/`TourSection`, `CopyControl`; **30b** = `ArchitectureSection`/`ArchitectureDiagram`, `FileRow`, the three section tests, `FirstTasksSection`.
    - **30a** `TourView.test.tsx`:
      - AC-06 — the breadcrumb `acme/payments-api` › "Onboarding Tour", and the heading "Onboarding for payments-api", with `payments-api` in its own element;
      - AC-07 — the five headings in order, for a `generated`, a `ready`, a `not_cloned` and an `index_not_ready` payload;
      - AC-17 — skeleton placeholders while loading;
      - AC-18 — a 500 → the error state with the reason and "Retry", and a click refetches;
      - AC-19 — a 404, or an id missing from the repos list → the "repository not found" screen;
      - AC-25, AC-26 — a `ready` payload shows "Generate tour", and the only network calls are `GET`s;
      - AC-71 — `status: 'ready'` + `failure.provider_error` → "Generation failed — …";
      - AC-70 — `failure.no_api_key` → "No API key for openrouter" and a link to `/settings/api-keys`, shown once even when the `no_api_key` blocker is also present;
      - AC-86 — on page open (no click), a payload with `api_key.missing: true` and `blockers: ['no_api_key']` → "No API key for openrouter", a link to `/settings/api-keys`, and "Generate tour" disabled. For `generated` + `no_api_key`, "Regenerate" is disabled. For `blockers: ['not_cloned','no_api_key']` → both lines, the not-cloned one first;
      - AC-72 — `failure.code: 'invalid_output'` → "Generation failed — the model returned invalid output";
      - AC-73 — `generated` + `failure` → the stored sections still render, plus a dismissible "Regeneration failed — …" notice that a click removes.
    - `TourHeader.test.tsx`:
      - AC-12 — "Generated from index of 4,200 files · last refreshed …";
      - AC-13 — with `coverage_partial` → "4,200 of 12,450 source files indexed";
      - AC-84 — the line's `title` contains provider, model and the cost, and "cost unknown" for `null`;
      - AC-16 — "partial index"; AC-69 — "built from a trimmed fact set"; AC-74 — the "Outdated — …" text next to Regenerate, and no POST on render;
      - AC-27 — clicking "Regenerate" sends one `POST …/tour/generate`;
      - AC-28 — `generation.running` → the button reads "Generating…" and is disabled;
      - AC-14 — `not_cloned` → "Not cloned — clone to generate", "Generate tour" disabled, and a `title` "A clone and an index are required";
      - AC-15 — `index_not_ready` + `no_files` → "Index not ready — …", disabled;
      - AC-75 — "Share link" with `navigator.clipboard.writeText` mocked → called with `<origin>/repos/<id>/tour`.
    - `OnThisPage.test.tsx` + `TourSection.test.tsx`:
      - AC-08 — five entries in section order;
      - AC-09 — activating an entry calls `scrollIntoView` (stubbed) on that section, and focus moves to its heading;
      - AC-10 — every section starts expanded, and its toggle collapses and re-expands it;
      - AC-11 — the toggle's name contains the title, and `aria-expanded` flips;
      - AC-81 — `activeSection` (helper) picks the heading closest to the top, and a `scroll` event moves `aria-current`;
      - AC-80 — the aside carries the `lg`-only visibility classes (`hidden`, `lg:block`). jsdom cannot evaluate media queries, so the test pins the classes.
    - `CopyControl.test.tsx`:
      - AC-42 — a click copies the given text;
      - AC-76 — "Copied" appears and disappears after 2,000 ms (fake timers);
      - AC-77 — `writeText` rejecting, or `navigator.clipboard` undefined → a read-only field with the text and "Copy it manually".
    - **30b** `ArchitectureSection.test.tsx` + `ArchitectureDiagram.test.tsx`:
      - AC-30 — the prose renders;
      - AC-31 — `` `src/my_file.ts` `` renders as `<code>` with the underscores intact;
      - AC-62 — prose with `<script>`, `<img src=x onerror=…>`, `![a](http://x/y.png)` and `[r](./rel.md)` → no `script`/`img` element, and the relative link is not an `<a href>`;
      - AC-32 — 3 components + 2 connections → an `svg[role=img]` with 3 labels and 2 lines, and box fill differs per kind;
      - AC-63 — a label `<b onclick=x>hi</b>` renders as literal text with no element or handler;
      - AC-85 — `components: []` → no `svg` and no error text;
      - AC-34 — a skeleton payload → stack and folder lists with counts, and no prose;
      - `layoutDiagram` is deterministic and gives no overlapping boxes for a 5-node chain.
    - `CriticalPathsSection.test.tsx`, `ReadingPathSection.test.tsx`, `FileRow.test.tsx`:
      - AC-35 — rows "path — reason";
      - AC-36, AC-49 — `reason: null` → "imported by 3 files · top 5% by rank";
      - AC-37 — "Open" has `href` = `https://github.com/acme/payments-api/blob/<revision>/<path>` and `target="_blank"`;
      - AC-79 — its name contains the path (`getAllByRole('link', { name: /Open src\/a\.ts/ })`);
      - AC-78 — a 120-char path shows `…` and its full path in `title`;
      - AC-38 — `no_edges` → "No critical paths — the import graph is empty";
      - AC-48 — a numbered list of ≤ 8;
      - AC-51 — `not_ranked` + reason → "No reading path — the repository has not been ranked yet" with the reason.
    - `RunLocallySection.test.tsx`:
      - AC-39 — a numbered list with commands in monospace;
      - AC-42 — copying row 2 writes its command text without "2";
      - AC-43 — the buttons are named "Copy command 1" … "Copy command N";
      - AC-45 — `no_manifest` → the message.
    - `FirstTasksSection.test.tsx`:
      - AC-54 — model tasks show their titles;
      - AC-56 — fallback tasks show "Resolve the TODO in src/a.ts:12", "Add tests for src/b.ts", "Review PR #7: Fix login";
      - AC-57 — each task has a kind tag, a reason and a link (`#L12` for a TODO, `/pull/7` for a PR);
      - AC-58 — the no-clone payload: open-PR tasks plus "Needs a clone and an index" in the other four sections;
      - AC-59 — `no_candidates` → the message.
31. **client** · `src/components/app-shell/helpers.test.ts` (new), `src/lib/hooks/onboarding.test.tsx` (new)
    - AC-01 — `NAV[0].items.map(i => i.key)` from `@devdigest/ui` equals `["pulls", "onboarding-tour", "context"]`. The tour item's `href` resolves to `/repos/<id>/tour` through `resolveHref`.
    - AC-02, AC-04 — `activeKeyFor("/repos/r1/tour") === "onboarding-tour"`.
    - AC-05 — `activeKeyFor("/onboarding") !== "onboarding-tour"`, and `/repos/r1/context` stays `context`.
    - AC-27, AC-28, AC-29 — the hook: after `useGenerateTour().mutate()` the tour query is invalidated. While `generation.running` it refetches on the 2,000 ms interval (fake timers), and it stops once `running` is false.
    - Run client verify. Read the stderr of `pnpm test` for `MISSING_MESSAGE` (`client/INSIGHTS.md:139-153`).

### e2e (`implementer`, phase 5 — `test-writer` may not write `e2e/`)

32. **e2e** · `e2e/specs/09-onboarding-tour.flow.json` (new) · covers AC-01, AC-02, AC-03, AC-07, AC-82
    - Follow `e2e/AGENTS.md`: deterministic locators only, labelled steps, and no step that starts a model call.
    - Steps:
      1. `set viewport 1280 2000`;
      2. `open {BASE}/`, then `wait --url /pulls`;
      3. `find role link click --name "Onboarding Tour"` (AC-01), then `wait --url /tour` (AC-02);
      4. `wait --text "Onboarding for payments-api"`;
      5. `wait --text` each of "Architecture overview", "Critical paths", "How to run locally", "Guided reading path", "First tasks" (AC-07, AC-82);
      6. `wait --text "Not cloned — clone to generate"`, which proves the skeleton path was taken and no generation was possible (D-34). By D-41 this line shows whether or not the CI secrets hold a key: the "No API key …" line (AC-86) may appear **below** it. The flow does not assert on the key line, because it depends on the environment.
    - The step never presses "Generate tour".
    - Then run the **whole** suite, so `06-onboarding` passes unchanged (AC-03). It needs the stack up and `agent-browser` on `PATH`, installed by the user (`INSIGHTS.md:42-46`). If either is missing, report the flow as written but not run, under `## Deviations`.

---

## AC coverage matrix

`plan-verifier` walks this table: AC → implementation step → test step → commit. Commit (2) = the implementation (steps 1–22), commit (3) = the tests (steps 23–32), per D-37. Every AC has at least one implementation step and at least one test step.

| AC | Impl step(s) | Test step(s) — file | Commit |
|---|---|---|---|
| AC-01 | 12 | 31 `app-shell/helpers.test.ts`; 32 flow 09 | 2 / 3 |
| AC-02 | 14 | 31; 32 | 2 / 3 |
| AC-03 | — (untouched; 12 removes the `/onboarding` key rule only) | 32 (suite incl. flow 06) | — / 3 |
| AC-04 | 12 | 31 | 2 / 3 |
| AC-05 | 12 | 31 | 2 / 3 |
| AC-06 | 14, 15 | 30 `TourView.test.tsx` | 2 / 3 |
| AC-07 | 1, 7, 14 | 26; 30 `TourView`; 32 | 2 / 3 |
| AC-08 | 16 | 30 `OnThisPage` | 2 / 3 |
| AC-09 | 16 | 30 `OnThisPage` | 2 / 3 |
| AC-10 | 16 | 30 `TourSection` | 2 / 3 |
| AC-11 | 16 | 30 `TourSection` | 2 / 3 |
| AC-12 | 1, 7, 10, 15 | 26; 29; 30 `TourHeader` | 2 / 3 |
| AC-13 | 1, 2, 7, 15 | 26; 28; 30 `TourHeader` | 2 / 3 |
| AC-14 | 7, 10, 15 | 26; 27; 29; 30 `TourHeader` | 2 / 3 |
| AC-15 | 2, 7, 10, 15 | 26; 27; 29; 30 `TourHeader` | 2 / 3 |
| AC-16 | 7, 10, 15 | 26; 27; 30 `TourHeader` | 2 / 3 |
| AC-17 | 13, 14 | 30 `TourView` | 2 / 3 |
| AC-18 | 13, 14 | 30 `TourView` | 2 / 3 |
| AC-19 | 11, 14 | 29; 30 `TourView` | 2 / 3 |
| AC-20 | 2, 4, 10 | 23; 28; 29 | 2 / 3 |
| AC-21 | 3, 10c | 27 | 2 / 3 |
| AC-22 | 10, 11 | 27; 29 | 2 / 3 |
| AC-23 | 2, 4 | 23; 27; 28 | 2 / 3 |
| AC-24 | 8, 10 | 27; 29 | 2 / 3 |
| AC-25 | 10, 13 | 27; 29; 30 `TourView` | 2 / 3 |
| AC-26 | 7, 10, 14, 15 | 26; 29; 30 `TourView` | 2 / 3 |
| AC-27 | 10, 11, 13, 15 | 29; 30 `TourHeader`; 31 hook | 2 / 3 |
| AC-28 | 10c (race-free lock, D-43), 11, 13, 15 | 27 (incl. the un-awaited race); 29 (incl. concurrent POST); 30 `TourHeader`; 31 | 2 / 3 |
| AC-29 | 10, 13 | 27; 29; 31 | 2 / 3 |
| AC-30 | 9, 18 | 30 `ArchitectureSection` | 2 / 3 |
| AC-31 | 6, 9, 18 | 25; 30 `ArchitectureSection` | 2 / 3 |
| AC-32 | 1, 18 | 30 `ArchitectureDiagram` | 2 / 3 |
| AC-33 | 6, 9 (refs: indexed path, folder, dependency only) | 25 | 2 / 3 |
| AC-34 | 4, 7, 18 | 23; 26; 30 `ArchitectureSection` | 2 / 3 |
| AC-35 | 2, 4, 19 | 23; 28; 30 `CriticalPathsSection` | 2 / 3 |
| AC-36 | 4, 6, 19 | 23; 25; 28; 30 `FileRow` | 2 / 3 |
| AC-37 | 19 | 30 `FileRow` | 2 / 3 |
| AC-38 | 4, 7, 19 | 23; 26; 30 `CriticalPathsSection` | 2 / 3 |
| AC-39 | 1, 20 | 30 `RunLocallySection` | 2 / 3 |
| AC-40 | 3, 4 | 23 (allow-list, lockfile-only install, shell-safe dirs) | 2 / 3 |
| AC-41 | 6, 9 | 25 | 2 / 3 |
| AC-42 | 17, 20 | 30 `CopyControl`, `RunLocallySection` | 2 / 3 |
| AC-43 | 20 | 30 `RunLocallySection` | 2 / 3 |
| AC-44 | 10 (structural: no exec capability, INV-7, INV-15) | 27 (behavioural `GitClient` spy + source guard) | 2 / 3 |
| AC-45 | 4, 7, 20 | 23; 26; 30 `RunLocallySection` | 2 / 3 |
| AC-46 | 2, 4 | 28 | 2 / 3 |
| AC-47 | 2 | 28; 23 (`EXCLUDED_DIRS` parity, F-02) | 2 / 3 |
| AC-48 | 1, 4, 19 | 23; 30 `ReadingPathSection` | 2 / 3 |
| AC-49 | 4, 6, 19 | 23; 25; 30 `FileRow` | 2 / 3 |
| AC-50 | 6, 9 | 25 | 2 / 3 |
| AC-51 | 7, 19 | 26; 30 `ReadingPathSection` | 2 / 3 |
| AC-52 | 4, 8, 10 | 23; 29 | 2 / 3 |
| AC-53 | 3, 4 | 23 | 2 / 3 |
| AC-54 | 6, 9, 21 | 25; 30 `FirstTasksSection` | 2 / 3 |
| AC-55 | 6 | 25 | 2 / 3 |
| AC-56 | 6, 7, 21 | 25; 30 `FirstTasksSection` | 2 / 3 |
| AC-57 | 1, 21 | 30 `FirstTasksSection` | 2 / 3 |
| AC-58 | 7, 8, 10, 21 | 26; 29; 30 `FirstTasksSection` | 2 / 3 |
| AC-59 | 7, 21 | 26; 30 `FirstTasksSection` | 2 / 3 |
| AC-60 | 5, 9, 10 | 24; 27 | 2 / 3 |
| AC-61 | 4, 6, 7 (prose scrub; rows and tasks hold fact paths only) | 25 | 2 / 3 |
| AC-62 | 18 (reuses `UntrustedMarkdown`) | 30 `ArchitectureSection` | 2 / 3 |
| AC-63 | 18 | 30 `ArchitectureDiagram` | 2 / 3 |
| AC-64 | 4, 10 | 23; 27 | 2 / 3 |
| AC-65 | 8, 10, 11 | 27; 29 | 2 / 3 |
| AC-66 | 3, 5 | 24 | 2 / 3 |
| AC-67 | 5 | 24 | 2 / 3 |
| AC-68 | 4, 10 | 23; 27 | 2 / 3 |
| AC-69 | 5, 7, 15 | 24; 26; 30 `TourHeader` | 2 / 3 |
| AC-70 | 10, 11, 15 | 27; 29; 30 `TourView` | 2 / 3 |
| AC-71 | 10, 14, 15 | 27; 29; 30 `TourView` | 2 / 3 |
| AC-72 | 6, 10c | 25; 27; 30 `TourView` | 2 / 3 |
| AC-73 | 10, 15 | 27; 29; 30 `TourView` | 2 / 3 |
| AC-74 | 7, 15 | 26; 29; 30 `TourHeader` | 2 / 3 |
| AC-75 | 15, 17 | 30 `TourHeader` | 2 / 3 |
| AC-76 | 17 | 30 `CopyControl` | 2 / 3 |
| AC-77 | 17 | 30 `CopyControl` | 2 / 3 |
| AC-78 | 19 | 30 `FileRow` | 2 / 3 |
| AC-79 | 19 | 30 `FileRow` | 2 / 3 |
| AC-80 | 16 | 30 `OnThisPage` | 2 / 3 |
| AC-81 | 16 | 30 `OnThisPage` | 2 / 3 |
| AC-82 | 12, 14 (+ D-34: no data) | 32 | 2 / 3 |
| AC-83 | 3, 10 | 27 | 2 / 3 |
| AC-84 | 1, 10, 15 | 26; 29; 30 `TourHeader` | 2 / 3 |
| AC-85 | 6, 18 | 25; 30 `ArchitectureDiagram` | 2 / 3 |
| AC-86 | 1, 7, 10b, 10c (`hasLlmKey`), 11, 14, 15, 22 | 26; 27; 29; 30 `TourView` (32 stays green by D-41) | 2 / 3 |
| AC-87 | 2 (`incremental.ts` walk stats + `files_indexed`), 7, 10c | 28 (full + 2 incremental + unchanged-sha sequence); 29 | 2 / 3 |
| AC-88 | 4 (derivation order), 6 (`orderCommands`) | 23 (order); 25 (explicit: subset, `[]`, repeated id) | 2 / 3 |

88 rows; every AC appears once. The amended AC-21, AC-33, AC-40 and AC-72 rows reflect their new text.

---

## Execution

**Multi-agent** (D-36). It pays for itself here: three packages plus e2e, a vendored contract change, a facade change inside another module, 22 code steps and 10 test steps.

The main session does the sequencing, the spawning and the commits. `/run-plan specs/L05-onboarding-generator.md --test-writer --docs` runs phases 1–7. Without `--test-writer`, `implementer` would also take steps 23–31, which goes against the user's rule that tests come from the spec and not from the code.

| Phase | Agent | Steps | Reads | Produces | Parallel with |
|---|---|---|---|---|---|
| 0 | cross-model reviewer (Sonnet) | — | this file + the requirements file | done: `plan-review.md`, addressed in revision 2 | — |
| — | main session | commit (1): this plan | | `docs(specs): L05 Onboarding Generator plan` | — |
| 1 | `implementer` | baseline, then 1–22, in order (10 as 10a → 10b → 10c), with the step checkpoints | this file | baselines for `server` and `client` + working tree + `verify.mjs` output per package | — |
| 2 | `plan-verifier`, **gap** pass | 1–22 (23–32 left for phase 6) | this file | a verdict per item | `architecture-reviewer` |
| 2 | `architecture-reviewer` | — | the open change + `## Architectural invariants` INV-1…INV-17 | `pnpm arch` result + findings per INV | `plan-verifier` |
| 3 | `implementer`, **fix round(s)**, resumed via `SendMessage` until no CRITICAL/WARNING/gap is open (max 3, then the user decides) | the findings | `.devdigest/cache/sdd/L05-onboarding-generator/findings.md` | fixes + `verify.mjs` output | — |
| — | main session | commit (2): steps 1–22 | | `feat(onboarding): L05 onboarding tour generator` | — |
| 4 | `test-writer` | 23–31 (30 as 30a then 30b) | this file (`## Steps` 23–31, `## Done when`, the requirements file) — **not** the implementation as a source of expected values | test files + `verify.mjs` output vs baseline. A test that fails on a product bug is reported, not "fixed" by adjusting the test | — |
| 5 | `implementer`, resumed via `SendMessage` | 32 (e2e), plus fixes for product bugs `test-writer` reported | this file + the test-writer report | the flow file + e2e run output; fixes + `verify.mjs` output | — |
| — | main session | commit (3): steps 23–32 (+ a separate `fix(onboarding): …` commit for phase-5 product fixes, D-37) | | `test(onboarding): L05 tour tests and e2e flow` | — |
| 6 | `plan-verifier`, **final** pass | what phase 2 did not mark `done`, plus 23–32 and the `## AC coverage matrix` | this file + the phase-2 report | a verdict per item and per AC row | — |
| 7 | `doc-writer` | — | the shipped code | one page, `docs/onboarding-tour.md` (root `docs/`, since it spans packages) | — |

Writers run one at a time (`INSIGHTS.md:60-74`). Only phase 2's two read-only agents run in parallel. `implementer` writes **no** test file in phase 1. Steps 23–31 belong to `test-writer`, so no test is written twice. Phase 3 is skipped when phase 2 returned no gap and no CRITICAL/WARNING. Between phases 2 and 3, the main session writes both reports into the findings file, so the hand-off is a file, never a retelling.

Package order inside phase 1:
1. contracts: step 1, then `pnpm typecheck` in `server/` and `client/`.
2. server: steps 2–11. Server verify `--it` must show no `new` failure before the client starts.
3. client: steps 12–22, then client verify plus `pnpm build`.

Then the main session runs `/pr-self-review`.

## Verification

Run from inside each package directory.

| Package | Baseline (phase 1, before the first edit) | After each step | Final |
|---|---|---|---|
| server | `node ../scripts/verify.mjs --save-baseline L05-onboarding-generator --it` | `node ../scripts/verify.mjs --baseline L05-onboarding-generator --related <files>` | `node ../scripts/verify.mjs --baseline L05-onboarding-generator --it` |
| client | `node ../scripts/verify.mjs --save-baseline L05-onboarding-generator` | `node ../scripts/verify.mjs --baseline L05-onboarding-generator --related <files>` | `node ../scripts/verify.mjs --baseline L05-onboarding-generator`, then `pnpm build` with `pnpm dev` stopped |
| e2e | — | — | stack up and freshly seeded (`pnpm db:migrate` + `pnpm db:seed` in `server/`, then check the row counts, because on Windows both can exit 0 and do nothing), then `npm test` in `e2e/` (or `pnpm e2e:hermetic`) |

`--it` is used in `server` because steps 2, 8 and 10 touch queries and steps 28–29 are integration tests. There is **no** migration in this plan, so `db:migrate` is needed only for the e2e stack. Pre-existing failures (6 tests in `server/test/indexer-pipeline.test.ts` on Windows) land in the baseline and are labelled `baseline`: they are not regressions and are not to be fixed here. Integration runs use `--no-file-parallelism`, and each report gives the passed/skipped counts.

Static checks for `architecture-reviewer` and `plan-verifier` (read-only):
- `pnpm arch` in `server/` → no new violation (INV-1, 8, 9, 10, 14);
- `grep -rn "completeStructured(" server/src/modules/onboarding` → exactly 1 call site; review any other hit, which may only be a comment (INV-4);
- `git diff --stat -- reviewer-core server/src/adapters server/src/platform/resilience.ts '*/vendor/shared/adapters.ts'` → empty (INV-13);
- `grep -rn "fileRank\|fileEdges\|fileFacts\|repoIndexState\|repoMapCache" server/src --include=*.ts` → only under `modules/repo-intel/` and `db/` (INV-2);
- `diff -r server/src/vendor/shared client/src/vendor/shared` → nothing (INV-6);
- `git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty (INV-5, INV-11).

## Done when

Every line traces to AC IDs. `plan-verifier` checks these together with `## AC coverage matrix`.

- [ ] AC-01, AC-02, AC-04, AC-05: the sidebar WORKSPACE shows "Onboarding Tour" between Pull Requests and Project Context. It opens `/repos/<active>/tour` and is active there, and only there (not on `/onboarding`)
- [ ] AC-03, AC-82: the e2e suite passes, with flow 06 unchanged and the new flow 09 reaching the tour from the sidebar without a model call
- [ ] AC-06, AC-07, AC-08: breadcrumb, heading with the accent name, five sections in order with the exact titles in every state, and the "On this page" list
- [ ] AC-09, AC-10, AC-11, AC-80, AC-81: jump + focus, collapsible sections (open by default) with named toggles, the aside hidden below 1024 px, scroll highlight
- [ ] AC-12, AC-13, AC-16, AC-69, AC-84: the header line with N (or "N of M source files indexed"), the relative time, "partial index", "built from a trimmed fact set", and a tooltip with provider, model and cost (or "cost unknown")
- [ ] AC-14, AC-15, AC-58: not cloned → skeleton from the DB plus a disabled Generate with its tooltip. Index not ready → "Index not ready — <reason>", disabled
- [ ] AC-17, AC-18, AC-19: loading skeleton; error with reason and Retry; unknown or foreign repo → not-found screen and API 404
- [ ] AC-20, AC-23, AC-52, AC-53: facts and candidates are collected without a model call, and the deterministic parts are identical across runs and across different model answers (`onboarding-facts.test.ts`, `onboarding-service.test.ts`)
- [ ] AC-21, AC-72, AC-83: one `completeStructured` call per generation, `maxRetries: 0`, `maxTokens: 10000`, no schema re-ask or repair. The adapters' own 429/5xx transport retries are unchanged and allowed. Invalid output → failure "the model returned invalid output" with no second call
- [ ] AC-22: the "Onboarding Tour" feature model from Settings is the one called (`onboarding.it.test.ts`)
- [ ] AC-24, AC-25, AC-26, AC-27: a stored tour with its revision replaces the previous one. Page open never calls the model. A first visit shows the skeleton plus "Generate tour". Generate/Regenerate shows the new tour on completion
- [ ] AC-28, AC-29: "Generating…" and disabled while running, a second request → 409 "A tour is already being generated", **even when two requests arrive together** (one model call), and the generation completes and is shown after the user leaves and returns
- [ ] AC-30, AC-31, AC-32, AC-33, AC-34, AC-85: prose with inline-code paths (underscores intact); a box-and-arrow SVG coloured by kind from grounded components only; no diagram (and no error) when fewer than 2 components or no connection; skeleton shows stack and folders
- [ ] AC-35, AC-36, AC-37, AC-38: ≤ 6 critical-path rows in chain order with model or deterministic reasons, "Open" to GitHub at the tour revision in a new tab, and the empty-graph message
- [ ] AC-39 … AC-45, AC-88: numbered monospace commands derived only from files in the clone:
  - install from a lockfile only, an env copy, the compose command by file name, and scripts from the allow-list `dev, start, serve, build, test, migrate, db:migrate, seed, db:seed` only;
  - no command built from an unsafe directory name;
  - the model only ordering and commenting them, and omitted derived commands appended in derivation order without a comment;
  - "Copy command N" buttons copying the text without the number;
  - no execution;
  - the no-manifest message.
- [ ] AC-86: on page open, with no key for the feature's provider, "No API key for <provider>" with the Settings → API Keys link, and Generate/Regenerate disabled, with no model call. On an uncloned repo, both lines show, the not-cloned one first
- [ ] AC-87: after a full index and any number of incremental refreshes, N equals the files in the index and M the latest walk's source files (`repo-intel-onboarding-reads.it.test.ts`), and `files_indexed` no longer drifts
- [ ] AC-46 … AC-51: ≤ 8 reading-path files in rank order with a path tie-break, junk excluded (root-level `test/`, `migrations/`, `fixtures/` too), whys from the model only under D-13, deterministic fallback, and the not-ranked message
- [ ] AC-54 … AC-59: 3–5 model tasks each tied to one valid candidate, else up to 5 fallback tasks with fixed titles; kind tag, reason and link per task; open-PR tasks without a clone; the no-candidates message
- [ ] AC-60 … AC-65: all repo text in untrusted blocks with no keyword scanning, unknown paths removed, markdown without HTML or images and with inert relative links, plain-text diagram labels, env names only and no `.env` read, workspace-scoped get and generate
- [ ] AC-66, AC-67, AC-68: facts ≤ 40,000 chars with the fixed drop order, the caps, and only the allowed file reads
- [ ] AC-70, AC-71, AC-73: no key → "No API key for <provider>" with a link to Settings → API Keys and no call; failure or 120 s timeout → "Generation failed — <reason>" and nothing stored; a failed regeneration keeps the stored tour plus a dismissible notice
- [ ] AC-74: "Outdated — …" next to Regenerate when the index revision moved, and no automatic regeneration
- [ ] AC-75, AC-76, AC-77: Share link copies `<origin>/repos/<id>/tour`; "Copied" for 2 s; a fallback field with "Copy it manually"
- [ ] AC-78, AC-79: middle-truncated paths with a full-path tooltip; "Open" names contain the path
- [ ] INV-1 … INV-17 hold (`architecture-reviewer`). `pnpm arch`, `pnpm typecheck` and every suite show no `new` failure against the baseline in `server/` and `client/`, and `pnpm build` passes in `client/`

## Left to reviewers

- **architecture** (INV-1 … INV-17 are the checklist):
  - the two new facade reads, the `IndexState.coverage` projection, and the incremental walk-stats and `files_indexed` change inside repo-intel (AC-87);
  - `Container.hasLlmKey` sharing `KEY_FOR` with `buildLlm` (D-42);
  - onboarding's local structural `IndexFacade` instead of importing repo-intel types;
  - the service built in `routes.ts` with explicit deps (D-38) rather than a container getter;
  - the generation as a `JobRunner` job with a never-throwing handler, plus the in-process 409 lock (D-3, D-43);
  - the four `helpers.ts` subject folders (D-1);
  - D-25 changing the conventions sample through the shared junk filter and tie-break.
- **security**:
  - untrusted README, manifest, TODO, PR-title and route text in the prompt (D-27, no keyword scanning);
  - the prose scrub, including stripping every external link (D-26);
  - commands built only from validated tokens, with unsafe directory names skipped (D-44, INV-15);
  - the key-presence check reading `SecretsProvider` on every `GET` and never returning the value (D-42);
  - env-example names only (D-8, AC-64);
  - reads only through git objects at one sha, so no symlink follow (INV-7);
  - model text rendered by `UntrustedMarkdown`;
  - SVG labels as text;
  - GitHub links built from DB values with `rel="noopener noreferrer"`;
  - `POST /generate` cost exposure: one run per repo at a time, but no rate limit beyond the app-wide one.
- **performance** (rubric `docs/agent-prompts/performance-reviewer.md`):
  - `getIndexedFiles` must stay **one** grouped query over ≤ 5,000 rows;
  - fact collection costs one `ls-tree` plus ≤ 37 `git show` calls per revision, then is cached (D-33);
  - the `GET` path for a stored tour must not collect facts;
  - polling every 2 s only while running.

## Risks / open questions

| ID | Question / risk | Blocks which step | Needs |
|---|---|---|---|
| R-1 | **A timeout does not cancel the request.** `withTimeout` only stops waiting. The port has no `AbortSignal`, so the in-flight HTTP request continues, and the OpenRouter SDK may still retry after the 120 s wall: client timeout 90 s, `maxRetries: 2` (`openrouter.ts:54-55`). A "timed out" generation can still be billed for 1–3 background requests, or up to 4 via `withRetry` on OpenAI/Anthropic. The "one call" guarantee (AC-21) is about the module's calls, not about requests on the timeout path. Nothing is stored either way. Adding cancellation would change the port and reviewer-core, which is excluded by AC-21 as amended | 10c | — (accepted, documented) |
| R-2 | **Phishing link through prompt injection.** A README could instruct the model to emit a link. The server scrub (D-26) is best effort: the re-check found 9 of 13 bypass spellings still pass it (F-36). The **guarantee** is `UntrustedMarkdown inertLinks` at render (F-29), which leaves no clickable link in tour prose. A future renderer of `prose` that omits `inertLinks` would reopen the risk | 6, 18 | — (accepted, documented) |
| R-11 | **Diagnosing `invalid_output`.** Only the classified failure is logged (`TourLogger` → `app.log`, F-37). Raw output, zod issues and `finish_reason` need an adapter change, which is deferred to a separate PR (user decision, INV-13) | 10c | separate PR |
| R-3 | A `tsx watch` restart or an API restart mid-generation loses the in-flight generation and its failure state. Nothing is stored. Its `jobs` row may stay `queued` or `running`, because nothing re-runs or reaps tour jobs. The client stops polling once `running` reads false, and the button is enabled again (D-48) | 10 | — (documented, `server/INSIGHTS.md:14-31`) |
| R-10 | JobRunner's 120 s wall (`jobs.ts:41,67`) wraps the **whole** handler: fact collection plus the model call. A generation that finishes late can still store its tour (the handler keeps running after the wall) while its `jobs` row reads `failed` with a timeout error. The tour shown is correct; only the `jobs` row is misleading | 10c | — (accepted, documented, F-05) |
| R-4 | Incremental `files_indexed` now uses the full pass's terms (parsed walked files, `refreshCounts`, F-54), so the Indexed badge agrees between a full index and a refresh. It can differ from the tour's N, which is the `file_rank` count and includes files that failed to parse | 2 | — (left to reviewers) |
| R-5 | `readFileAt` at `lastIndexedSha` can fail if that commit was dropped by a later `sync()` on a shallow clone. D-5 falls back to `currentHead()`, so the facts may then be one revision ahead of the index | 10 | — |
| R-6 | If the never-dropped blocks alone exceed 40,000 chars (e.g. 15 long TODO lines + 37 reasons), `fitBudget` returns over budget with `trimmed: true`. The per-item caps (200 chars) make this unlikely (~15k chars worst case) | 5 | — |
| R-7 | Strict json_schema providers may reject `z.enum` or nested arrays. The conventions schema (`conventions/constants.ts:75-107`) already uses both against the same providers | 3 | implementer checks against MockLLM + one manual run if a key is available |
| R-8 | `navigator.clipboard` is undefined outside a secure context (http://127.0.0.1 is secure, a LAN IP is not). AC-77's fallback covers it | 17 | — |
| R-9 | The e2e run needs `agent-browser` installed globally by the user and the full stack up | 32 | user runs `npm i -g agent-browser && agent-browser install` |
