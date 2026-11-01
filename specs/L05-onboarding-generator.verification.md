# L05 Onboarding Generator — verification record

## /run-plan L05-onboarding-generator — done
Plan `specs/L05-onboarding-generator.md` (revision 3) · Requirements `specs/L05-onboarding-generator.requirements.md` (AC-01…AC-88) · Branch `lesson/L05-onboarding-generator` · Fix rounds: 1 in the review loop + 4 after the pre-PR gate

### Commits (one per pipeline stage)
| Stage | Commit |
|---|---|
| spec (spec-creator) | `c35c6d7` requirements · `3bf8350` amendments after planning (REC-1…4) |
| plan (implementation-planner) + cross-model review (Sonnet) | `993081a` (`L05-onboarding-generator.plan-review.md`) |
| implementation, steps 1–22 (after fix round 1) | `364fd75` |
| tests from the ACs, steps 23–31 + e2e flow 09 | `6e82529` fix F-06 found by the tests · `bf56712` tests |
| docs | `43d51d8` |
| pre-PR rounds 2–4 | `8f3a4c6` + `992d05e` · `ed61200` + `9ca3c38` · `7393492` + `93b8f88` (each: fix, then its regression tests) |

### Findings
48 total · fixed 41 · accepted 2 · wontfix 1 · open 4 (F-40, F-41, F-47, F-48 — all SUGGESTION, not taken) — full ledger below.

Accepted (go into the PR description):
- **F-07** — `server/test/repo-intel-facade-degraded.test.ts:118,123,128` fail a scratch typecheck of `server/test` (`RepoBasics.defaultBranch`). Pre-existing (`git blame` → starter snapshot `587c46a`); `pnpm typecheck` does not cover `server/test`. Separate change.
- **F-14 (POST half)** — `POST /repos/:id/tour/generate` keeps `requireRepoInWorkspace`: the lock is taken before the first `await` (INV-17), so without the guard a foreign repo id would answer 409 instead of 404.

Wontfix: **F-05** — JobRunner's 120 s wall wraps the whole handler, so a tour stored late can leave its `jobs` row `failed` (bookkeeping only; documented in `service.ts` and plan R-10).

### Verification (last runs)
```
verify server · baseline L05-onboarding-generator @ 993081a
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ➖ 505 passed · 6 failed (6 baseline, 0 new) · 0 skipped
  integration ✅ 124 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
```
verify client · baseline L05-onboarding-generator @ 993081a
  typecheck   ✅ 0 errors
  tests       ✅ 321 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
`next build` (client, clean copy of HEAD; a dev server held :3000): `✓ Compiled successfully`, `/repos/[repoId]/tour 7.1 kB`.
`/pr-self-review` gates on the final HEAD: CRITICAL 0 · WARNING 0 · SUGGESTION 0; verdict `comment`, not blocked.

### Not verified
- **AC-03, AC-82** — e2e flows 06 and 09 have not run: `agent-browser` is not installable here. CI (`e2e-web.yml`) runs them on the PR. Flow 09 starts with `set viewport 1280 2000` (`e2e/INSIGHTS.md`).
- No live model call was made during the run; the generated path is covered by unit and integration tests with a stub LLM. A manual check on an open-source repository follows this record.

## After this record: UI check and design pass (2026-11-01)

A manual check on the open-source repo `sindresorhus/ky` found that generation on the default model failed (reasoning tokens exhausted the 4,000 cap → AC-83 amended to 10,000, F-37), two jsdom-only passes that broke in a real browser (F-38 scroll container, F-39 coverage heuristic) and a UI that did not match the mockups (F-42…F-45). Fixed in `a533e8b` with tests in `fd9fc5f`; spec/plan updated in `9c8428e`. Last runs: server 528 (6 baseline) + 125 integration, client 329, 0 new failures; architecture approve 0/0/0; security 0 CRITICAL / 0 WARNING (440 renders through `inertLinks`, 0 links). ky now generates a full tour (one model call, ~30 s).

## Final plan-verifier report (verbatim summary of the AC → task → test → commit matrix)

Commits: **I** = `364fd75` (implementation). **F** = `6e82529` (F-06). **T** = `bf56712` (tests). Later pre-PR rounds added regression tests in `992d05e`, `9ca3c38`, `93b8f88` without changing any AC verdict.

ACs: done 85 · partial 0 · not implemented 0 · contradicted 0 · cannot verify 2 (AC-03, AC-82). Steps 23–32: 9 done, step 32 written but not run. Done-when: the e2e line is `cannot verify`; `pnpm build` was settled afterwards (above).

Rows not closed before merge:
1. AC-82 — cannot verify (flow 09 written, not run).
2. AC-03 — cannot verify (flow 06 unchanged, suite not run).
3. Weak by necessity: AC-80 pins CSS classes (jsdom has no media queries); AC-71's 120 s default is not asserted; AC-02/AC-04 test the pure nav helpers, flow 09 covers the rendered sidebar.

| AC | Impl step | Test | Verdict |
|---|---|---|---|
| 01 | 12 | `helpers.test.ts` "AC-01 …in that order"; flow 09 | done |
| 02 | 14 | `helpers.test.ts` "AC-01, AC-02"; TourView; flow 09 | done |
| 03 | untouched | flow 06 unchanged, not run | cannot verify |
| 04 | 12 | `helpers.test.ts` "AC-02, AC-04" | done |
| 05 | 12 | `helpers.test.ts` "AC-05" | done |
| 06 | 14, 15 | TourView "AC-06" | done |
| 07 | 1, 7, 14 | TourView `it.each` "AC-07" ×4 statuses; tour "AC-07"; flow 09 | done |
| 08 | 16 | OnThisPage "AC-08" | done |
| 09 | 16 | OnThisPage "AC-09" | done |
| 10 | 16 | TourSection "AC-10, AC-11" | done |
| 11 | 16 | TourSection "AC-10, AC-11" | done |
| 12 | 1, 7, 10, 15, F | TourHeader "AC-12 …4,200 files"; tour; it; service | done |
| 13 | 1, 2, 7, 15, F | TourHeader "AC-13 N of M"; tour; repo-intel reads it; service | done |
| 14 | 7, 10, 15 | tour; service; it; TourHeader | done |
| 15 | 2, 7, 10, 15 | tour `it.each`; service; it; TourHeader; TourView | done |
| 16 | 7, 10, 15 | tour; service; TourHeader "AC-16, AC-69" | done |
| 17 | 13, 14 | TourView "AC-17" | done |
| 18 | 13, 14 | TourView "AC-18" | done |
| 19 | 11, 14 | TourView ×2; it "AC-19, AC-65" | done |
| 20 | 2, 4, 10 | facts; repo-intel reads "AC-20"; it "AC-20, AC-52" | done |
| 21 | 3, 10c | service "AC-21 exactly one completeStructured, maxRetries 0" | done |
| 22 | 10, 11 | service; it | done |
| 23 | 2, 4 | facts ×2; repo-intel reads; service | done |
| 24 | 8, 10 | service; it | done |
| 25 | 10, 13 | service; it; TourView | done |
| 26 | 7, 10, 14, 15 | tour; it; TourView | done |
| 27 | 10, 11, 13, 15 | it (202); TourView (one POST); hook | done |
| 28 | 10c, 11, 13, 15 | service ×3 (409, same-tick race, release); it ×2; TourHeader; hook | done |
| 29 | 10, 13 | service; it; hook (2,000 ms polling) | done |
| 30 | 9, 18 | ArchitectureSection "AC-30, AC-31" | done |
| 31 | 6, 9, 18 | grounding ×2; ArchitectureSection | done |
| 32 | 1, 18 | ArchitectureDiagram "AC-32"; ArchitectureSection | done |
| 33 | 6, 9 | grounding ×3 | done |
| 34 | 4, 7, 18 | facts; tour; ArchitectureSection | done |
| 35 | 2, 4, 19 | facts ×3; repo-intel reads; CriticalPaths; FileRow | done |
| 36 | 4, 6, 19 | facts; grounding; repo-intel reads; FileRow | done |
| 37 | 19 | FileRow "AC-37, AC-79" | done |
| 38 | 4, 7, 19 | facts; tour; CriticalPaths | done |
| 39 | 1, 20 | RunLocally "AC-39" | done |
| 40 | 3, 4 | facts (order, allow-list, lockfile, unsafe dirs) | done |
| 41 | 6, 9 | grounding "AC-41, AC-88" | done |
| 42 | 17, 20 | CopyControl; RunLocally | done |
| 43 | 20 | RunLocally "AC-43" | done |
| 44 | 10 | service (GitClient spies + source guard) | done |
| 45 | 4, 7, 20 | facts; tour; RunLocally | done |
| 46 | 2, 4 | repo-intel reads "AC-46, AC-23" | done |
| 47 | 2 | repo-intel reads "AC-47"; facts EXCLUDED_DIRS parity (F-02) | done |
| 48 | 1, 4, 19 | service; ReadingPath | done |
| 49 | 4, 6, 19 | facts; grounding; FileRow; ReadingPath | done |
| 50 | 6, 9 | grounding "AC-49, AC-50" | done |
| 51 | 7, 19 | tour; ReadingPath | done |
| 52 | 4, 8, 10 | facts ×4; it | done |
| 53 | 3, 4 | facts "AC-53" | done |
| 54 | 6, 9, 21 | grounding; FirstTasks | done |
| 55 | 6 | grounding | done |
| 56 | 6, 7, 21 | grounding ×2; tour; FirstTasks | done |
| 57 | 1, 21 | FirstTasks "AC-57" | done |
| 58 | 7, 8, 10, 21 | tour; it; TourView | done |
| 59 | 7, 21 | tour; FirstTasks | done |
| 60 | 5, 9, 10 | prompt "AC-60"; service | done |
| 61 | 4, 6, 7 | grounding ×4 | done |
| 62 | 18 | ArchitectureSection "AC-62" | done |
| 63 | 18 | ArchitectureDiagram "AC-63" | done |
| 64 | 4, 10 | facts; service | done |
| 65 | 8, 10, 11 | service; it | done |
| 66 | 3, 5 | prompt; service | done |
| 67 | 5 | prompt ×4 (drop order) | done |
| 68 | 4, 10 | facts; service | done |
| 69 | 5, 7, 15 | prompt; tour; TourHeader | done |
| 70 | 10, 11, 15 | service; it; TourView | done |
| 71 | 10, 14, 15 | service; it; TourView | done (120 s default not asserted) |
| 72 | 6, 10c | grounding ×4; service; TourView | done |
| 73 | 10, 15 | service; it; TourView | done |
| 74 | 7, 15 | tour; it; TourHeader | done |
| 75 | 15, 17 | TourHeader "AC-75" | done |
| 76 | 17 | CopyControl "AC-42, AC-76" | done |
| 77 | 17 | CopyControl "AC-77" ×2 | done |
| 78 | 19 | FileRow "AC-78" | done |
| 79 | 19 | FileRow "AC-37, AC-79" | done |
| 80 | 16 | TourView "AC-80" (class pin) | done (weak by necessity) |
| 81 | 16 | OnThisPage (activeSection + scroll event) | done |
| 82 | 12, 14 | flow 09 written, not run | cannot verify |
| 83 | 3, 10 | service "AC-83 maxTokens 4000" | done |
| 84 | 1, 10, 15 | TourHeader; tour; it | done |
| 85 | 6, 18 | grounding ×2; ArchitectureSection | done |
| 86 | 1, 7, 10b, 10c, 11, 14, 15, 22 | tour ×3; service ×2; it ×2; TourView ×3 | done |
| 87 | 2, 7, 10c | repo-intel reads (full + 3 incremental); it; incremental-coverage (F-09/F-10) | done |
| 88 | 4, 6 | facts; grounding | done |

## Findings ledger
| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | SUGGESTION | `client/src/app/repos/[repoId]/tour/_components/TourView/_components/TourHeader/TourHeader.tsx:12` | child imports parent's `../../helpers` (type `StatusLine`) — dependency points up (frontend-ui-architecture) | fixed | StatusLine/statusLines moved to TourHeader/helpers.ts:36,48; no ../../ import left |
| F-02 | 1 | architecture-reviewer | SUGGESTION | `server/src/modules/onboarding/constants.ts:122` | `EXCLUDED_DIRS` duplicated from repo-intel/constants.ts:17; no test pins equality | fixed | server/test/onboarding-facts.test.ts pins both EXCLUDED_DIRS equal |
| F-03 | 1 | architecture-reviewer | SUGGESTION | `server/src/modules/onboarding/service.ts:154` | in-process `running` registry instead of JobRunner (documented D-3) | fixed | user: fix → run generation on JobRunner; handler must never throw (store failure itself) so JobRunner retries can never re-call the model (AC-21); keep the synchronous 409 lock (INV-17) ; done: TOUR_JOB_KIND constants.ts:44, handler service.ts:335 never throws, lock service.ts:274 |
| F-04 | 1 | plan-verifier | gap | `client/messages/en/onboarding.json` (`sections.runLocally`, `sections.readingPath`) | step 22 / AC-07 `contradicted`, AC-82 `partial`: titles must be "How to run locally" and "Guided reading path" exactly | fixed | onboarding.json:54-55 exact AC-07 titles |
| F-05 | 2 | architecture-reviewer | SUGGESTION | `server/src/platform/jobs.ts:41,67` vs `server/src/modules/onboarding/service.ts:378-397` | JobRunner's 120 s wall wraps the whole handler: a tour stored late can leave its `jobs` row `failed` (bookkeeping only) | wontfix | user: document, already in service.ts header |
| F-06 | 3 | test-writer | test | `client/messages/en/onboarding.json` `header.generated` / `header.generatedPartial` | NEW FAIL TourHeader.test.tsx AC-12/AC-13: header renders "4200 files" / "4200 of 12450" — `{files}`/`{total}` not number-formatted; plan 30a + design say "4,200" / "12,450" | fixed | onboarding.json:7-8 {files, number} / {total, number}; client 318/318 |
| F-07 | 3 | test-writer | WARNING | `server/test/repo-intel-facade-degraded.test.ts:118,123,128` | scratch typecheck of server/test: `RepoBasics` now requires `defaultBranch` — pre-existing lines; `pnpm typecheck` does not cover server/test. Check whether this change caused it; fix if so | accepted | implementer: pre-existing — git blame 587c46a (starter snapshot) for lines 118/123/128 and RepoBasics.defaultBranch; branch does not touch it  → user: accept (pre-existing, separate change) |
| F-08 | 4 | code-review | WARNING | `server/src/modules/onboarding/service.ts:512` | parseManifest runs on the 6,000-char excerpt → package.json > 6,000 chars fails JSON.parse, scripts/deps lost; parse full text, excerpt only the prompt copy | fixed | round 2 (fresh implementer) |
| F-09 | 4 | code-review | WARNING | `server/src/modules/repo-intel/pipeline/incremental.ts:276` | incremental always writes softBudgetReached:false + filesIndexed=walk length → erases partial-coverage from a soft-budgeted full pass (AC-13/87); walk-failed branch also drops it | fixed | round 2 (fresh implementer) |
| F-10 | 4 | code-review | WARNING | `server/src/modules/repo-intel/pipeline/incremental.ts:287` | filesIndexed updated from walk even when buildEdges/resolve/replaceFileRank threw → N no longer = file_rank rows | fixed | round 2 (fresh implementer) |
| F-11 | 4 | code-review | WARNING | `server/src/modules/onboarding/service.ts:371` | handler reuses indexState captured at POST; job may wait in shared PQueue while index refreshes → revision A with rows of B; re-read getIndexState at handler start | fixed | round 2 (fresh implementer) |
| F-12 | 4 | code-review | WARNING | `server/src/modules/onboarding/helpers.ts:251` | collectFacts may store HEAD (fallback) as revision → `outdated` compares to lastIndexedSha forever, regenerate cannot clear it | fixed | round 2 (fresh implementer) |
| F-13 | 4 | code-review + security lens | WARNING | `server/src/modules/onboarding/service.ts:228,284,477` | getIndexedFiles loads all file_rank rows + GROUP BY over file_edges just for `.length` on every GET (polled every 2 s) and twice per POST; add a count facade / reuse facts | fixed | round 2 (fresh implementer) |
| F-14 | 4 | code-review | SUGGESTION | `server/src/modules/onboarding/service.ts:478,210,278` | getTopFilesByRank called for 8 and 30 (slice instead); repo row fetched by route guard and service | accepted | (a) one getTopFilesByRank call fixed; (b) GET guard removed; POST keeps requireRepoInWorkspace — else lock-before-await (INV-17) answers 409 not 404 for a foreign repo  → user: accept |
| F-15 | 4 | code-review | SUGGESTION | `server/src/modules/onboarding/facts/helpers.ts:450` | double excerpt; TODO_PATTERN bare `#` matches JS private fields / strings → fake todo candidates | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-16 | 4 | code-review | SUGGESTION | `server/src/prompts/onboarding.system.md:12` | says "exactly these five parts" then lists six bullets | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-17 | 4 | security lens | WARNING | `server/src/modules/onboarding/grounding/helpers.ts:250-309` | scrubProse misses `www.` autolinks and reference-style links (`[t][a]` + `[a]: https:evil`) → clickable external link in tour prose (D-26); add tests | fixed | round 3: round 2 (fresh implementer) ; security re-check: bypasses remain → F-29 |
| F-18 | 4 | security lens | WARNING | `server/src/modules/onboarding/service.ts:462,486-489,502-507` | blobs read with no size cap (ls-tree sizes dropped); huge README/manifest buffered whole, also on plain GET with no stored tour; mirror project-context size guard | fixed | round 2 (fresh implementer) |
| F-19 | 4 | security lens | SUGGESTION | `server/src/modules/onboarding/service.ts:324-362` | a JobRunner re-run of the handler (DB update retry) records "not started by this process" over a success and releases another generation's lock (no ownership check) | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-20 | 4 | security lens | SUGGESTION | `server/src/modules/onboarding/constants.ts:240` | SAFE_DIR_SEGMENT allows a leading `-` → `cd -P && …` | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-21 | 4 | frontend lens | WARNING | `client/src/app/repos/[repoId]/tour/_components/TourView/_components/TourHeader/TourHeader.tsx:96,100` | format.relativeTime without `now` → IntlError ENVIRONMENT_FALLBACK on every render (polled 2 s), "last refreshed" never moves; useNow like IntentCard.tsx:270 | fixed | round 2 (fresh implementer) |
| F-22 | 4 | frontend lens | SUGGESTION | TourHeader.tsx:16, FileRow/helpers.ts:5, TourView/helpers.ts:4-12 | constants in component/helpers files instead of constants.ts | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-23 | 4 | frontend lens | SUGGESTION | TourView/helpers.ts:4-17, TourView.tsx:93, FirstTasksSection.tsx:24 | hand-kept KNOWN_INDEX_REASONS + key casts defeat next-intl typing; use t.has | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-24 | 4 | frontend lens | SUGGESTION | OnThisPage/OnThisPage.tsx:17-30 | scroll handler unthrottled (5 getBoundingClientRect + setState per event) | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-25 | 4 | frontend lens | SUGGESTION | ArchitectureDiagram.tsx:59, FileRow.tsx:34, RunLocallySection.tsx:22 | hardcoded glyphs/text in JSX (sr-only "→") | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-26 | 4 | frontend lens | SUGGESTION | OnThisPage.test.tsx:44,53; TourView.test.tsx:160 | querySelector instead of role queries; scrollIntoView prototype stub leaks past restoreAllMocks | fixed | test-writer round 2 user: fix (test-writer) |
| F-27 | 4 | frontend lens | SUGGESTION | TourHeader.tsx:49 | window.location.origin read during render | fixed | round 2 (fresh implementer) user: fix (round 2, implementer) |
| F-28 | 5 | implementer | test | `server/test/onboarding-service.test.ts:188` | 25 NEW FAIL `countIndexedFiles is not a function` — the hand-built repoIntel mock lacks the F-13 facade method (add `countIndexedFiles: vi.fn(async () => indexed.length)`) | fixed | test-writer round 2 |
| F-29 | 6 | security re-check | WARNING | `server/src/modules/onboarding/grounding/helpers.ts:250-320` + `client/.../ArchitectureSection/ArchitectureSection.tsx:22` | F-17 incomplete: GFM autolink literals bypass the source regex (`&#104;ttps://`, `https\://`, `_https://…_`, `\www.x`), and the CODE tokenizer disagrees with CommonMark (escaped backticks, unequal runs) so inline links pass untouched. Fix the class at render: tour prose renders every external href as inert text (AST-level `a` override / tour variant of UntrustedMarkdown); server scrub stays best-effort | fixed | round 3: |
| F-30 | 6 | security re-check | WARNING | `server/src/modules/onboarding/grounding/helpers.ts:265,286` | LINK_DEFINITION `raw.replace(…,'')` deletes ordinary prose (`[TODO]: fix this later` → ""), anchored mid-line after code spans — same class as reviewer-core INSIGHTS F-27. Make it insertion-only (escape the `[`), real line starts only, + round-trip test | fixed | round 3: |
| F-31 | 6 | security re-check | SUGGESTION | `grounding/helpers.ts:258-259,315-318` | URL token swallows trailing `*"~>`; `<x:https://e>` loses `>` | fixed | round 3: |
| F-32 | 6 | security re-check | SUGGESTION | `server/src/modules/onboarding/service.ts:519` | F-18 cap skipped if size is NaN (`!Number.isFinite(size)`) | fixed | round 3: |
| F-33 | 6 | security re-check | SUGGESTION | `server/src/platform/jobs.ts:60-63` vs `service.ts:338,377` | pre-existing: if the runner's status update throws, handler never runs and the repo lock sticks (409 until restart); release in `job.done.catch` when pending still holds that generation | fixed | round 3: |
| F-34 | 7 | implementer | test | `server/test/onboarding-grounding.test.ts:350` | NEW FAIL by design: test pinned the old deleting definition scrub (F-30); must assert escaped `\[` + URL in code + byte round-trip | fixed | rewritten + insertion-only round-trip corpus (12) |
| F-35 | 8 | security re-check | SUGGESTION | `server/src/modules/onboarding/service.ts:338-342` | F-33 release path records no failure → generation silently vanishes; set a provider_error failure before release | fixed | user: fix (round 4) ; round 4 |
| F-36 | 8 | security re-check | SUGGESTION | `server/src/modules/onboarding/grounding/helpers.ts:258-393` | server scrub still best-effort (9/13 bypass cases); guarantee is client inertLinks — state in the tour DTO contract that prose must be rendered with inertLinks | fixed | user: fix (round 4) ; round 4 |
| F-37 | 9 | UI check (sindresorhus/ky) | WARNING | `server/src/modules/onboarding/service.ts` (run) + `reviewer-core/src/llm/openrouter.ts:115` | real generation on the default onboarding model (openrouter `deepseek/deepseek-v4-flash`, strict json_schema) fails `invalid_output`; the cause (zod issues / raw output) is never logged, so it cannot be diagnosed | fixed | root cause: reasoning tokens exhaust the 4,000 cap (finish_reason length); OUTPUT_MAX_TOKENS → 10,000 (user: AC-83 amended); failure logged via app.log; raw/issues logging needs adapter change → separate PR (user) |
| F-38 | 9 | UI check | WARNING | `client/.../OnThisPage/OnThisPage.tsx` | "On this page" stays on "Architecture overview" when scrolled to First tasks in the real app — listener likely on `window` while the app shell scrolls its own container (AC-81 passes in jsdom only) | fixed | round 5 user: fix (round 5) + re-run on ky |
| F-39 | 9 | UI check | WARNING | `server/src/modules/onboarding/facts/helpers.ts` (`missingTestCandidates`) | ky: "Add tests for source/index.ts" though `test/` has 46 test files — the heuristic only matches same-name test files | fixed | round 5 user: fix (round 5) + re-run on ky |
| F-40 | 9 | UI check | SUGGESTION | `server/src/modules/onboarding/facts/helpers.ts` (`detectStack`) | ky (an HTTP client) shows "Frameworks: Express" — devDependencies (test server) count as frameworks | open | |
| F-41 | 9 | UI check | SUGGESTION | `facts/helpers.ts` (`installCommand`, D-7) | repo without a lockfile gets no install step at all (ky: only `npm run build`, `npm run test`) — per D-7 by design, but reads as broken | open | |
| F-42 | 10 | user | design | `client/src/app/repos/[repoId]/tour/**` | UI does not match the mockups (lab5.5-1/2.png) — 16 gaps in `design-gaps.md` (D-1…D-16) | fixed | D-1..D-16 (2 partial: mono font fallback on Windows; per-kind fill kept for AC-32); visual check vs mockups |
| F-43 | 11 | UI check | WARNING | `server/src/modules/onboarding/grounding/helpers.ts` (scrubProse, D-26 (1)) | removing an unknown-path code span leaves broken prose: "a local Express server () providing" — keep the text as plain (non-code) text instead of deleting it | fixed | AC-61 kept (unknown path still removed); an emptied `()` is removed too — plain-text alternative would break AC-61 |
| F-44 | 11 | UI check | SUGGESTION | tour prose / RunLocallySection | no gap between prose paragraphs; run-locally comments show literal backticks (`` `distribution/` ``) | fixed | flex gap on the markdown root (unlayered `p{margin:0}` in vendored ui CSS beat Tailwind); comment backtick spans → <code> |
| F-45 | 11 | implementer (UI check) | design | `client/.../ArchitectureDiagram/helpers.ts` (`layoutDiagram`) | an edge between non-adjacent layers runs straight through an intermediate box (reads as strikethrough); mockup uses orthogonal (elbow) routing between boxes | fixed | orthogonal routing, gutter lanes for layer-skipping/back edges; 3,000 random graphs: 0 overlaps, 0 box crossings |
| F-46 | 12 | implementer | test | client tests | 3 NEW FAIL by design: ReadingPath (no dot, reason on own line), RunLocally (no dot), ArchitectureDiagram AC-32 (edges are `<path marker-end>`, not `<line>`); server AC-83 test still expects 4,000 | fixed | tests updated part-by-part + new tests F-37..F-45; server 528+125, client 329 |
| F-47 | 13 | security re-check | SUGGESTION | `server/src/modules/onboarding/grounding/helpers.ts:258-259` | email part of BARE_URL is quadratic on long `a.a.a.` runs (2.2 s at 40k chars) — prose can now be ~10k tokens; anchor the local part at a boundary or cap prose before scrubbing | open | |
| F-48 | 13 | security re-check | SUGGESTION | `grounding/helpers.ts:455` | `generationFailureLog` reads `e.raw` but adapters attach `details.raw` — dead field today; document it as model/repo text if wired later | open | |

## Run log
- 2026-10-31 · preflight · main · ok (plan rev 2, 88 ACs, branch lesson/L05-onboarding-generator; commits c35c6d7 spec, 3bf8350 spec amend, 993081a plan)
- 2026-10-31 · implement · implementer · done steps 1–22, 0 new failures (phase1-implementer.md)
- 2026-10-31 · review 1 · architecture-reviewer · INV-1..17 pass (INV-15 not checked: security), 0 CRIT/0 WARN/3 SUGG
- 2026-10-31 · review 1 · plan-verifier gap · steps 21/22 done, AC 85/88 done; 1 gap (F-04)
- 2026-10-31 · fix 1 · implementer · F-01,F-03,F-04 fixed; 0 new failures
- 2026-11-01 · review 2 · architecture-reviewer approve (F-01,F-03 resolved; F-05 SUGG → wontfix) ∥ plan-verifier step 22/AC-07 done, AC-82 cannot verify until e2e
- 2026-11-01 · commit (2) · main · 364fd75 feat(onboarding) steps 1–22 + plan rev 3
- 2026-11-01 · tests · test-writer · steps 23–31 + F-02 written; server 468+124 green vs baseline; client 2 NEW FAIL (F-06 product bug)
- 2026-11-01 · phase 5 · implementer · flow 09 written (not run: no agent-browser), F-06 fixed, F-07 disputed · commits 6e82529 fix, bf56712 test
- 2026-11-01 · final verify · plan-verifier · AC done 85, cannot verify 2 (AC-03, AC-82 e2e), pnpm build cannot verify
- 2026-11-01 · docs · doc-writer · docs/onboarding-tour.md 43d51d8; client pnpm build ✅ (scratch copy, /tour 7.1 kB)
- 2026-11-01 · pr · gates 0/0/0 + 3 lens passes + /code-review medium: CRIT 0, WARN 9 (F-08..13,17,18,21), SUGG 11
- 2026-11-01 · fix 2 · implementer (fresh) · 18 fixed, F-14 partly disputed; F-28 test (mock)
- 2026-11-01 · re-review 5 · arch 0/0/0 · security: F-17 reopened, F-29/F-30 WARN, F-31..33 SUGG
- 2026-11-01 · fix 3 · implementer (fresh) · F-17,F-29..F-33 fixed (inertLinks render guard; insertion-only definitions); F-34 test
- 2026-11-01 · tests 3 · test-writer · F-34 + round-trip + F-29..F-33 tests; server 505+124, client 321 green
- 2026-11-01 · re-check 3 · security · 0 CRIT/0 WARN (314 renders, no <a>/<img>); F-35,F-36 SUGG
- 2026-11-01 · fix 4 · F-35, F-36 fixed + test; ledger: 33 fixed, 2 accepted, 1 wontfix, 0 open
- 2026-11-01 · UI check · main · sindresorhus/ky imported+indexed; skeleton OK; Generate → invalid_output on default model; F-37..F-41
- 2026-11-01 · fix 5 · implementer (fresh) · F-37 (cap 10k, user OK), F-38, F-39 fixed; ky generation succeeds; design pass F-42 started
- 2026-11-01 · design pass · implementer · D-1..D-16 done (2 partial); visual check vs mockups OK; F-43, F-44 polish
- 2026-11-01 · polish · implementer · F-43 (AC-61 kept), F-44 fixed; F-45 diagram routing
- 2026-11-01 · tests 5 · test-writer · F-46 + F-37..F-45 tests; server 528+125, client 329 green
- 2026-11-01 · review 13 · arch approve 0/0/0 ∥ security 0 CRIT/0 WARN (440 renders, 0 <a>/<img>); F-47, F-48 SUGG
