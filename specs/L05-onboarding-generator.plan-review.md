# Cross-model review of specs/L05-onboarding-generator.md

Reviewer: Sonnet. Requirements checked: 88 ACs, including the 2026-10-31 amendments (AC-21, AC-33, AC-40, AC-72 changed; AC-86, AC-87, AC-88 added).
Verdict: APPROVE WITH CHANGES. The plan is thorough and mostly accurate against the code. It is stale against the amended requirements, and has 2 real defects (409 race, shell-unsafe commands).

## 1. Traceability

- BLOCKER · header, Requirements check, matrix, Done when · The plan says "AC-01 ... AC-85" and "85 rows". AC-86, AC-87 and AC-88 are absent from every list: Requirements check, steps, AC matrix, Done when, tests. They have no implementation step and no test step.
- MAJOR · AC-86 (key missing on page open) · The plan keeps this as REC-3 "pending, not in the steps". It is now a requirement. It needs:
  - a contract field. `TourGeneration` or `OnboardingTour` needs e.g. `api_key: { provider, missing }`, or a `no_api_key` status. `can_generate` must become false.
  - `GET` to call `featureModel(ws)` plus a key check. `container.llm(id)` throws `ConfigError` when the key is absent (`server/src/platform/container.ts:208-238`) and caches the client. An injected override returns early, so tests with an override never see "missing".
  - step 10 and INV-3 text "getTour never calls deps.llm" to change. Test 27 (AC-25) asserts `calls` is empty. Say "no `completeStructured` call" and not "no `llm()` resolve".
  - steps 14/15/22 (status line + link `/settings/api-keys`; AddRepoView already links it), and tests 26/27/29/30.
  - a precedence rule. A not-cloned repo with no key: which status line shows? The seeded demo repo is not cloned (`seed.ts:200`) and may have no key in CI, so flow 09 step 6 ("Not cloned - clone to generate") could show the key message instead or as well. Define it, or assert both lines.
- MAJOR · AC-87 · Plan REC-4 and R-4 say "out of scope, separate change". The user accepted it as a requirement. D-23 (N = `file_rank` row count) covers N. M is wrong in step 2:
  - Step 2 carries the prior `totalCandidates`/`bounded` forward in `incremental.ts:245-255`. AC-87 asks for "the number of source files found by the latest walk".
  - The incremental path already runs `walkClone(repo.clonePath)` at `incremental.ts:222`. Take `walk.stats` (`totalCandidates`, `bounded`) from that call. Carrying forward goes stale as soon as a file is added.
  - Fix `filesIndexed` at the source too (`incremental.ts:260`), or state that the tour does not use it. Add a server-integration test: full index, then 2 incremental runs that add and remove files, then N and M equal the walk.
  - Step 28 only checks "keys still present". Add this test to it.
- MAJOR · AC-88 · D-10 already appends omitted commands, but no test asserts it by name. Test 25 AC-41 covers it only implicitly. Cite AC-88 in D-10, step 6, test 25 and the matrix, and add an explicit case: model returns `[]` gives all derived commands in derivation order with `comment: null`; model returns a subset.
- MAJOR · AC-21 (amended) · The plan treats REC-1 as pending, with step 11a conditional, a conditional INV-13, conditional Touches and conditional rows in Verification. The requirement now says 429/5xx transport retries are allowed and the review engine package is not changed. Actions:
  - Delete step 11a, the REC-1 row, the 11a rows in the Skill map, the reviewer-core row in Verification, and the REC-1 row in Risks.
  - Make INV-13 unconditional (`git diff --stat -- reviewer-core` is empty) and INV-6 `adapters.ts` unchanged.
  - Turn D-40 from an assumption into a decision.
  - Fix the inaccurate claim. OpenAI/Anthropic `withRetry` defaults to `retries ?? 3` (`server/src/platform/resilience.ts:60`), so up to 4 requests, not "2-3 retries". OpenRouter SDK `maxRetries: 2` (`reviewer-core/src/llm/openrouter.ts:55`) gives up to 3.
- MAJOR · AC-33 (amended) · REC-2 is decided: the compose file is not read. Remove REC-2 and make D-12 a decision. D-11 still lets `ref` match "a tree path". AC-33 now allows only an indexed path, a top-level folder, or a manifest dependency name. A tree path admits `Dockerfile` and `docker-compose.yml` as component refs. Drop "tree path" from D-11 and from test 25. The known set K (tree paths) stays valid for the AC-61 scrub only.
- MAJOR · AC-40 (amended) · See section 7. D-9 and test 23 contradict the allow-list (`typecheck`, `lint`, `setup`, `bootstrap` are extra; `serve` is missing). D-7 invents `npm install` with no lockfile.
- MINOR · AC-72 (amended text) · The requirement now cites AC-21 ("no schema re-ask or repair"). D-20 and test 27 are fine. Add an assertion that the reason text is "the model returned invalid output" (test 30 does it client-side only).
- MINOR · mis-maps:
  - AC-61 lists only step 6 and test 25. Its "removed together with its link" also applies to tasks and rows (they come from facts). Say so.
  - AC-44 has only a grep hygiene test. The AC is "never executes". Acceptable, but the matrix should say it is structural.
- Everything else in AC-01..AC-85 has at least one implementation step and one test step in the matrix. Step 32 (e2e) cites real IDs.

## 2. Correctness vs code

Verified correct:
- `JobRunner` wraps the handler in `withRetry(retries 2)` and `withTimeout(120s)` (`server/src/platform/jobs.ts:65-82`). D-3 is right.
- `completeStructured` loops `maxRetries+1` attempts and re-asks on a bad parse (`server/src/adapters/llm/openai.ts:96-130`, `reviewer-core/src/llm/openrouter.ts:68-115`). `maxRetries: 0` gives one request.
- `OpenRouterProvider` ignores `req.timeoutMs`; the client timeout is 90_000 (`reviewer-core/src/llm/openrouter.ts:54`).
- `container.featureModel` (`container.ts:265`), `llm` (`:208`), `ConfigError` on a missing key, and the `requireRepoInWorkspace` signature (`modules/_shared/context.ts:35`).
- `getRankedPaths` is ordered by `rank` only (`repo-intel/repository.ts:449-459`). The `getCriticalPaths` adjacency sort has no tie-break (`repo-intel/service.ts:687-689`). `JUNK_PATH_PATTERNS` use `/test/` etc. against a path without a leading slash (`service.ts:713-733`).
- `activeKeyFor`, `NAV`, `githubBlobUrl`, `githubPrUrl`, `middleTruncate` (in `lib/context-docs.ts:183`) exist as cited. The two `knowledge.ts` copies are identical today, and so is the whole vendor tree.
- The `onboarding` table has `repo_id` PK, `json`, `generated_at`, and no `workspace_id` (`db/schema/context.ts:120-126`).

Defects:
- MAJOR · step 2 `incremental.ts` carry-forward. See AC-87 above: use the new walk's stats, not the prior ones.
- MINOR · D-21/step 10. The outer `withTimeout` does not abort the in-flight HTTP request, and the OpenRouter SDK keeps retrying after the wall fires (client timeout 90 s, 2 retries). A "timed out" generation can still bill 1-3 requests in the background. The port has no `AbortSignal`. Document it in Risks. Do not claim "exactly one request" on the timeout path.
- MINOR · D-20. The regex alternative `not valid JSON` has no producer among the adapters' thrown errors (`structured.ts:67` is a reprompt message, not a thrown error). Harmless. Add the OpenRouter "returned no choices" message (`openrouter.ts:88`) to the `provider_error` tests.
- MINOR · step 10 `getTour` order is "no clone, then noCloneSections, else stored". A stored tour on a repo whose clone was later removed shows the skeleton and hides the paid-for tour. Also the precedence of `generated` against `index_not_ready` is unspecified when a stored tour exists but the index degrades. Test 26 has no case for either.
- MINOR · plan header and D-40 still say "pending". Update after the amendments.

## 3. Feasibility and order

- MAJOR · step 10 `startGeneration` race (AC-28). The 409 check (`running.has`) is sub-step 2; `running.set` is sub-step 6, after `await featureModel` and `await llm`. Two near-simultaneous POSTs both pass the check, and both generate (2 paid calls). Fix: take the lock synchronously before the first `await` (set a sentinel or a deferred promise right after the `has` check) and release it in a `finally` if a pre-check throws. Add a unit test that fires two `startGeneration` calls without awaiting between them.
- MINOR · step 22 (i18n) comes after the components (14-21) that use its keys. Not a blocker (next-intl fails at runtime). Write the json with step 14, or state that tests run only after 22.
- MINOR · sizing. Step 10 (facts collection, registry, LRU, generation, failure handling) and step 4 (about 15 functions) are each large for one pass. Step 30 is about 11 test files for one test-writer pass. Consider splitting 10 into collectFacts+cache and getTour/startGeneration/run, and 30 into header/view files and section files.
- Contract mirroring is planned (step 1 both trees, INV-6). No migration and no lockfile change: consistent with INV-5/INV-11.
- Step 2 changes `getRankedPaths` ordering and `isJunkPath`. Existing tests may pin the old order. Run `repo-intel-rank-map.test.ts`, `conventions-extract.test.ts` and `conventions.it.test.ts` in the step 2 checkpoint, not only the degraded test.
- `e2e/specs/` also holds `.md` plans per `e2e/AGENTS.md` (Naming). Step 32 adds only the flow. Minor.

## 4. Invariants INV-1..INV-14

- INV-1/INV-8 are correct. `DOMAIN` is `^src/modules/.+/helpers\.ts$` (`server/.dependency-cruiser.cjs:55`), so `facts/helpers.ts` and the others are Ring 1. `constants.ts`/`schema.ts` are not classified, so for them "checkable" holds only by reading. Say so.
- INV-2 is correct and checkable. `grep` today finds `fileRank` etc. only in `repo-intel/` and `db/`. It would also hit comments, so review hits.
- INV-3 needs a change for AC-86: the service may resolve the provider on GET (to check the key). Reword to "no completion call from GET".
- INV-4 `grep -rn completeStructured` gives 1 hit. A comment containing the word would break the check; say "1 call site".
- INV-5/INV-11/INV-14 are checkable as written. INV-13 becomes unconditional (see AC-21).
- INV-6 is correct (the trees are identical now). The `adapters.ts` clause goes away.
- INV-9: "never imports Container, not even a type import" matches the existing note. OK.
- Missing invariants worth adding:
  - every command string in the tour is built from validated tokens (see section 6);
  - `GET` never starts a generation;
  - the generation lock is acquired before any `await`.

## 5. Tests from ACs

Mostly good: they are written as given/then bullets with data.
- MINOR · vague or code-bound:
  - Test 27 AC-44/65 "reading every file under modules/onboarding as text" tests source text, not behaviour. Keep it as a guard, but add a behavioural case.
  - Test 30 AC-80 pins CSS classes. Acceptable with the stated reason.
  - Test 27 AC-21 "its single user message contains all five sections' facts" is not derivable from the spec. Assert only the call count and `maxRetries`.
  - Tests citing D-13, D-10, D-15 rely on planner decisions, not ACs. The plan declares this, so it is acceptable.
- Missing tests: AC-86 (server and client), AC-87 (integration), AC-88 (explicit), AC-40 allow-list with `serve` and without `lint`, the 409 race, a command-quoting test, a `..` tree path never read.

## 6. Risks the plan misses

- MAJOR · security: commands built from repo-controlled names. D-8/D-9 build `cp <dir>/.env.example <dir>/.env` and `cd <dir> && ...` from directory names in the git tree. A directory named with spaces, `;`, `$()` or backticks becomes a copy-paste command that runs in the user's shell. Only derived text is shown, but the user runs it. Fix: accept a manifest dir only if it matches `^[A-Za-z0-9._-]+$` (or shell-quote it), and test it. Script names are limited by the allow-list, so they are safe.
- MINOR · prompt injection through model output: `UntrustedMarkdown` renders external `https` links (`client/src/components/untrusted-markdown/UntrustedMarkdown.tsx:31-35`, `target=_blank rel="noopener noreferrer nofollow"`). A prompt-injected README can make the model emit a phishing link in the architecture prose. Consider stripping non-GitHub links in `scrubProse`, or list it as an accepted risk.
- MINOR · concurrency: the `Map` registry is per process. A restart mid-generation leaves the client polling a tour that never arrives, with no failure message (R-3). Suggest an "interrupted" hint. The `failures` Map is never pruned.
- MINOR · cost: see the timeout/retry note in section 2. `POST /generate` has no rate limit beyond the 409. Acceptable for local-first.
- Performance: `getCriticalPaths` loads all edges and up to 100,000 ranked paths per call (`repo-intel/service.ts:663-668`). D-33 caching covers the skeleton path. PageRank is not run by the tour. Polling every 2 s while running re-collects nothing for a stored tour. No issue.
- Path traversal: `readFileAt` validates sha and path (`server/src/adapters/git/simple-git.ts:134-150`) and reads git objects. The plan is right to use it.

## 7. AC-40 allow-list (dev, start, serve, build, test, migrate, db:migrate, seed, db:seed)

- It is a sensible, small set: run, build, test, DB setup.
- The plan's D-9 does not match it. It has `typecheck, lint, setup, bootstrap` (not allowed) and lacks `serve` (allowed). Test 23 expects `pnpm run lint`. Align D-9, `SCRIPT_ALLOW_LIST`, steps 3/4 and test 23 to the AC list. Derivation order is part of AC-88, so fix the order in D-9.
- `install` is not a script. The AC derives it from the lockfile. D-7's fallbacks (`packageManager` field, then `npm install`) go beyond "the package manager its lockfile identifies". Either follow the AC (no lockfile gives no install command), or ask the spec author to allow the `packageManager` fallback. Drop the `npm install` default.
- Not in the list and fine to leave out: `lint`, `typecheck`, `setup`, `prepare`, `postinstall`, `dev:*`/`start:*` variants. Monorepo-style `dev:server` would be an AC change.

## Verdict: APPROVE WITH CHANGES

Top 5 changes:
1. Re-sync the plan with the amended requirements: add AC-86/87/88 end to end (contract, steps, tests, an 88-row matrix, Done when); resolve REC-1/2/3/4 into decisions; delete step 11a and the conditional INV-13.
2. Fix AC-87: in `incremental.ts` take M from the `walkClone` stats already computed at `incremental.ts:222`, not from the prior row, and add an integration test across several incremental runs.
3. Make the 409 lock race-free: take the registry lock synchronously before the first `await` in `startGeneration`, and add a concurrent-POST test.
4. Align AC-40/AC-33 with the text: allow-list exactly as in the AC (add `serve`; drop `typecheck/lint/setup/bootstrap`; no `npm install` fallback without a lockfile); drop "tree path" from the diagram `ref` check.
5. Quote or validate directory names in `cp`/`cd` commands (shell injection through copy-paste), and add a test. Also note in Risks that an outer timeout does not cancel in-flight or SDK-retried requests.
