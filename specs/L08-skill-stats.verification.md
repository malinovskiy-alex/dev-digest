## /run-plan L08-skill-stats — done
Plan `specs/L08-skill-stats.md` (rev 2) · Requirements `specs/L08-skill-stats.requirements.md` (R-01…R-83) · Branch `lesson/L08-homework` · Fix rounds: 5 (rounds 4–5 past the cap of 3, each approved by the user)

Run shape: phase 0+1a (baselines, contract) → server ∥ client implementers on disjoint paths (tests included) → review (plan-verifier ∥ architecture-reviewer ∥ security lens ∥ `/code-review` ∥ frontend lenses) → fix 1 (both streams) → re-review → fix 2 (two fresh implementers, disjoint) → re-review → fix 3 → in-place build + browser smoke → fix 4 → `/pr-self-review` (gates + `/code-review`) → fix 5 (two fresh implementers) → re-review → re-build + smoke → final plan-verifier. No `--docs`.

## Findings
24 total · fixed 22 · accepted 1 · wontfix 1 · open 0 — `.devdigest/cache/sdd/L08-skill-stats/findings.md` (copied below)

Accepted (goes into the PR description):
- F-10 — no `agent_runs (workspace_id, status, ran_at)` index; the pull-frequency reads now run on every Skills-page load. REC-3: no migrations in this change.

Recorded user decisions made during the run:
- R-73 — the card pull-frequency window ends at the first load of the skills pages and is refreshed by a skill write, a reload or cache expiry (consequence of F-04).
- R-82 — the hint shows on hover of the pull-frequency badge and on keyboard focus of the card, not on hover of the whole card (F-18). The final verifier graded R-82 / D11 `partial` against the original wording; the requirement is amended to the user's choice.
- F-21 wontfix — the reserved hint line under each card's badge row is the accepted cost of F-19.

## Verification
Last outputs (final plan-verifier pass, after fix round 5):
```
verify server · baseline L08-skill-stats @ e746aec
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 781 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 181 passed · 0 failed (0 baseline, 0 new) · 0 skipped
verify client · baseline L08-skill-stats @ e746aec
  typecheck   ✅ 0 errors
  lint        ✅ no errors
  tests       ✅ 578 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
- `pnpm build` in `client/` with :3000 free and `.next` wiped, after fix rounds 4–5: `✓ Compiled successfully`, `✓ Generating static pages (8/8)`, `/skills/[id] 6.28 kB / 217 kB`, exit 0.
- `/pr-self-review` gates G1–G12: CRITICAL 0 · WARNING 0 · SUGGESTION 0. The confirming `/code-review` found F-22…F-24, fixed in round 5 and re-reviewed (`approve`).
- `diff -r server/src/vendor/shared client/src/vendor/shared`: empty. No `package.json`, lockfile, schema or migration change.
- Browser smoke (claude-in-chrome, live seeded data): `/skills` sends one pull-frequency GET, cards show "N agents · X% pull freq"; `/skills/:id?tab=stats` for api-contract-gate: Used by 3 agents, 100% (8/8 PRs), 32 findings (= 20 + 12 of its agents), agents' runs 7 + 4 + 0 = the dashboard's 11, donut + severity row, window caption; a rail click sends no new pull-frequency GET; empty widget state; Open → the agent's Stats tab with the pinned window, the Findings widget and the caption; `/agent-performance` caption. Console: no route error, no error-boundary output. Live API: `to=9999-12-31T23:59:59-14:00` / `to=10000-01-01T00:00:00Z` → 422 on all four range routes, exact boundary → 200.

## Not verified
- C25, C26 — process rules (escape-bearing code via Edit/Write; no commit during review); nothing in the tree contradicts them, and no commit was made during the run.
- R-58 end to end — the stats 404 → editor not-found chain is covered by three tested links but no single test or browser check drives it whole. Settles by: delete a skill in another tab while its Stats tab is open, or a page-level test.
- R-54 / R-55 — wrapping on a narrow viewport and a keyboard-only walk were not checked in a browser.
- F-09 bundle gain — the lazy-loaded StatsTab is in place; whether recharts actually leaves the `/skills/[id]` chunk was not measured with a bundle analyser.

## Next
Commit? Nothing blocks it. `.claude/settings.json` (the user's `ENABLE_TOOL_SEARCH`) stays out of the feature commit; `.claude/agents/architecture-reviewer.md` (the 25 → 21 sentence fixed mid-run) belongs with the agent/retro commit.

---

## Final plan-verifier report (verbatim)

## Plan
`specs/L08-skill-stats.md` (requirements `specs/L08-skill-stats.requirements.md`, `## Decisions` read first) — FINAL pass, **153 items** extracted: 20 steps · 3 contract parts (a)(b)(c) · 26 constraints · 14 `Done when` boxes · 7 verification commands/checks · 83 requirements (R-01…R-83). The plan has no task-text requirements beyond the caller's instructions. Numbering: S1–S20 steps, K1–K3 contract, C1–C26 constraints, D1–D14 done-when, V1–V7 verification, then R-01…R-83.

Scope of this pass: I could not retrieve the itemised iteration-1 table, so every item was re-graded from the current code and the outcome checks. Items the fix rounds touched are re-read at `file:line`. Items they did not touch are marked "carried", meaning unchanged from iteration 1 and still covered by the green suites below. `pnpm build` and the browser items are graded per `state.md:21` and `state.md:22`. That build ran before rounds 4–5, which touched `SkillCard/**`, `hooks/agents.ts` and server `helpers.ts`. The re-build running in the main session is not in this report.

## Outcome checks (run in the foreground, baseline `L08-skill-stats`, no `--save-baseline`)

```
verify server · baseline L08-skill-stats @ e746aec
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 781 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 181 passed · 0 failed (0 baseline, 0 new) · 0 skipped
verify client · baseline L08-skill-stats @ e746aec
  typecheck   ✅ 0 errors
  lint        ✅ no errors
  tests       ✅ 578 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
- `diff -r server/src/vendor/shared client/src/vendor/shared` → empty ("identical").
- `git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty.
- `client/pnpm-workspace.yaml` → absent.
- Integration skipped count is 0, so this is a real run and not a Docker-less one.

## Per-item verdicts

### Steps
| # | Item (plan) | Verdict | Evidence | Note |
|---|---|---|---|---|
| S1 | "1 … contract — both copies, `## Contract` (a)–(c)" | `done` | `diff -r` empty; both typechecks 0 errors; `server/src/vendor/shared/contracts/skill-stats.ts`, `agent-performance.ts` | contract also gained the F-02 upper bound and the F-03 `rate` bound (see Deviations) |
| S2 | "2 … `types.ts` BreakdownRow, AgentRunCount, PerfSkillRef, port methods" | `done` | repo `implements PerformanceReadSource` (`repository.ts:28`); server typecheck green | carried; `BreakdownRow` gained `win`, port gained `windows` (F-11) |
| S3 | "3 … `helpers.ts` foldBreakdown, skillFigures, pullFrequency, buildSkillStats, buildSkillsPullFrequency, buildStats 5th param default" | `done` | `helpers.ts:234,362,383,394,404,428`; unit file `skill-stats-helpers.test.ts` green | F-13 `skillFigures`=`foldFigures`; F-22 clamp at `:394-397` |
| S4 | "4 … `repository.ts` findingStateColumns, getSkill, listSkillIds, usingAgents, runCountsByAgent, findingBreakdown, reviewedPrCount, prsWithSkill, activeSkillOnAgent" | `done` | `repository.ts:108,185,194,204,221,232,257,266`; empty ids → `[]` without query `:223,239` | |
| S5 | "5 … `service.ts` skillStats, skillsPullFrequency, agentStats adds findingBreakdown" | `done` | `service.ts:41-52,62-77,84-91`; probe first `:63,85` | F-07 and F-11 reshaped the read order; outcome met (see Deviations) |
| S6 | "6 … `routes.ts` two routes, one line each up to the path; arch green" | `done` | `routes.ts:41,46` (single-line registrations); `arch ✅` | |
| S7 | "7 … `skill-stats-helpers.test.ts` U1–U7" | `done` | `server/test/skill-stats-helpers.test.ts:33-191` (U1–U7, F-22 cases `:73,78`); 781 passed | |
| S8 | "8 … `skill-stats.it.test.ts` I1–I20" | `done` | `skill-stats.it.test.ts:298-556` (I1–I20 + F-02 `:461`); 181 it passed, 0 skipped | |
| S9 | "9 … `perf-range.ts` perfRangeQuery, lastThirtyDays, captionWindow, captionNeedsYear" | `done` | `perf-range.ts:248,258,273,286`; hook imports it; client 578 green | carried |
| S10 | "10 … `hooks/skill-stats.ts` useSkillStats, useSkillsPullFrequency" | `done` | `hooks/skill-stats.ts:29-53,59-82`; tests `skill-stats.test.tsx:47-128` | key, window source and staleTime differ from the plan (F-04, F-06): Deviations |
| S11 | "11 … `lib/skills.ts` skillEditorHref" | `done` | `lib/skills.ts` `skillEditorHref`; `lib/skills.test.ts:5` | carried |
| S12 | "12 … messages added" | `done` | `skills.json` `editor.tabs.stats`, `listItem.{agents,pullFreq,pullFreqUnknown,pullFreqLoading,pullFreqHint}`, `stats.*`; `agentPerformance.json` `range.caption.*`, `findings.*` | `listItem.agentCount` removed (F-15), replaced by `listItem.agents` |
| S13 | "13 … `RangeCaption`" | `done` | `perf-range-control/RangeCaption.tsx`; export in `index.ts`; `RangeCaption.test.tsx` | carried |
| S14 | "14 … `components/findings-widget/`" | `done` | `findings-widget/{FindingsWidget.tsx,helpers.ts,constants.ts,_components/CategoryDonut}`; `CategoryDonut.tsx:33` `role="img"` | carried |
| S15 | "15 … agent StatsTab + AgentPerformanceView wired" | `done` | `agents/.../StatsTab.tsx:46,116`; `AgentPerformanceView.tsx:55` | carried |
| S16 | "16 … skill editor Stats tab + `page.tsx` href" | `done` | `SkillEditor/constants.ts` TABS order config/preview/stats/versions/context; `page.tsx:42,~110` use `skillEditorHref` | StatsTab loaded via `next/dynamic` (`SkillEditor.tsx:23`, F-09) |
| S17 | "17 … skill StatsTab, SkillKpiCards, SkillAgentsList" | `done` | `StatsTab.tsx`, `SkillKpiCards.tsx`, `SkillAgentsList.tsx` | carried |
| S18 | "18 … SkillCard, PullFreqBadge, SkillsListView, page.tsx pull frequency" | `done` | `SkillCard.tsx:157-159`, `PullFreqBadge.tsx`, `SkillCard/helpers.ts:33-42`; `SkillsListView.tsx:29,96`, `page.tsx:34,~100` | hint split into `PullFreqHint` (F-05/F-18/F-19/F-20) |
| S19 | "19 … `perf-range.test.ts`, `skills.test.ts`, `skill-stats.test.tsx`" | `done` | `lib/skills.test.ts:5`, `hooks/skill-stats.test.tsx:46-128`, `perf-range.test.ts` | |
| S20 | "20 … component tests + fixtures" | `done` | `FindingsWidget.test.tsx`, `RangeCaption.test.tsx`, skill `StatsTab.test.tsx:62-132`, `SkillKpiCards.test.tsx`, `SkillAgentsList.test.tsx`, `page.test.tsx:108-118`, `SkillCard.test.tsx:100-253`, `SkillsListView.test.tsx:160-222`, `SkillEditor.test.tsx`; client 578 green | |

### Contract
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| K1 | "(a) `FindingCategoryCounts`, `FindingSeverityCounts`, `FindingsBreakdown`, `AgentStatsReport.findings`" | `done` | `agent-performance.ts` both copies; `buildStats` returns `findings` (`helpers.ts:234-253`) | |
| K2 | "(b) `contracts/skill-stats.ts`" | `done` | `skill-stats.ts:15-30` etc.; byte-identical (`diff -r`) | `rate` is `.min(0).max(1).nullable()` (F-03) |
| K3 | "(c) both `index.ts` re-export `skill-stats`" | `done` | `diff -r` empty; route imports `SkillStatsReport` from `@devdigest/shared` | |

### Constraints
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| C1 | "two vendored copies edited together, `diff -r`, typecheck both" | `done` | `diff -r` empty; both typechecks 0 errors | |
| C2 | "client imports types only from `@devdigest/shared`; run `pnpm build`" | `done` | client uses `import type` only (`skill-stats.ts`, `findings-widget/constants.ts`); build per `state.md:21` | build pre-dates rounds 4–5; a re-build is in progress |
| C3 | "logic in service+repository; route only parses and delegates; `AgentPerformanceService.fromDb`" | `done` | `routes.ts:41-48`; `service.ts` | |
| C4 | "no cross-module import; `db/skill-gates.ts` shared" | `done` | `repository.ts:2` imports `../../db/skill-gates.js`; `arch ✅ no new violation` | |
| C5 | "pure folds in `helpers.ts`, no `Date.now()`, no I/O" | `done` | `helpers.ts:362-440` pure; `arch ✅` | |
| C6 | "probe the zone before any read; 1970 bound from contract" | `done` | `service.ts:63,85`; I15 `skill-stats.it.test.ts:479`; 1970 refine in `agent-performance.ts` | |
| C7 | "route registration on one line up to the path" | `done` | `routes.ts:41,46` | |
| C8 | "DB test is `*.it.test.ts`; `--no-file-parallelism`; read skipped count" | `done` | `skill-stats.it.test.ts`; verify: 181 passed, 0 skipped | |
| C9 | "typecheck does not cover `server/test/`" | `done` | `verify` runs the suites, including the two new test files, green | |
| C10 | "`buildStats` 5th param default `= []`" | `done` | `helpers.ts:239` `breakdown: BreakdownRow[] = []`; test `skill-stats-helpers.test.ts:187` | |
| C11 | "`statsReport()` fixture gains `findings`" | `done` | `client/src/test/agent-performance-fixtures.tsx` (modified); client typecheck 0 errors | |
| C12 | "no migration, schema change or new dependency" | `done` | `git diff --stat` on `package.json`, locks, `server/src/db` empty | |
| C13 | "reuse `usePerfRange`, no second range hook" | `done` | skill `StatsTab.tsx` imports `usePerfRange` | carried |
| C14 | "no React API newer than Next's bundled React" | `done` | no new React API in the changed files; `useId`, `useState`, `dynamic` only | |
| C15 | "`next lint --dir src`; import ≥ 3 levels up through `@/…`" | `done` | `lint ✅ no errors` | |
| C16 | "several Open links: `getAllByRole`" | `done` | `SkillAgentsList.test.tsx`, skill `StatsTab.test.tsx:74` | carried |
| C17 | "test providers carry each namespace" | `done` | client 578 green | carried |
| C18 | "`fireEvent`, no `user-event`" | `done` | no `user-event` import in the new tests | carried |
| C19 | "tooltips in-tree, no portal" | `done` | `PullFreqHint.tsx` is in the card's flow, no portal (`styles.ts:13`) | |
| C20 | "`SkillsListView.test.tsx` routes the fetch mock by URL" | `done` | `SkillsListView.test.tsx:160-222` | carried |
| C21 | "new components in Tailwind; `SkillCard` keeps legacy styles, gains `className="group"`" | `done` | `SkillCard.tsx:~106` `className="group"`; `PullFreqBadge/styles.ts`, `PullFreqHint/styles.ts` | |
| C22 | "never `pnpm build` while `next dev` runs" | `done` | `state.md:21` — `:3000` freed first, user OK `state.md:19` | |
| C23 | "two writers: own your paths" | `done` | `state.md:17,28` — disjoint writers; I ran read-only | |
| C24 | "`verify.mjs` may leave `client/pnpm-workspace.yaml` → delete" | `done` | file absent | |
| C25 | "regex/escape code via Edit/Write, not heredoc" | `cannot verify` | — | a process rule with no observable outcome in the tree; nothing contradicts it |
| C26 | "no commit under `server/src` while a review run is in flight" | `cannot verify` | — | process rule; working tree still uncommitted (`git status`) |

### Done when
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| D1 | "R-27: `diff -r` empty; both packages typecheck" | `done` | outcome checks | |
| D2 | "R-01, R-02, R-04…R-06, R-19, R-48 (server): I1, I2, I4, I5, I12, I19" | `done` | `it.test.ts:298,307,335,343,417,547` pass | |
| D3 | "R-03, R-07…R-10: I3, I6, I7" | `done` | `it.test.ts:329,353,360` | |
| D4 | "R-11…R-16, R-26, R-68 (server): I8, I9, I18" | `done` | `it.test.ts:372,387,537` | |
| D5 | "R-17, R-18, R-20, R-72, R-78: I10, I11" | `done` | `it.test.ts:397,408`; F-22 unit `skill-stats-helpers.test.ts:78` | |
| D6 | "R-21…R-25: I13…I17, I20" | `done` | `it.test.ts:435,444,479,497,524,556` | |
| D7 | "R-28…R-33: C2, C3, C11" | `done` | `RangeCaption.test.tsx`, `page.test.tsx:109`, `usePerfRange.test.tsx` | |
| D8 | "R-34, R-53: C10, C11" | `done` | `SkillEditor.test.tsx`, `page.test.tsx:109`, `lib/skills.test.ts:5` | |
| D9 | "R-35…R-52, R-54, R-55, R-58, R-79…R-81: C4…C6 and I5" | `done` | skill `StatsTab.test.tsx:63-132`, `SkillKpiCards.test.tsx`, `SkillAgentsList.test.tsx`, `it.test.ts:343` | R-54 wrap is CSS-only, not assertable in jsdom |
| D10 | "R-59…R-70: C1, C7" | `done` | `FindingsWidget.test.tsx`, agent `StatsTab.test.tsx` | |
| D11 | "R-71…R-77, R-82, R-83: C8, C9, L4 … hint as accessible description" | `partial` | `SkillCard.test.tsx:108-253`, `SkillsListView.test.tsx:160-222` cover R-71, R-73…R-77 and R-83 | R-82 trigger is narrower than the box says: see R-82 |
| D12 | "R-57: predecessor suites stay green" | `done` | client 578 / server 781 passed, 0 failed | |
| D13 | "R-56: no hard-coded user-facing string (G12)" | `done` | all strings via `useTranslations` (`PullFreqBadge.tsx`, `SkillKpiCards.tsx`, `SkillAgentsList.tsx`, `FindingsWidget.tsx`, `RangeCaption.tsx`) | |
| D14 | "`pnpm arch` no new violation; `pnpm build` green; no lockfile/schema change; browser smoke clean" | `done` | arch ✅; locks/db diff empty; build `state.md:21`; smoke `state.md:22` | build and smoke pre-date rounds 4–5 (SkillCard, `hooks/agents.ts`, `helpers.ts`); main-session re-build pending |

### Verification
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| V1 | "server `verify.mjs --baseline L08-skill-stats --it`; skipped count 0" | `done` | output above | |
| V2 | "client `verify.mjs --baseline L08-skill-stats`" | `done` | output above | |
| V3 | "client `pnpm exec next lint --dir src`" | `done` | `lint ✅ no errors` | |
| V4 | "client `pnpm build` with `:3000` free" | `done` | `state.md:21` (green, `:3000` freed) | graded per state.md; ran before rounds 4–5; re-build pending in main session |
| V5 | "`diff -r` vendor/shared empty" | `done` | identical | |
| V6 | "`git diff --stat -- '*/package.json' '*lock*' server/src/db` empty" | `done` | empty | |
| V7 | "`client/pnpm-workspace.yaml` absent" | `done` | absent | |

### Requirements
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| R-01 | agent uses skill = in workspace + checked + skill on | `done` | `repository.ts:204-219` (`activeSkillOnAgent()` + both workspace checks); I1 | |
| R-02 | current attachment attributes earlier runs | `done` | `repository.ts:221-230`; I2 `it.test.ts:307` | |
| R-03 | counted-run rule (done, in range, local/ci) | `done` | `repository.ts:34-47` `countedRunsWhere`; I3 | |
| R-04 | deleted agent's run never attributed | `done` | `prsWithSkill` inner-joins `agents` (`:270`); I4 `:335` | |
| R-05 | `used_by` = card agent count | `done` | `helpers.ts:404-421`; I1 asserts equality with `GET /skills` `agent_count` | |
| R-06 | `ran_in_period` | `done` | `helpers.ts` `ran_in_period`; I5 | |
| R-07 | denominator = distinct PRs, any agent incl. deleted | `done` | `repository.ts:257-264`; I4, I6 | |
| R-08 | numerator = distinct PRs of using agents | `done` | `repository.ts:266-288`; I6 | |
| R-09 | null-PR runs excluded from both | `done` | `isNotNull(prId)` at `:262,279`; I6 | |
| R-10 | rate = n/d with both counts; null at 0 | `done` | `helpers.ts:394-397` (clamp `min(withSkill, reviewed)`, `rate` null at 0); U2 `skill-stats-helpers.test.ts:65-78`; I7 | re-graded for the F-22 clamp: 0/0 still null, never > 1 |
| R-11 | findings of the attributed counted runs, any kind, by state | `done` | `repository.ts:232-255` | |
| R-12 | findings count = all, any state | `done` | `helpers.ts:362-378` `total`; I8 | |
| R-13 | accept rate accepted÷decided, null at 0 | `done` | `helpers.ts:383-386`; U3 | |
| R-14 | per category + `other` | `done` | `helpers.ts:362-378`; U1; I8 | |
| R-15 | per severity + `other` | `done` | same; U1; I8 | |
| R-16 | single-agent skill = agent stats, field by field | `done` | `skillFigures`=`foldFigures` (`:383`); both reads use `findingStateColumns` (`repository.ts:108`) and `findingBreakdown`; agent read via breakdown (`service.ts:41-52`); I9 `:387` | re-graded after F-11/F-13: both go through one fold and one SQL text |
| R-17 | answers echo the applied range | `done` | `appliedRange(range)` in both builders; I10 | |
| R-18 | pull-freq read = stats read per skill | `done` | both call `reviewedPrCount`+`prsWithSkill` and the same `pullFrequency()` (`helpers.ts:394,404,428`); I11 `:408` deep-equal | re-graded for F-22: the clamp is inside the shared `pullFrequency`, so both agree |
| R-19 | stats read returns figures and agent list | `done` | `routes.ts:46`; I12 | |
| R-20 | one entry per skill, one response | `done` | `service.ts:84-91`, `listSkillIds` order name,id; I12 | |
| R-21 | unknown or foreign skill → 404 | `done` | `service.ts:~75` `NotFoundError('Skill not found')`; I13 `it.test.ts:435` | after F-07 the 404 comes after the parallel stage; foreign skill reads nothing (both workspace checks) |
| R-22 | missing/garbled range, from≥to, pre-1970 → 422 before computing | `done` | `agent-performance.ts` refines (from<to, 1970 bound); I14 `:444`; F-02 `:461` | re-graded: F-02 added `to ≤ 9999-12-31T23:59:59.999Z` (`MAX_WINDOW_END_MS`, `agent-performance.ts:23`), both copies identical. Stricter than R-22 states, no conflict |
| R-23 | unknown Postgres tz → 422, also empty range | `done` | probe first `service.ts:63,85`; I15 `:479` | |
| R-24 | stored rows only; no writes | `done` | repository read-only; I16 `:497` | |
| R-25 | no cross-workspace counting | `done` | workspace on `agents`, `skills`, `reviews`; I17 `:524` | |
| R-26 | agent stats also return findings per category/severity | `done` | `helpers.ts:249-252` (`win === 'current'` filter), `service.ts:52`; I18 `:537` | re-graded: breakdown read over `both` windows once (F-11); current window folded |
| R-27 | shapes in `@devdigest/shared`, byte-identical | `done` | `diff -r` empty; typechecks green | |
| R-28 | skill tab offers the agent range control | `done` | skill `StatsTab.tsx` `usePerfRange` + `RangeControl` | carried |
| R-29 | range stored in address, keeps skill and tab | `done` | `usePerfRange`; `skillEditorHref`; `page.test.tsx:109`, StatsTab test `:74` | |
| R-30 | latest range wins | `done` | per-range key `skill-stats.ts:18`; test `skill-stats.test.tsx:47` | key now under `["skills",…]` (F-06) |
| R-31 | caption: preset and custom | `done` | `RangeCaption.tsx`; `perf-range.ts:273-286`; messages `range.caption.*` | carried |
| R-32 | same caption on agent tab and dashboard | `done` | `StatsTab.tsx:46`, `AgentPerformanceView.tsx:55` | |
| R-33 | caption from the response range | `done` | `RangeCaption applied={q.isError ? undefined : q.data?.range}` | |
| R-34 | Stats tab between Preview and Versions, `?tab=stats` | `done` | `SkillEditor/constants.ts` TABS order; `SkillEditor.test.tsx` | |
| R-35 | four KPI cards | `done` | `SkillKpiCards.tsx` | carried |
| R-36 | "<N> agents" / "<M> ran in period" | `done` | `SkillKpiCards.tsx`; `stats.kpi.usedByValue`, `ranInPeriod` | |
| R-37 | "<p>% (<n>/<d> PRs)" + "PRs reviewed in the period" | `done` | `skills.json` `pullFreqValue`, `pullFreqCaption`; `SkillKpiCards.tsx` | |
| R-38 | unknown → "—" + "No reviewed PRs in <range>" | `done` | `SkillKpiCards.tsx` (`ratePercent` null branch) | |
| R-39 | accept rate text via `AcceptRateValue` | `done` | `SkillKpiCards.tsx` `AcceptRateValue variant="kpi"` | |
| R-40 | "Small sample" for <5 decided | `done` | `AcceptRateValue` reused (D-12) | carried |
| R-41 | Findings card = `findings.total` | `done` | `SkillKpiCards.tsx` `report.findings.total` | |
| R-42 | agent rows sorted by name | `done` | `usingAgents` `orderBy(name,id)` (`repository.ts:218`); `SkillAgentsList` keeps order; I12 | |
| R-43 | Open → agent Stats tab, same applied range | `done` | `SkillAgentsList.tsx` `statsHref(a.id, choice, applied)`; `perf-range.ts:172-177` pins preset end | |
| R-44 | link name "Open <name>" | `done` | `SkillAgentsList.tsx` `aria-label={stats.agents.openLabel}` | |
| R-45 | "Disabled" badge | `done` | `SkillAgentsList.tsx` | |
| R-46 | empty list text | `done` | `stats.agents.none`, `noneHint` | |
| R-47 | widget on skill tab | `done` | `StatsTab.tsx` `FindingsWidget findings={report.findings}` | |
| R-48 | off-skill note | `done` | `StatsTab.tsx` `!report.skill.enabled` → `stats.offNote`; refreshes on skill toggle (F-06, `skill-stats.test.tsx:105`) | |
| R-49 | zero-run range keeps cards and list | `done` | `StatsTab.test.tsx:97` | |
| R-50 | skeletons, no digits while loading | `done` | `StatsSkeleton`; `StatsTab.test.tsx:63` | |
| R-51 | error + Retry, no figure | `done` | `StatsTab.tsx` `ErrorState onRetry`; test `:119` | |
| R-52 | only read requests | `done` | `useSkillStats` and `useSkillsPullFrequency` use `api.get` only (`skill-stats.ts:36,76`); `StatsTab.test.tsx:74` | re-graded: still GET-only after the 404 invalidation, which is a client cache action and not a request |
| R-53 | rail click keeps tab and range | `done` | `page.tsx` rail `onClick` → `skillEditorHref(sk.id, tab, search)`; `page.test.tsx:109` | |
| R-54 | wrap / stack on narrow | `done` | `cx.kpiGrid` auto-fit, `cx.columns` `grid-cols-1 lg:grid-cols-2` (`StatsTab/styles.ts`) | CSS-only; jsdom cannot assert |
| R-55 | keyboard-operable controls | `done` | native `Link`, `RangeControl` buttons/inputs | carried |
| R-56 | strings from message files | `done` | see D13 | |
| R-57 | agent tab and dashboard as shipped except caption/widget | `done` | predecessor suites green | |
| R-58 | skill gone → editor's not-found state | `done` | `skill-stats.ts:36-41` (404 → `invalidateQueries(["skill", id])`, no retry `:23-25`); `useSkill` no retry on 404 (`hooks/skills.ts:30`); not-found `ErrorState` `page.tsx:51-62`; tests `StatsTab.test.tsx:132`, `skill-stats.test.tsx:68,128` | re-graded: chain built from three tested links. No test drives the whole page from a stats 404 to the not-found state, and the browser smoke did not cover it |
| R-59 | one widget component on both tabs | `done` | both import `@/components/findings-widget` | |
| R-60 | donut with total in centre | `done` | `CategoryDonut.tsx` | carried |
| R-61 | legend order + zeros + `other` only >0 | `done` | `helpers.ts:25-29` | |
| R-62 | per-entry whole percent | `done` | `helpers.ts:21-23` | |
| R-63 | severity row, zeros, house colours/icons | `done` | `FindingsWidget.tsx` `SEV[...]`; `helpers.ts:32-36` | |
| R-64 | "Small sample" for 1–4 | `done` | `helpers.ts:40-42`, `SMALL_SAMPLE_FINDINGS=5` | |
| R-65 | empty state "No findings in <range>" | `done` | `FindingsWidget.tsx` `total === 0` → `emptyLabel` only | |
| R-66 | `role="img"` "Findings by category", values as text | `done` | `CategoryDonut.tsx:33`; legend `entry` text | |
| R-67 | fixed category colours | `done` | `constants.ts` `CATEGORY_COLOR` | |
| R-68 | widget total = Findings card / accepted+dismissed+pending | `done` | both read `findings.total`; server I9/I18 | |
| R-69 | widget below tiles, above note | `done` | `agents/.../StatsTab.tsx:116` | carried |
| R-70 | no extra request | `done` | no query in `findings-widget/` | |
| R-71 | card "<N> agents · <p>% pull freq" in grid and rail | `done` | `PullFreqBadge.tsx`; `SkillsListView.tsx:96`, `page.tsx` rail; `SkillCard.test.tsx:108`, `page.test.tsx:118` | |
| R-72 | card figure by R-07…R-10 | `done` | shared `reviewedPrCount`/`prsWithSkill`/`pullFrequency` | |
| R-73 | 30×24 h window ending when the page loads | `done` | `lastThirtyDays(new Date())` in the queryFn (`skill-stats.ts:~78`); test `skill-stats.test.tsx:77` | re-graded: the window now ends at first load of the skills pages and is refreshed by a skill write, a reload, or cache expiry (F-04). The shift was accepted by the user (`state.md:15`), so graded `done` |
| R-74 | one read for all cards | `done` | one `useSkillsPullFrequency()` per page (`page.tsx`, `SkillsListView.tsx:29`); tests `SkillsListView.test.tsx:160,203`, `page.test.tsx:118`; smoke `state.md:22` | |
| R-75 | unknown → "— pull freq" | `done` | `PullFreqBadge.tsx` `pullFreqUnknown`; `SkillCard.test.tsx:206` | |
| R-76 | loading → count + placeholder, no "0%" | `done` | `PullFreqBadge.tsx` placeholder; `SkillCard.test.tsx:212` | |
| R-77 | failure → count only | `done` | `PullFreqBadge.tsx`; `toCardPullFreq` `helpers.ts:33-42`; `SkillsListView.test.tsx:187` | re-graded for F-24: a failed background refetch no longer overrides cached data (`helpers.test.ts`) |
| R-78 | card = Stats tab for "30 days" at the same moment | `done` | shared builders; I11 | |
| R-79 | runs per agent, 0 included | `done` | `helpers.ts` `runsById.get(a.id) ?? 0`; I5 | |
| R-80 | "<n> runs" on each row | `done` | `SkillAgentsList.tsx` `stats.agents.runs` | |
| R-81 | attribution note | `done` | `StatsTab.tsx` `stats.attributionNote` (text verbatim in `skills.json`) | |
| R-82 | hint on pointer over / focus on a card showing a pull frequency | `partial` | `PullFreqHint/styles.ts:21` (visible via `group-has-[[data-pull-freq-badge]:hover]`, `hover:visible`, `group-focus-visible`); `PullFreqHint.tsx`; `SkillCard.test.tsx:120` | exists: the hint text, keyboard focus of the card root, Esc dismissal (`SkillCard.tsx:92`), hover on the badge. Missing: hovering the rest of the card does not show it, and the focus trigger is `focus-visible` on the root only. R-82 says "over … a skill card". F-18 narrowed the trigger to the badge, and the ledger shows no explicit user ruling on that narrowing. Either amend R-82 or widen the trigger |
| R-83 | hint is the AT description of the card's pull-frequency text | `done` | `SkillCard.tsx:~101` card root `aria-describedby={showHint ? hintId : undefined}`, hint `aria-hidden` (`PullFreqHint.tsx`); `SkillCard.test.tsx:108` | re-graded: description is on the card button, not on the text node (plan D-11 had both). Dropped for F-05, since it would read twice. Outcome met |

## Deviations observed
| Item | The plan said | The code does | Outcome still met? |
|---|---|---|---|
| S5 / D-8 | probe → getSkill → usingAgents → Promise.all(4) | probe → `Promise.all(getSkill, usingAgents, reviewedPrCount, prsWithSkill)`, then 404, then per-agent reads (F-07, `service.ts:62-77`) | yes |
| S5 / D-5 | `agentStats` adds a current-window `findingBreakdown` beside `findingTallies` | one `findingBreakdown(…,'both')` serves as tallies and breakdown (F-11, `service.ts:41-52`) | yes; R-16/R-26 equality tested |
| S10 / D-11 | key `['skills-pull-frequency', from, to, tz]`, window in a mount-time `useState` | key `["skills","pull-frequency",tz]`, window taken in the queryFn, `staleTime: Infinity` (F-04, F-06) | yes; R-73 wording shifted, user-accepted `state.md:15` |
| S18 / D-11 | hint `hidden group-hover:flex group-focus-within:flex`, describedby on text and root | in-flow, always-reserved line shown on badge hover or card focus-visible; describedby on root only; `reserveOnly` band while loading or failed (F-05, F-18, F-19, F-20) | outcome for R-83 yes; R-82 `partial` |
| S18 | `CardPullFreq` in `SkillCard/helpers.ts` | declared in `PullFreqBadge.tsx:23` (F-01) | yes |
| S9 / S10 | `pullFreqPercent` helper | removed; shared `ratePercent` in `perf-format.ts:20` (F-12) | yes |
| K2 / D-3 | `PerfRangeQuery` reused verbatim; `rate: number().nullable()` | `to ≤ 9999-12-31T23:59:59.999Z` refine added (F-02); `rate` `.min(0).max(1)` (F-03) | yes |
| S3 / F-22 | `pullFrequency` = plain `withSkill/reviewed` | numerator clamped to `min(withSkill, reviewed)` (`helpers.ts:394-397`) | yes; the read race is hidden, not removed, as the ledger says |
| S16 | static StatsTab import | `next/dynamic` (`SkillEditor.tsx:23`, F-09) | yes |

## Changed outside the plan
| File | No item asked for it | In the plan's `Not in scope`? |
|---|---|---|
| `client/src/lib/hooks/agents.ts`, `client/src/lib/hooks/agents.test.tsx` (new) | F-16 / F-23 invalidation of `["skills"]` and `["skill"]` (user-approved `state.md:15`) | no |
| `client/src/lib/hooks/skills.ts` | F-08 `useSkill` no retry on 404 | no |
| `client/src/lib/perf-format.ts`, `perf-format.test.ts` | F-12 `ratePercent` | no |
| `client/INSIGHTS.md`, `server/INSIGHTS.md` | not in `Touches` (insights filing) | no |
| `.claude/agents/architecture-reviewer.md`, `.claude/settings.json` | tooling edits, not in `Touches`. They were already modified at the session's `gitStatus` snapshot and are probably earlier retro work | no |

None of the plan's "Not touched" paths changed: `git status` shows no change in `reviewer-core`, `mcp`, `e2e`, `vendor/ui`, `server/src/db`, `platform`, `modules/agents`, `modules/skills`, `modules/index`, or the known-violations file.

## Not graded in this pass
None. The final pass without a gap report covers every item.

## Summary
done 148 · partial 2 · not implemented 0 · contradicted 0 · cannot verify 2 (C25, C26; process rules, not observable)

The two partials are D11, which is R-82's trigger scope, and R-82 itself. The tally above counts 148 + 2 + 2 = 152; the missing one is C25/C26 listed above as two items, so the exact figures are: done 149, partial 2, cannot verify 2. Rows total 153 with the R-83 `done` counted once.

**Verdict:** incomplete. The only open gap is R-82. The hint shows on the pull-frequency badge's hover and on the card root's keyboard focus, but not when the pointer is over the rest of the card, as the requirement text says. The F-18 ledger shows no explicit user ruling on narrowing it. Fix the trigger or amend R-82. Everything else is `done`, and the server and client suites are green with 0 new failures.

## Noticed, not my call
- `pnpm build` and the browser smoke are graded from `state.md:21-22`, which pre-date rounds 4–5 (`SkillCard/**`, `hooks/agents.ts`, `helpers.ts`). The main-session re-build should confirm them (owner: main session).
- R-58 has no test that drives the whole page from a stats 404 to the not-found state, only three tested links of the chain (owner: `test-writer`).

---

## Findings ledger

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | SUGGESTION | `client/src/app/skills/_components/SkillCard/_components/PullFreqBadge/PullFreqBadge.tsx:17` | child imports `CardPullFreq` type from parent's `helpers.ts` (type-only cycle in route-private folder) | fixed | `CardPullFreq` declared in `PullFreqBadge.tsx:23`, parent imports it (parent → child only) |
| F-02 | 1 | security lens | WARNING | `{server,client}/src/vendor/shared/contracts/agent-performance.ts:29-41` (`PerfRangeQuery`), `repository.ts:238-266` | no upper bound on `to`: `to=9999-12-31T23:59:59-14:00` normalises to `+010000-…Z` → pg16 `time zone displacement out of range` → 500 (raw DB text) instead of 422; reproduced live on `/skills/pull-frequency` and `/agents/performance`. Mirror of the 1970 bound. Fix: refine `to ≤ 9999-12-31T23:59:59.999Z` + test. conf HIGH | fixed | contract refine `to ≤ 9999-12-31T23:59:59.999Z` (`MAX_WINDOW_END_MS`, both copies, `agent-performance.ts:23,48`); it.test `skill-stats.it.test.ts:461` 422 on all 4 range routes, boundary 200 (UTC, +14) |
| F-03 | 1 | security lens | SUGGESTION | `contracts/skill-stats.ts:20` | `PullFrequency.rate` not bounded 0..1 in the response schema (defence in depth) | fixed | `PullFrequency.rate` min(0).max(1) both copies (`skill-stats.ts:20`) |
| F-04 | 1 | frontend lens + code-review | WARNING | `client/src/lib/hooks/skill-stats.ts:59`, `client/src/app/skills/[id]/page.tsx:36,112` | `mountedAt` in page state; App Router remounts `/skills/[id]` on every rail click → new key → new `GET /skills/pull-frequency` + every card back to placeholder (5 clicks = 5 GETs, % may jump). Fix: window out of the key / anchor above the page / `keepPreviousData` for this query | fixed | key `["skills","pull-frequency",tz]` (`skill-stats.ts:22`), window taken in queryFn, staleTime Infinity; remount tests with real unmount/remount (fail on old code). R-73 semantic shift → user |
| F-05 | 1 | frontend lens | WARNING | `…/PullFreqBadge/PullFreqBadge.tsx:47,61`, `styles.ts:7`, `SkillCard.tsx:94` | tooltip text joins the `role="button"` name on focus AND is its description → read twice; not dismissible/hoverable (WCAG 1.4.13); inner `aria-describedby` inert; clipped in rail `overflow:auto`. Fix: `aria-hidden` on tooltip span, drop inner describedby, Esc to close | fixed | new `PullFreqHint` span aria-hidden, only card-root `aria-describedby` (`SkillCard.tsx:101`); Esc dismisses (`:92`); hoverable; overlays inside the card (no rail clipping) |
| F-06 | 1 | code-review | WARNING | `client/src/lib/hooks/skill-stats.ts:14-18`, `client/src/lib/hooks/skills.ts:52,68,87,125` | keys `["skill-stats",…]` / `["skills-pull-frequency",…]` not under `["skills"]` → skill toggle/create/delete does not invalidate them: card shows "0 agents · 100% pull freq", Stats tab keeps stale enabled/used_by, R-48 note missing until remount. conf high | fixed | both keys under `["skills",…]` (`skill-stats.ts:18,22`) → existing `invalidateQueries(["skills"])` refreshes them; tests with real `useUpdateSkill` and toggle |
| F-07 | 1 | frontend lens + code-review | SUGGESTION | `server/src/modules/agent-performance/service.ts:59-70` | `skillStats` runs probe → getSkill → usingAgents serially before the parallel stage; `getSkill`/`usingAgents`/`reviewedPrCount`/`prsWithSkill` could overlap | fixed | `service.ts:62-77` getSkill+usingAgents+reviewedPrCount+prsWithSkill in one Promise.all after the probe; 404 after it |
| F-08 | 1 | frontend lens | SUGGESTION | `client/src/lib/hooks/skill-stats.ts:43`, `client/src/lib/hooks/skills.ts:23-28` | on 404 the not-found state appears ~1 s late (`useSkill` inherits retry 1) | fixed | `useSkill` no retry on 404 (`lib/hooks/skills.ts:30`); test 1 fetch |
| F-09 | 1 | frontend lens | SUGGESTION | `client/src/app/skills/[id]/_components/SkillEditor/SkillEditor.tsx:15` | StatsTab (recharts) imported statically into the editor chunk; `next/dynamic` (check bundle first — vendor/ui barrel may already pull recharts) | fixed | `next/dynamic` for skill StatsTab (`SkillEditor.tsx:23`) with Skeleton; gain to confirm at build |
| F-10 | 1 | frontend lens | SUGGESTION | `server/src/modules/agent-performance/repository.ts:238,247` | no `(workspace_id, status, ran_at)` index; now on every Skills-page load | accepted | REC-3 / predecessor F-04: no migrations |
| F-11 | 1 | code-review | SUGGESTION | `server/src/modules/agent-performance/service.ts:48` | `agentStats` reads findings twice (`findingTallies` + `findingBreakdown`); tallies derivable from breakdown rows | fixed | agentStats reads findingBreakdown once (`both` windows) and passes rows as tallies + breakdown; dashboard keeps findingTallies (same CTE + state columns); new unit equality case |
| F-12 | 1 | code-review | SUGGESTION | `client/src/lib/skills.ts:52` | `pullFreqPercent` duplicates `acceptPercent` (`perf-format.ts:16`) without the NaN guard | fixed | one `ratePercent` (`perf-format.ts:20`, NaN-safe), `acceptPercent` aliases it; `pullFreqPercent` removed |
| F-13 | 1 | code-review | SUGGESTION | `server/src/modules/agent-performance/helpers.ts:380` | `skillFigures` re-implements the accepted/dismissed/decided/accept_rate fold of `foldFigures` — "one rule" (D-6/R-16) now lives in two loops | fixed | `skillFigures` = `foldFigures([], rows)` pick (`helpers.ts:383-386`) |
| F-14 | 1 | code-review | SUGGESTION | `server/src/modules/agent-performance/helpers.ts:411-412` | redundant `own` filter (rows already limited by `inArray(agentId)`) | fixed | `own` filter removed (`helpers.ts:398-416`); unit case updated |
| F-15 | 1 | code-review | SUGGESTION | `client/messages/en/skills.json:51` | dead key `listItem.agentCount` | fixed | key removed from `messages/en/skills.json` |
| F-16 | 2 | implementer (client, reported) | WARNING | `client/src/lib/hooks/agents.ts` (`useSetAgentSkills`) | pre-existing: attaching/detaching a skill on an agent does not invalidate `["skills"]` → `agent_count`, Used by, skill Stats and card pull freq stay stale until reload; matters now because figures use the current attachment. User: fix in this run | fixed | `agents.ts:139-140` `useSetAgentSkills` also invalidates `["skills"]` and `["skill"]` (editor Used by badge); new `agents.test.tsx` (fails without the fix) |
| F-17 | 2 | frontend lens | SUGGESTION | `client/src/app/skills/_components/SkillCard/SkillCard.tsx:89` | `onBlur` (focusout bubbles) resets `hintDismissed` when focus moves to the card's Toggle/delete → hint reappears after Esc. Fix: ignore blur when `relatedTarget` is inside the card | fixed | `SkillCard.tsx:97-102` blur ignored when relatedTarget inside the card; test `SkillCard.test.tsx:168` |
| F-18 | 2 | frontend lens | SUGGESTION | `client/src/app/skills/_components/SkillCard/_components/PullFreqHint/styles.ts:8` | hint overlays the card description on every hover (`group-hover`), mouse users cannot read the description; only Esc dismisses. Options: anchor to the badge row / show on badge hover only | fixed | hint in normal flow after the badge row; shows on badge hover (`:has`), own hover, card focus-visible; never covers description, not clipped; test `SkillCard.test.tsx:120` |
| F-19 | 3 | frontend lens | SUGGESTION | `client/src/app/skills/_components/SkillCard/_components/PullFreqHint/styles.ts:13`, `SkillsListView/styles.ts:37` | in-flow hint (`hidden`→`block`) makes the hovered card one line taller → grid row stretches, rows below / rail cards below shift ~30 px when sweeping badges. Options: reserve the line (visibility + fixed height), or `align-items:start` | fixed | `PullFreqHint/styles.ts` always laid out (`invisible block`), only visibility toggles; dismissed = invisible; tests updated; client 570 green |
| F-20 | 4 | frontend lens | SUGGESTION | `client/src/app/skills/_components/SkillCard/SkillCard.tsx:156` | reserved hint band rendered only when pull frequency is `ready` → every card grows once ~100 ms after first paint (first visit only; cached afterwards). Fix: reserve the band whenever `pullFrequency` is given | fixed | `SkillCard.tsx:156-159` band rendered whenever `pullFrequency` is passed; `reserveOnly` (no id, never visible, aria-hidden, static hint text for exact height); describedby only when ready; client 572 green |
| F-21 | 4 | frontend lens | SUGGESTION | `…/PullFreqHint/styles.ts` | cost of F-19: permanent blank band (~45–60 px in the narrow rail) under every card's badge row; rail shows fewer cards. Alternative: hint only on keyboard focus + native `title` on the badge | wontfix | user: accepted cost of F-19 |
| F-22 | 5 | pr-self-review (code-review) | WARNING | `server/src/modules/agent-performance/service.ts:65-70,89-93`, `helpers.ts:389-390`, `contracts/skill-stats.ts:20` | numerator (`prsWithSkill`) and denominator (`reviewedPrCount`) are separate statements; a run turning `done` between them gives `rate > 1` → response schema `.max(1)` (F-03) → 500 on `/skills/pull-frequency` / `/skills/:id/stats`. Fix: one SQL statement or clamp `min(withSkill, reviewed)`. conf medium | fixed | `helpers.ts:388-397` clamp `prs_with_skill = min(withSkill, reviewed)` → rate ≤ 1, counts consistent; unit tests both builders; race hidden not removed (single-snapshot read out of scope) |
| F-23 | 5 | pr-self-review (code-review) | WARNING | `client/src/lib/hooks/agents.ts:80-88` (`useDeleteAgent`) + `skill-stats.ts:75` (staleTime Infinity) | deleting an agent does not invalidate `["skills"]` → cards show new `agent_count` with stale pull freq until a skill write / reload. Fix: invalidate `["skills"]` (and `["skill"]`) in useDeleteAgent (+ useCreateAgent if it attaches skills). conf medium-high | fixed | `useDeleteAgent` invalidates `["skills"]`+`["skill"]` (`agents.ts:97-98`); create cannot attach skills (no change); test added |
| F-24 | 5 | pr-self-review (code-review) | WARNING | `client/src/app/skills/_components/SkillCard/helpers.ts:27-30` (`toCardPullFreq`) | `isError` checked before `data`: a failed background refetch (after any skill write) turns every card's cached "· P% pull freq" into the error state though data is cached; new skill missing from data → no reserved band (F-20 remnant). conf medium | fixed | `toCardPullFreq` prefers cached data (`helpers.ts:35-42`); missing skill → `error` (count only, reserved band); new `helpers.test.ts` |
