## /run-plan L08-agent-performance — done
Plan `specs/L08-agent-performance.md` (rev 3) · Requirements `specs/L08-agent-performance.requirements.md` (R-01…R-112) · Branch `lesson/L08-homework` · Fix rounds: 3 (round 3 = a small late round on a fresh implementer)

Run shape: phase 0+1a (baselines, contract) → server ∥ client implementers on disjoint paths (tests included, no `--test-writer`) → review (plan-verifier ∥ architecture-reviewer ∥ frontend lens + perf rubric) → fix 1 → re-review → browser smoke + in-place `pnpm build` → `/pr-self-review` (gates + security/zod/fastify/drizzle lens + `/code-review high`) → fix 2 → re-review → fix 3 (tz probe) → re-review → smoke 2 + clean build → gates re-run → final plan-verifier. No `--docs`: `doc-writer` (plan phase 6) not run.

## Findings
15 total · fixed 14 · accepted 1 · wontfix 0 · open 0 — `.devdigest/cache/sdd/L08-agent-performance/findings.md` (copied below)

Accepted (goes into the PR description):
- F-04 — no `agent_runs (workspace_id, status, ran_at)` index; the previous window doubles the scanned span. Recorded decision REC-2: no migrations in this change.

## Verification
Last outputs (final plan-verifier pass, after fix round 3):
```
verify server · baseline L08-agent-performance @ 9d50b3d
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 766 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 160 passed · 0 failed (0 baseline, 0 new) · 0 skipped

verify client · baseline L08-agent-performance @ 9d50b3d
  typecheck   ✅ 0 errors
  lint        ✅ no errors
  tests       ✅ 525 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
- `pnpm build` in `client/` with :3000 free, `.next` wiped: `✓ Compiled successfully`, `✓ Generating static pages (8/8)`, `/agent-performance 104 kB / 305 kB`, exit 0.
- `/pr-self-review` gates G1–G12: CRITICAL 0 · WARNING 0 · SUGGESTION 0; verdict `approve` (`.devdigest/cache/pr-self-review/last-run.json`).
- `diff -r server/src/vendor/shared client/src/vendor/shared`: empty. No `package.json`, lockfile, schema or migration change.
- Browser smoke (claude-in-chrome, live seeded data): `/agent-performance` 30d / 1d (empty state) / sort / expand; Stats tab of General Reviewer matches its dashboard row (7 runs, $0.088, $0.015, 128.6s, "3 days ago"); custom range validation and DST-correct bounds; PR #32 page with the moved HoverNote; agent switch on Stats keeps a custom range; live API returns 422 for `tz=+05`, `tz=US/Pacific-New`, year `0000`. Network: one GET per range change, none on sort/expand, GET only. Console: no route error, no error-boundary output.

## Not verified
- V8 (partial) — light and dark theme look of both screens. Settles by: open `/agent-performance` and `/agents/:id?tab=stats`, toggle the theme, check band colours and donut legends stay legible.
- D13 / R-85 (cannot verify) — keyboard-only walk. Settles by: Tab through range control, date inputs, sortable headers, expand buttons and View links with no mouse; every control reachable and operable, focus visible.
- C21, C24 (cannot verify) — process rules (two writers kept to their paths; no commit during review). Settled by the run log: no git write happened during the run, streams reported disjoint changed-file lists.

## Next
Commit? Nothing blocks it. `.claude/settings.json` (the user's own `ENABLE_TOOL_SEARCH` change) is unrelated and should not ride in the feature commit.

---

## Final plan-verifier report (verbatim)

## Plan
`specs/L08-agent-performance.md` (rev 3) + `specs/L08-agent-performance.requirements.md` — **FINAL pass (phase 5)**, slug `L08-agent-performance`, **183 items** extracted: 24 steps · 0 contract table rows (the `## Contract` block is a code block; it is graded through step 1 and R-31) · 24 constraints · 15 `Done when` boxes · 8 verification commands · 112 task requirements (R-01…R-112).

Pass scope: every item that was not `done` in iteration 1 (R-42, R-85, D6, D7, D11, D13, D15) was re-graded. Every R-ID and constraint touched by fix rounds F-01…F-15 was re-graded with fresh evidence. All others are marked "carried" from iteration 1. The `Decisions` of both files were read first (D-1…D-28; Q-01…Q-11). Nothing in them is graded as a gap.

## Outcome checks (run in this pass, from inside each package)

```
verify server · baseline L08-agent-performance @ 9d50b3d
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 766 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 160 passed · 0 failed (0 baseline, 0 new) · 0 skipped

verify client · baseline L08-agent-performance @ 9d50b3d
  typecheck   ✅ 0 errors
  lint        ✅ no errors
  tests       ✅ 525 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
- `diff -r server/src/vendor/shared client/src/vendor/shared` → empty (printed `DIFF-EMPTY`).
- `git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty. `client/pnpm-workspace.yaml` is absent.
- `pnpm typecheck` does not cover `server/test/`. I ran a scratch tsconfig from the scratchpad over `server/test/agent-performance-helpers.test.ts` and `server/test/agent-performance.it.test.ts`. `tsc` printed nothing, so 0 errors.
- Browser smoke and in-place `pnpm build`: taken from `.devdigest/cache/sdd/L08-agent-performance/state.md:14` (build green with :3000 free, `/agent-performance` and `/agents/:id?tab=stats` checked) and `state.md:18` (second smoke, clean in-place build). I did not re-run them.
- No baseline failures occurred.

## Per-item verdicts

Legend for the Evidence column. "carried" = iteration-1 `done`, not re-examined. "re-graded" = re-checked this pass. Test names are in `server/test/agent-performance.it.test.ts` (`.it`), `server/test/agent-performance-helpers.test.ts` (`.unit`) and the client `*.test.tsx` beside each component.

### Steps 1–24
| # | Item (plan `## Steps`) | Verdict | Evidence | Note |
|---|---|---|---|---|
| 1 | "Contract step 1 — both copies, index export + header line, @deprecated comments" | `done` | `server/src/vendor/shared/contracts/agent-performance.ts:1-75` = client copy (`diff -r` empty); `vendor/shared/index.ts:11,28`; `observability.ts:96`; `productionize.ts:173-176` (F-07, one block, both copies) | re-graded. Contract differs from the plan block, see Deviations |
| 2 | "constants.ts, types.ts" | `done` | `server/src/modules/agent-performance/constants.ts` (`COUNTED_RUN_STATUS`, `BUCKET_SQL`), `types.ts`; `repository.ts:5` imports them | carried |
| 3 | "helpers.ts (new, pure)" | `done` | `helpers.ts:27` `previousWindow`, `:44` `acceptRate`, `:78` `foldFigures`, `:128` `foldModelCosts`, `:148` `roundCostDelta`, `:157` `compare`, `:183` `pickMostActive`, `:218` `buildStats`, `:238` `buildDashboard` | re-graded (F-11 rounding) |
| 4 | "repository.ts (new)" | `done` | `repository.ts:31-36` `countedRunsWhere`, `:48` `win` case, `:63` `runGroups`, `:86` `findingTallies` (join checks `reviews.workspaceId` `:99`), `:104-116` `runBuckets` with bound `tz`, `:134` `assertTimeZoneKnown`, `:138,146` `listAgents`/`getAgent` | re-graded. No `sql.raw` is used (bound `::text`), stricter than the plan |
| 5 | "service.ts (new)" | `done` | `service.ts:21-23` `fromDb`; `:25-35` `dashboard` runs `Promise.all([listAgents, runGroups, findingTallies, runBuckets])`; `:37-50` `agentStats` runs `getAgent` → `NotFoundError` first | re-graded (F-01, F-09) |
| 6 | "routes.ts (new), modules/index.ts" | `done` | `routes.ts:23` `AgentPerformanceService.fromDb`; `:25`, `:30` one-line registrations; `modules/index.ts` diff: import + registry entry; `pnpm arch` ✅ | re-graded. Deviation: the route no longer `new`s the repository (F-01) |
| 7 | "perf-range.ts, perf-format.ts (new, pure)" | `done` | `lib/perf-range.ts:43,81,95,100,118,143,172,181,190,222`; `lib/perf-format.ts:8-90` | re-graded (F-08 bounds `:55-60,105`; F-11 `isCostUnchanged` `:80`) |
| 8 | "perf-colors.ts (new, pure)" | `done` | `lib/perf-colors.ts:13` `AGENT_PALETTE`, `:25,27`, `:30` `fnv1a`, `:44` `agentColor`, `:49` `modelColor` | carried |
| 9 | "hooks/agent-performance.ts (new)" | `done` | `lib/hooks/agent-performance.ts:26-29` keys, `:33` `useAgentPerformance`, `:44` `useAgentStats` (`bucket=day`, `enabled`); no `placeholderData` | carried |
| 10 | "move HoverNote → components/hover-note; BriefHeader import" | `done` | `client/src/components/hover-note/{HoverNote,index,styles}`; old folder deleted in `git status`; `BriefHeader.tsx` modified; PR #32 page checked in smoke (`state.md:14`) | carried |
| 11 | "perf-range-control (RangeControl, usePerfRange, constants, styles, index)" | `done` | `RangeControl.tsx:45-54` draft reset on applied-key change (F-12), `aria-pressed` on 3 buttons, date inputs `min`/`max`; `usePerfRange.ts:24-80` bounded apply-time map (F-02, F-14); `apply` copies existing search params so `tab` survives | re-graded |
| 12 | "accept-rate-value, last-run-time, cost-estimate-note, cost-delta" | `done` | `AcceptRateValue.tsx` (band, denominator, "Small sample", `Trend`); `CostDelta.tsx` (null → nothing; unchanged → "No estimate difference vs previous period"); `LastRunTime.tsx:15` `useNow` | re-graded (F-11, F-15 `lib/now-tick.ts`) |
| 13 | "messages/en/agentPerformance.json (replace whole)" | `done` | `messages/en/agentPerformance.json:3,31-33,46-47,58-65,81,86-90,95` | carried |
| 14 | "agent-performance/page.tsx + AgentPerformanceView" | `done` | `page.tsx` (Suspense); `AgentPerformanceView.tsx:37-55` header in every state, error → `ErrorState`+Retry, skeleton while no data; `Dashboard` `:70-88` | carried |
| 15 | "PerfKpiCards (+ AcceptRing)" | `done` | `PerfKpiCards.tsx:44` `useMemo` (F-03), `:57-59` sparkline label per `bucket_unit`, `:65-68` `CostDelta`, `:75-78` ring only when `pct !== null`, `:130-150` banded Most-active | re-graded |
| 16 | "AgentPerfTable (+ AgentPerfRowView, helpers.ts, constants.ts)" | `done` | `AgentPerfTable.tsx:36-37,61,88`; `constants.ts:4` initial sort accept/desc; `AgentPerfRowView.tsx:46,53,54-66,74,81` | carried |
| 17 | "CostBreakdown (+ CostDonut)" | `done` | `CostBreakdown.tsx:22-23`; `CostDonut.tsx:24,36,48-50`; `helpers.ts:15,25` | carried |
| 18 | "AgentEditor constants/AgentEditor/page VALID_TABS/StatsTab" | `done` | `AgentEditor/constants.ts:23`; `AgentEditor.tsx:37`; `page.tsx:19` `VALID_TABS`; `page.tsx:37,116` use `agentEditorHref` (F-13, `lib/agents.ts`); `StatsTab.tsx:29-105` | re-graded |
| 19 | "nav.ts — GLOBAL group, header comment" | `done` | `client/src/vendor/ui/nav.ts` diff: GLOBAL section + comment line; `nav-global.test.tsx:22,30` | re-graded (F-06) |
| 20 | "empty state link to Pull Requests with an active repo" | `done` | `AgentPerformanceView.tsx:100-104` | carried |
| 21 | "server/test/agent-performance-helpers.test.ts" | `done` | file exists; inside the 766 passed | carried |
| 22 | "server/test/agent-performance.it.test.ts" | `done` | `agent-performance.it.test.ts:242-453` 11 cases, 160 passed, 0 skipped | re-graded (F-09, F-10 cases `:340,374`) |
| 23 | "client lib tests perf-range/format/colors" | `done` | `lib/perf-range.test.ts` (9), `perf-format.test.ts` (5), `perf-colors.test.ts` (2) | carried |
| 24 | "colocated tests for RangeControl, AgentPerformanceView, PerfKpiCards, AgentPerfTable, CostBreakdown, StatsTab, CostDelta, AcceptRateValue; AgentEditor.test.tsx provider" | `done` | files exist with 4/6/4/4/2/4/2/3 cases; `AgentEditor.test.tsx:37` provides `agentPerformance`; plus new `usePerfRange.test.tsx`, `hooks/agent-performance.test.tsx`, `nav-global.test.tsx`, `page.test.tsx` | re-graded |

### Constraints (`## Constraints`, 24 rows)
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| C1 | "@devdigest/shared is two copies: edit both, diff, typecheck both" | `done` | `diff -r` empty; both typechecks ✅ | re-graded |
| C2 | "client imports types only from @devdigest/shared" | `done` | grep for non-`import type` imports from `@devdigest/shared` in new client files (non-test) → none; `pnpm build` green `state.md:18` | re-graded |
| C3 | "new logic in service.ts + repository.ts, never queries in routes.ts" | `done` | `routes.ts:23-33` only calls the service | re-graded |
| C4 | "no import of another module's folder" | `done` | `pnpm arch` ✅ no new violation; grep of `modules/agent-performance` for `../reviews`/`../agents`/… → none | carried |
| C5 | "a service news only its own repository" | `done` | `service.ts:21-23` | re-graded (F-01) |
| C6 | "pure code in files named helpers.ts" | `done` | `helpers.ts` pure (no I/O); `core-no-io` in `arch` ✅ | carried |
| C7 | "route registration on one line up to the path string" | `done` | `routes.ts:25,30` | re-graded |
| C8 | "DB test is *.it.test.ts; --no-file-parallelism; read the skipped count" | `done` | `agent-performance.it.test.ts`; integration run `160 passed · 0 skipped` | re-graded |
| C9 | "pnpm typecheck does not cover server/test/ → scratch tsconfig" | `done` | scratch `tsc` over both test files, no output | re-graded |
| C10 | "no migration, no schema change" | `done` | `git diff --stat … server/src/db` empty | re-graded |
| C11 | "explicit now from useNow for relativeTime" | `done` | `LastRunTime.tsx:15,22` | carried |
| C12 | "repeated visible texts → getAllByRole after the final state" | `done` | tests green (525 passed); not re-read individually | carried |
| C13 | "fireEvent, no user-event" | `done` | grep `user-event` in new test folders → none | re-graded |
| C14 | "every test provider needs its namespace" | `done` | `AgentEditor.test.tsx:37` | carried |
| C15 | "tooltips in-tree, no portal → HoverNote" | `done` | `AgentPerfRowView.tsx:54`, `LastRunTime` uses `HoverNote` | carried |
| C16 | "imports ≥ 3 levels up through @/…; run lint" | `done` | client lint ✅; no `../../../` imports in non-test files. Tests import the JSON messages by relative path (`PerfKpiCards.test.tsx:4`, `RangeControl.test.tsx:4`, `AgentEditor.test.tsx:6`) | re-graded |
| C17 | "never pnpm build while next dev runs; check :3000 first" | `done` | `state.md:14,18` (dev stopped, :3000 free, rebuild after killing PID 828) | re-graded |
| C18 | "no React API newer than Next's bundled React" | `done` | grep for `useEffectEvent`/`use(`/`useActionState`/`useOptimistic` in new client code → none. `usePerfRange.ts` uses a state-only pattern, not `startTransition` | re-graded |
| C19 | "copy a neighbour's folder shape; Tailwind classes in styles.ts" | `done` | each component folder has `index.ts` and `styles.ts` | carried |
| C20 | "src/vendor/ is read-only except nav.ts; update its header comment" | `done` | `git status`: only `client/src/vendor/ui/nav.ts` under `vendor/ui`; `vendor/shared` changes are the planned contract files; nav.ts comment extended | re-graded |
| C21 | "two writers in one checkout: own your paths; never checkout--/stash others' files" | `cannot verify` | process rule, no artifact in the tree | needs the session transcript |
| C22 | "verify.mjs may leave client/pnpm-workspace.yaml → delete it" | `done` | `ls client/pnpm-workspace.yaml` → no such file, after the verify run | re-graded |
| C23 | "regex/escape-bearing code with Edit/Write, never a heredoc (TZ_SHAPE)" | `done` | `agent-performance.ts:13` regex is intact: `/^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/` | re-graded |
| C24 | "no commit under server/src while a review run is in flight" | `cannot verify` | process rule; no commit exists yet (`git status` shows everything uncommitted) | |

### Done when (15 boxes)
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| D1 | "R-01, R-106, D-26: integration — stats figures, comparison, cost_by_model deep-equal the dashboard row for two agents" | `done` | `agent-performance.it.test.ts:242` | carried |
| D2 | "R-02…R-14, R-27…R-30: integration cases pass with 0 skipped" | `done` | cases `:253,275,287,333,340,393,415`; `160 passed · 0 skipped` | re-graded |
| D3 | "R-15…R-24: unit + integration; total = Σ by-agent = Σ by-model within 1e-9" | `done` | `agent-performance.it.test.ts:299`; helpers unit test | carried |
| D4 | "R-25, R-26, R-28, D-2, D-19: both routes; /agents/performance 200; bad range or unknown tz → 422" | `done` | `agent-performance.it.test.ts:340` (incl. `%2B05`, `%2B0530`, year 0000, previous<1970, boundary 1970), `:374` (Postgres-unknown zone → 422 on both routes) | re-graded (F-08, F-09, F-10) |
| D5 | "R-31: diff -r empty; both typecheck" | `done` | `DIFF-EMPTY`; typecheck ✅ ×2 | re-graded |
| D6 | "R-32…R-41: perf-range.test.ts, RangeControl.test.tsx; a reload keeps the range" | `done` | `perf-range.test.ts` (9), `RangeControl.test.tsx` (4, incl. rerender test for F-12), `usePerfRange.test.tsx:92,119,132` (one GET per change, R-41); smoke `state.md:14` (custom range, DST bounds) | re-graded (was partial) |
| D7 | "R-42: GLOBAL → Agent Performance with and without an active repo, highlighted on the route" | `done` | `nav-global.test.tsx:22,30`; smoke `state.md:14` | re-graded (was partial) |
| D8 | "R-43…R-51, R-90…R-92, R-94, R-95, R-98…R-100: PerfKpiCards.test.tsx" | `done` | `PerfKpiCards.test.tsx` (4 cases), `CostDelta.test.tsx` (2), `AcceptRateValue.test.tsx` (3); sparkline `useMemo` test spies `formatToParts` | re-graded |
| D9 | "R-52…R-65, R-96, R-97, R-100…R-103: AgentPerfTable.test.tsx" | `done` | `AgentPerfTable.test.tsx` (4 cases) | carried |
| D10 | "R-66…R-69, R-87, R-102, R-103: CostBreakdown.test.tsx" | `done` | `CostBreakdown.test.tsx` (2 cases) | carried |
| D11 | "R-70…R-74, R-104, R-105: AgentPerformanceView.test.tsx; only GET requests; PR link only with an active repo" | `done` | `AgentPerformanceView.test.tsx` (6 cases); `lib/hooks/agent-performance.test.tsx:36` asserts GET only, paths, from/to/tz/bucket | re-graded (was partial, F-05) |
| D12 | "R-75…R-84, R-107…R-112: StatsTab.test.tsx, AgentEditor.test.tsx; …`?tab=stats` survives a range change" | `done` | `StatsTab.test.tsx` (4), `AgentEditor.test.tsx`, `page.test.tsx:77` (range kept on agent switch and tab switch, F-13); `usePerfRange.ts` copies existing params | re-graded |
| D13 | "R-85, R-86, R-88: keyboard-only walk (manual) + role/name assertions" | `cannot verify` | role/name assertions exist (`AgentPerfRowView.tsx:58-60,81`, `RangeControl.tsx` `aria-pressed`). No manual keyboard-only walk is recorded in `state.md` | needs a browser session |
| D14 | "R-89: no hardcoded user-facing string (gate G12)" | `done` | `agentPerformance.json`; components use `t(...)`; client lint ✅. Gate G12 is `/pr-self-review`'s, and `state.md:18` records gates CRITICAL 0 | re-graded |
| D15 | "`pnpm arch` no new violation; `pnpm build` green; no lockfile, schema or migration change" | `done` | `arch ✅`; `state.md:14,18` build green; `git diff --stat` empty | re-graded (was partial) |

### Verification commands (8)
| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| V1 | "server: `verify.mjs --baseline L08-agent-performance --it`" | `done` | output above | |
| V2 | "`pnpm exec vitest run .it.test --no-file-parallelism` and read the skipped count" | `done` | the verify `--it` stage reports `160 passed · 0 skipped`. I did not run the separate vitest command | the `--it` run covers it |
| V3 | "client: `verify.mjs --baseline L08-agent-performance`" | `done` | output above | |
| V4 | "`pnpm exec next lint --dir src`" | `done` | `lint ✅ no errors` in the verify run | |
| V5 | "`pnpm build` with :3000 free" | `done` | `state.md:14,18` | not re-run here |
| V6 | "`diff -r server/src/vendor/shared client/src/vendor/shared` → empty" | `done` | `DIFF-EMPTY` | |
| V7 | "`git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty" | `done` | empty output | |
| V8 | "Manual browser check (main session): dashboard and Stats tab on the seeded workspace… light and dark theme" | `partial` | `state.md:14,18` cover dashboard, Stats tab (figures match the row: 7 runs, $0.088, $0.015, 128.6s), custom range, empty state. No record of the seeded "1 unpriced run" case or of the light/dark palette check | what is missing: the seeded-workspace unpriced-run case and the light/dark theme look |

### Task requirements R-01…R-112
Legend: "carried" = iteration-1 `done`; all backed by green suites (server 766+160, client 525). Citations are the file or symbol that implements the requirement.

| # | Item (quoted, shortened) | Verdict | Evidence | Note |
|---|---|---|---|---|
| R-01 | "one set of aggregation rules… dashboard row and stats report identical values" | `done` | `helpers.ts:218,238` (same `foldFigures`/`compare`); `.it:242` | re-graded |
| R-02 | "count a run only when… workspace, status `done`, run time in range" | `done` | `repository.ts:31-36`; `.it:253` | re-graded |
| R-03 | "count runs of source `local` and `ci` alike" | `done` | no source filter in `countedRunsWhere`; `.it:253` | carried |
| R-04 | "start-inclusive and end-exclusive" | `done` | `repository.ts:35-36` `gte`/`lt` | carried |
| R-05 | "report as an agent's runs the number of its counted runs" | `done` | `helpers.ts:78` `foldFigures` | carried |
| R-06 | "total cost = sum of the stored cost… runs without a price separately" | `done` | `foldFigures`; `.it:253` | carried |
| R-07 | "IF none has a stored cost… null, never 0" | `done` | `.it:275` | carried |
| R-08 | "average cost = total / counted runs that have a cost" | `done` | `foldFigures`; unit test | carried |
| R-09 | "average duration = mean stored duration… or null" | `done` | `foldFigures` | carried |
| R-10 | "findings of the reviews produced by its counted runs… accepted, dismissed, pending" | `done` | `repository.ts:86-101` | carried |
| R-11 | "accept rate = accepted ÷ (accepted + dismissed)… null when 0" | `done` | `helpers.ts:44` | carried |
| R-12 | "findings of every kind" | `done` | no `kind` filter in `findingTallies`; `.it:253` | carried |
| R-13 | "last run = latest run time among counted runs" | `done` | `repository.ts:79` `max(ranAt)` | carried |
| R-14 | "return… the exact range start and end it applied" | `done` | `helpers.ts:33` `appliedRange`; `.it:287` | carried |
| R-15 | "Total runs = sum of the runs of all rows" | `done` | `buildDashboard`; `.it:299` | carried |
| R-16 | "Total cost = sum of priced runs = Σ by-agent = Σ by-model (1e-9)" | `done` | `.it:299`; unit test | re-graded (F-11 touches `compare` only) |
| R-17 | "runs without a price = sum of the rows'" | `done` | `buildDashboard` | carried |
| R-18 | "Avg accept rate pooled… both sums… unknown when none decided" | `done` | `buildDashboard`; `.it:299` | carried |
| R-19 | "Most-active… tie → later last run, then name" | `done` | `helpers.ts:183` | carried |
| R-20 | "IF no agent has a counted run… no Most-active agent" | `done` | `helpers.ts:184-192` (null when no candidates) | carried |
| R-21 | "runs whose agent was deleted → one row 'Deleted agents'… never Most-active" | `done` | `buildDashboard` `rowKey`; `pickMostActive` filters `kind === 'agent'` | carried |
| R-22 | "by-model grouped by provider+model… 'Unknown model'" | `done` | `helpers.ts:128` | carried |
| R-23 | "breakdowns only counted runs with a stored cost" | `done` | `foldModelCosts` skips `pricedRuns === 0` | carried |
| R-24 | "one dashboard row for every agent… including no counted run" | `done` | `buildDashboard` maps `agents` | carried |
| R-25 | "`GET /agents/:id/stats` returns that agent's figures" | `done` | `routes.ts:30`; `.it:242` | re-graded |
| R-26 | "global read returns totals, rows, breakdowns" | `done` | `routes.ts:25`; `.it:299` | re-graded |
| R-27 | "unknown/foreign agent id → 404" | `done` | `service.ts:42-43`; `.it:333` | re-graded |
| R-28 | "range missing, unparseable, start ≥ end → HTTP 422 before computing" | `done` | `agent-performance.ts:27-45` refines; `.it:340,374` (F-08/F-09) | re-graded |
| R-29 | "stored rows only: no model call, no GitHub, no writes" | `done` | `.it:393`; no write path in `repository.ts` | carried |
| R-30 | "never count a run, review or finding of another workspace" | `done` | `repository.ts:33,99`; `.it:415,453` | carried |
| R-31 | "both response shapes in `@devdigest/shared`, byte-identical" | `done` | `diff -r` empty; typecheck ×2 | re-graded |
| R-32 | "range control with 1 day, 30 days, Custom range" | `done` | `RangeControl.tsx` buttons; `RangeControl.test.tsx` | re-graded |
| R-33 | "no range in the address → 30 days" | `done` | `perf-range.ts:46,118` `DEFAULT_CHOICE` | carried |
| R-34 | "1 day = 24 h, 30 days = 720 h ending when applied" | `done` | `perf-range.ts:43,143`; `usePerfRange.ts` apply time | re-graded (F-02/F-14) |
| R-35 | "custom range: 00:00 of start to 00:00 after end, browser TZ" | `done` | `perf-range.ts:143` `resolveRange` | carried |
| R-36 | "end before start → message, no request" | `done` | `perf-range.ts:100-105` `validateCustom`; `RangeControl.tsx` | re-graded |
| R-37 | "date after today → message, no request" | `done` | same, `future` | re-graded |
| R-38 | "applying stores the range in the address" | `done` | `usePerfRange.ts` `router.replace` | re-graded |
| R-39 | "invalid range in address → 30 days, no error" | `done` | `perf-range.ts:118-141` | carried |
| R-40 | "name the applied range in KPI titles and Runs header" | `done` | `useRangeLabels` (`usePerfRange.ts`); `PerfKpiCards.tsx` titles; `AgentPerfTable.tsx:65` | carried |
| R-41 | "WHEN the range changes while a request is pending, show only the latest result" | `done` | query key per range (`hooks/agent-performance.ts:26,29`), no `placeholderData`; `usePerfRange.test.tsx:92` | re-graded |
| R-42 | "sidebar group GLOBAL → Agent Performance, with or without an active repo, highlighted" | `done` | `nav.ts` GLOBAL item; `nav-global.test.tsx:22,30`; smoke `state.md:14` | re-graded (was partial) |
| R-43 | "title + subtitle" | `done` | `AgentPerformanceView.tsx:44-46`; json `:3` | carried |
| R-44 | "four KPI cards" | `done` | `PerfKpiCards.tsx` 4 `Card`s | carried |
| R-45 | "label every cost figure 'DevDigest estimate'" | `done` | `PerfKpiCards.tsx:61`; `StatsTab.tsx:65,74,80`; `AgentPerfTable.tsx:68`; `CostBreakdown` heading | carried |
| R-46 | "the note 'Reconciled billing is not connected…'" | `done` | json `:31`; `CostEstimateNote` on both screens | carried |
| R-47 | "'<N> runs without a price — not included' in Total cost card" | `done` | `PerfKpiCards.tsx:62` | carried |
| R-48 | "total cost unknown → '—', never '$0'" | `done` | `formatCostUsd(null)`; `PerfKpiCards.tsx:60` | carried |
| R-49 | "Avg accept rate whole percent + '<accepted>/<decided> decisions'" | `done` | `AcceptRateValue` variant kpi | carried |
| R-50 | "Most-active name and '<runs> runs · <rate>% accept'" | `done` | `PerfKpiCards.tsx:130-150` | carried |
| R-51 | "format every cost with the existing per-run cost format" | `done` | `formatCostUsd` everywhere | carried |
| R-52 | "table with columns Agent, Runs, Avg cost, Avg duration, Accept rate, Last run, View" | `done` | `AgentPerfTable.tsx`, `constants.ts` | carried |
| R-53 | "row accept rate % + '<accepted>/<decided>' or '—' + '0 decisions'" | `done` | `AcceptRateValue.tsx` | carried |
| R-54 | "average duration in seconds, one decimal" | `done` | `perf-format.ts:21` | carried |
| R-55 | "Last run relative time, absolute on hover and focus" | `done` | `LastRunTime.tsx` + `HoverNote` | carried |
| R-56 | "View link opens the Stats tab with the same applied range" | `done` | `AgentPerfTable.tsx:88`; `perf-range.ts:172` `statsHref` | carried |
| R-57 | "agent with no counted run: Runs '0' and '—'" | `done` | `AgentPerfRowView.tsx` | carried |
| R-58 | "'Deleted agents' row without a View link" | `done` | `AgentPerfTable.tsx:88` (null `viewHref` for deleted) | carried |
| R-59 | "table sorted by accept rate, highest first" | `done` | `AgentPerfTable/constants.ts:4` | carried |
| R-60 | "headers sort, toggle, expose order" | `done` | `AgentPerfTable.tsx:61` `aria-sort` | carried |
| R-61 | "fewer than 5 decided → 'Small sample' badge" | `done` | `AcceptRateValue.tsx`; `perf-format.ts:8,11` | carried |
| R-62 | "accept-rate sort: tiers by decided" | `done` | `AgentPerfTable/helpers.ts` `sortRows` | carried |
| R-63 | "sorting reorders loaded rows without a request" | `done` | derived in render `AgentPerfTable.tsx:37` | carried |
| R-64 | "expand control shows counts, unpriced, cost per model — no request" | `done` | `AgentPerfRowView.tsx:58-125` | carried |
| R-65 | "truncate a long name, full name on hover and focus" | `done` | `AgentPerfRowView.tsx:54-66` | carried |
| R-66 | "Cost breakdown section with By agent and By model charts, legends" | `done` | `CostBreakdown.tsx`; `CostDonut.tsx:44-50` | carried |
| R-67 | "legend ordered by amount, highest first" | `done` | order received from server (cost desc) | carried |
| R-68 | "no priced run → 'No priced runs in this period'" | `done` | `CostBreakdown.tsx:22-23` | carried |
| R-69 | "convey each segment through its legend text" | `done` | `CostDonut.tsx:48-50` | carried |
| R-70 | "loading → skeletons, no number, '0' or '$0'" | `done` | `AgentPerformanceView.tsx` `DashboardSkeleton` | carried |
| R-71 | "read fails → error with reason and 'Retry'" | `done` | `AgentPerformanceView.tsx:48-53` | carried |
| R-72 | "no agents → 'No agents yet' + link" | `done` | `AgentPerformanceView.tsx:72-79` | carried |
| R-73 | "agents but no counted run → 'No agent runs in <range>' + hint" | `done` | `AgentPerformanceView.tsx:93-107` | carried |
| R-74 | "only read requests on load, reload, range change, sort, expand" | `done` | `hooks/agent-performance.test.tsx:36` (GET only); only `api.get` in hooks | re-graded |
| R-75 | "'Stats' tab, `?tab=stats`" | `done` | `AgentEditor/constants.ts:23`; `page.tsx:19` | carried |
| R-76 | "range control and the ten tiles" | `done` | `StatsTab.tsx:65-105` | carried |
| R-77 | "same formatting rules as the dashboard" | `done` | same components (`AcceptRateValue`, `LastRunTime`, `formatCostUsd`, `formatDurationSec`) | carried |
| R-78 | "loading → skeletons, no number" | `done` | `StatsTab.tsx:47-48` | carried |
| R-79 | "read fails → error + Retry" | `done` | `StatsTab.tsx:38` | carried |
| R-80 | "no counted run → 'No runs of <agent name> in <range>'" | `done` | `StatsTab.tsx:53` | carried |
| R-81 | "<5 decided → 'Small sample'" | `done` | `AcceptRateValue` at `StatsTab.tsx:89` | carried |
| R-82 | "total cost unknown → '—' and '<N> runs without a price'" | `done` | `StatsTab.tsx:73,76` | carried |
| R-83 | "Stats tab sends only read requests" | `done` | `useAgentStats` (`api.get`); `hooks/agent-performance.test.tsx:36` | carried |
| R-84 | "range change keeps the agent and the tab; stored in the address" | `done` | `usePerfRange.ts` copies existing params; `page.test.tsx:77` (F-13) | re-graded |
| R-85 | "range control, date inputs, sortable headers, expand controls, View links operable with the keyboard alone" | `done` | all are native `<button>`/`<input type=date>`/`<Link>` (`RangeControl.tsx`, `AgentPerfTable.tsx:61`, `AgentPerfRowView.tsx:58,81`); `aria-pressed` follows the applied choice after F-12 | re-graded (was partial). No manual keyboard-only walk is recorded, see D13 |
| R-86 | "View: 'View stats for <name>'; expand: 'Details for <name>' + expanded state" | `done` | `AgentPerfRowView.tsx:58-60,81` | carried |
| R-87 | "each chart named 'Cost by agent', 'Cost by model'" | `done` | `CostDonut.tsx:24` | carried |
| R-88 | "narrow viewport: cards wrap, table scrolls, no column hidden" | `done` | `AgentPerfTable/styles.ts:4` `overflow-x-auto`; KPI grid wraps. Visual check not recorded | carried |
| R-89 | "every user-facing label from the message files" | `done` | `messages/en/agentPerformance.json`; lint ✅ | carried |
| R-90 | "sparkline: one point per local calendar day touched; per hour for 1 day" | `done` | `perf-range.ts:190,222` (`bucketFor`, `fillBuckets`); `repository.ts:104-116`; `.it:425` | re-graded (F-03 memo; points not downsampled) |
| R-91 | "points add up to Total runs; empty bucket = 0" | `done` | `fillBuckets`; `PerfKpiCards.tsx:44` | re-graded |
| R-92 | "accessible name 'Runs per day' ('Runs per hour' for 1 day)" | `done` | `PerfKpiCards.tsx:57-59,95` | re-graded |
| R-93 | "previous window = same length ending at the range's start, same rules" | `done` | `helpers.ts:27`; `repository.ts:48,59`; `.it:287` | re-graded |
| R-94 | "signed difference in house format, labelled 'estimate difference vs previous period'" | `done` | `perf-format.ts:90`; `CostDelta.tsx`; json `:32` | re-graded (F-11) |
| R-95 | "previous or current total unknown → no difference, never '$0'" | `done` | `helpers.ts:157-162` (null unless both known); `CostDelta.tsx` null → renders nothing | re-graded |
| R-96 | "up/down arrow by whole-percent compare; 'up from <p>%' / 'down from <p>%'" | `done` | `helpers.ts:163-167`; `AcceptRateValue.tsx` `Trend` | carried |
| R-97 | "rate unknown in either window → no arrow" | `done` | `helpers.ts:164` (null trend); `Trend` returns null | carried |
| R-98 | "ring filled to the percentage, hidden from assistive technology" | `done` | `AcceptRing.tsx:15` `aria-hidden` | carried |
| R-99 | "rate unknown → no ring" | `done` | `PerfKpiCards.tsx:75-78` | carried |
| R-100 | "colour every displayed accept-rate percentage by band" | `done` | `perf-format.ts:53-67`; applied in `AcceptRateValue.tsx`, Most-active `PerfKpiCards.tsx:130-150` | carried |
| R-101 | "<5 decided or unknown → neutral" | `done` | `perf-format.ts:53-57` | carried |
| R-102 | "agent colour derived only from its agent id; marker and segment/legend" | `done` | `perf-colors.ts:44`; `AgentPerfRowView.tsx:46,53`; `CostBreakdown/helpers.ts:15` | carried |
| R-103 | "'Deleted agents' marker and segment neutral, never derived for an existing agent" | `done` | `perf-colors.ts:13,25` (palette has no `var(--info)`) | carried |
| R-104 | "empty dashboard + active repo → 'Go to Pull Requests' link" | `done` | `AgentPerformanceView.tsx:100-104` | carried |
| R-105 | "no active repo → no link" | `done` | same, guarded by `activeRepo` | carried |
| R-106 | "previous-window total cost and accept rate in both reads, same rules" | `done` | `agent-performance.ts` `PerfComparison`; `helpers.ts:218-238` (`compare` in both builds); `.it:242` | re-graded (F-11 touched `compare`) |
| R-107 | "Stats tab: signed difference next to Total cost" | `done` | `StatsTab.tsx:75` | re-graded |
| R-108 | "cost unknown in either window → no difference on the Stats tab" | `done` | `CostDelta.tsx` | re-graded |
| R-109 | "Stats tab shows the same trend arrow and text as the dashboard row" | `done` | `StatsTab.tsx:89` `AcceptRateValue … comparison={report.comparison}` | carried |
| R-110 | "rate unknown → no trend arrow on the Stats tab" | `done` | `Trend` returns null | carried |
| R-111 | "Stats tab accept rate: same bands and neutral rule" | `done` | same `AcceptRateValue` component | carried |
| R-112 | "no runs sparkline on the Stats tab" | `done` | `StatsTab.tsx` has no `Sparkline` (grep) | carried |

## Deviations observed
| Item | The plan said | The code does | Outcome still met? |
|---|---|---|---|
| 6 / F-01 | route does `new AgentPerformanceService({ repo: new PerformanceRepository(...) })` | route calls `AgentPerformanceService.fromDb(container.db)` (`routes.ts:23`, `service.ts:21-23`) | yes, and architecturally cleaner |
| 1 / R-28 / F-08, F-09 | `TZ_SHAPE = /^[A-Za-z0-9_+\-/]{1,64}$/` and a single `from < to` refine | letter-first regex `/^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/` and a second refine (previous window ≥ 1970) (`agent-performance.ts:13-45`), mirrored in both copies | yes; stricter 422s |
| 4, 5 / F-09 | tz is only validated by Intl | `assertTimeZoneKnown` probe (`repository.ts:134`) called first by both service methods; Postgres 22023 → 422 | yes |
| 4 | `sql.raw` only for the unit/format map | no `sql.raw`; the unit and format are bound `::text` parameters (`repository.ts:111`) | yes, stricter |
| D-21, R-94 / F-11 | `CostDelta` shows a signed delta | the server rounds the delta to 1e-4 (`helpers.ts:148`); a known delta below display precision reads "No estimate difference vs previous period" (`CostDelta.tsx`, json `:33`) | yes; the requirements are silent on a zero delta |
| 11 / F-02, F-14 | `usePerfRange` keeps one `appliedAt` | a bounded map of apply times per choice key (`usePerfRange.ts:24-80`) | yes |
| 21 (state.md:9) | unknown agent id on a run → no stated rule | a run of an agent id absent from `agents` falls into the "deleted" row (`helpers.ts` `rowKey`) | yes (R-21) |

## Changed outside the plan
| File | No item asked for it | In the plan's `Not in scope`? |
|---|---|---|
| `client/src/lib/agents.ts` (`agentEditorHref`) | F-13 fix | no |
| `client/src/lib/now-tick.ts`, `…/PrBriefCard/constants.ts`, `…/TourHeader/constants.ts` | F-15 shared constant | no (not in the "Not touched" list) |
| `client/src/test/agent-performance-fixtures.tsx`, `lib/hooks/agent-performance.test.tsx`, `usePerfRange.test.tsx`, `nav-global.test.tsx`, `page.test.tsx` | extra test support and files | no |
| `client/INSIGHTS.md`, `server/INSIGHTS.md` | lessons filed by `/engineering-insights` | no |
| `.claude/settings.json` | modified; not part of any plan item | no. Please confirm it is intended |

## Not graded in this pass
None. The final pass graded every item (items not `done` in iteration 1 and everything touched by the fix rounds in full; the rest carried).

## Summary
done 176 · partial 1 · not implemented 0 · contradicted 0 · cannot verify 3 (C21, C24, D13) — total 183 incl. one `partial` (V8).
Per group: steps 24/24 done · constraints 22 done, 2 cannot verify · Done when 14 done, 1 cannot verify (D13) · verification commands 7 done, 1 partial (V8) · R-01…R-112 112/112 done.

**Verdict:** incomplete — the single `partial` item is V8 (the manual browser check). The seeded workspace's "1 unpriced run" case and the light/dark palette check are not recorded in `state.md`. The three `cannot verify` items (C21, C24, D13) need the session transcript or a keyboard-only walk in a browser. There is no `not implemented` or `contradicted` item, all package checks are green with 0 new failures, and every code requirement R-01…R-112 is met.

## Noticed, not my call
- `.claude/settings.json` shows as modified in `git status` with no plan item behind it; whoever commits should confirm it belongs in this change.
- Three client tests import `messages/en/agentPerformance.json` by deep relative path instead of `@/…`; this is `/code-review`'s style call and lint passes.

---

## Findings ledger

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | WARNING | `server/src/modules/agent-performance/routes.ts:8,20` | route imports and `new`s `PerformanceRepository` — Ring 4 reaches Ring 3 (onion-architecture rings + DI section; no other routes.ts does it). Arch SUGGESTION on `service.ts:13` deps shape folded in here | fixed | `service.ts:21-23` static `fromDb(db)`; `routes.ts:23` uses it, no repository import |
| F-02 | 1 | frontend-lens | WARNING | `client/src/components/perf-range-control/usePerfRange.ts:38-43` | `setAppliedAt` (urgent) + `router.replace` (transition) commit an in-between render → one stray GET for an unpinned preset per range change, never aborted; double skeleton flash; same on Stats tab. Fix: both in one `startTransition` (exists in bundled React) or derive appliedAt from URL | fixed | `usePerfRange.ts:25-75` apply time keyed to its range + previous (key,at) kept → in-between render reuses old key; test `usePerfRange.test.tsx` (fails on old code). startTransition not used (relies on batching Next does not promise) |
| F-03 | 1 | frontend-lens | SUGGESTION | `client/src/app/agent-performance/_components/PerfKpiCards/PerfKpiCards.tsx:203` | `sparklinePoints`/`fillBuckets` recomputed every render; with uncapped custom range (Q-05) ~15k formatToParts calls. `useMemo` + optional downsample | fixed | `PerfKpiCards.tsx:44` useMemo on report; test spies formatToParts. Downsampling NOT done: R-90 requires one point per local day |
| F-04 | 1 | frontend-lens | SUGGESTION | `server/src/modules/agent-performance/repository.ts:30-59` | no `(workspace_id, status, ran_at)` index; previous window doubles scan | accepted | recorded decision REC-2 (no migrations) — already in plan `## Risks` |
| F-05 | 1 | plan-verifier | gap | Done when D11 / R-74 | `AgentPerformanceView.test.tsx` mocks the hook, nothing asserts "only GET requests" at view/hook level | fixed | new `client/src/lib/hooks/agent-performance.test.tsx`: GET only, paths, from/to/tz/bucket |
| F-06 | 1 | plan-verifier | gap | Done when D7 / R-42 | GLOBAL → Agent Performance nav item + active highlight has no automated test (browser half → smoke) | fixed | new `client/src/components/app-shell/nav-global.test.tsx`: GLOBAL group, href without :repoId, highlight on/off |
| F-07 | 1 | plan-verifier | SUGGESTION | `{server,client}/src/vendor/shared/contracts/productionize.ts` above `AgentPerf` | two stacked JSDoc blocks ("Response of GET /agents/performance." + `@deprecated`) — cosmetic; must stay mirrored in both copies | fixed | one JSDoc block at `productionize.ts:173-176`, both copies; diff -r empty |
| F-08 | 3 | pr-self-review (security lens + code-review) | WARNING | `{server,client}/src/vendor/shared/contracts/agent-performance.ts:27-28`, `server/src/modules/agent-performance/helpers.ts:27-30`, `client/src/lib/perf-range.ts:95-97` | year 0000 / far-past `from` (or `previousWindow` going negative) passes zod but Postgres rejects → 500 instead of 422 (R-28); reachable from UI via `?at=0001-01-01…` or `start=0100-01-01`. Fix: lower bound (previous.from ≥ 1970-01-01) in contract + client parse. conf 0.9 | fixed | contract refine `2·from − to ≥ 0` (both copies, `MIN_WINDOW_START_MS`); client `perf-range.ts:55-63,105,126` same rule + `min=1970-01-01` on inputs, `tooEarly` error |
| F-09 | 3 | pr-self-review (security lens) | WARNING | `contracts/agent-performance.ts:13-22` (`TZ_SHAPE`), `repository.ts:291` | offset `tz` (`+05`, `+0530`) passes Intl+regex: `+05` → Postgres POSIX inverted sign → silently wrong buckets (200); `+0530`/`US/Pacific-New` → 500. Fix: first char must be a letter; catch Postgres 22023 in `runBuckets` → 422 (the plan's Risks fallback). conf 0.85 | fixed | round 2: `TZ_SHAPE` letter-first; `runBuckets` maps 22023 → 422. Remaining: stats route + empty window still 200 for a Postgres-unknown zone → user chose a probe query on both routes (round 3) ; round 3: `repository.ts` `assertTimeZoneKnown` probe (bound param) called first by `service.ts` dashboard + agentStats; it.test 422 on both routes incl. empty window |
| F-10 | 3 | pr-self-review (security lens) | SUGGESTION | `server/test/agent-performance.it.test.ts:340-355` | R-28 block lacks `tz=%2B05`, `tz=US/Pacific-New`, `from=0000-01-01T00:00:00Z` → 422 cases; needed to lock F-08/F-09 | fixed | it.test R-28 loop: `%2B05`, `%2B0530`, year 0000, previous<1970 → 422 both routes; boundary 1970 → 200; `US/Pacific-New` → 422 on dashboard |
| F-11 | 3 | pr-self-review (code-review) | WARNING | `server/src/modules/agent-performance/helpers.ts:151` (`compare`), `client/src/lib/perf-format.ts:76` (`formatCostDelta`) | `cost_delta_usd` is an unrounded float difference: equal periods (0.1+0.2 vs 0.3) show "+<$0.0001 estimate difference"; any sub-display delta prints a signed "<$0.0001". Fix: round to display precision; below threshold → "no change"/nothing. conf 0.8 | fixed | server `roundCostDelta` to 1e-4 (0 = unchanged, never -0; null = unknown); client `isCostUnchanged` + "No estimate difference" text |
| F-12 | 3 | pr-self-review (code-review) | WARNING | `client/src/components/perf-range-control/RangeControl.tsx:27-29,34` | `customOpen`/`start`/`end` seeded from `choice` only on mount → after back/forward or link to a preset while mounted, no button is pressed and stale dates remain; wrong `aria-pressed` (R-85). conf 0.7 | fixed | `RangeControl.tsx:45-54` resets local state when the applied choice key changes (no remount, focus kept); rerender test |
| F-13 | 3 | pr-self-review (code-review) | WARNING | `client/src/app/agents/[id]/page.tsx:119` | agent list click `router.push('/agents/${id}?tab=${tab}')` drops `range`/`start`/`end`/`at`, unlike `setTab` → switching agent on Stats resets to 30 days. conf 0.75 | fixed | `lib/agents.ts` `agentEditorHref` used by setTab and list click (`page.tsx:37,116`); new `page.test.tsx` |
| F-14 | 3 | pr-self-review (code-review) | SUGGESTION | `client/src/components/perf-range-control/usePerfRange.ts:65-72` | F-02 fix covers one previous choice only: two fast applies before the first `router.replace` commits → one extra GET; suggest `Map<choiceKey, appliedAt>`. conf 0.5 (frontend lens judged this edge acceptable) | fixed | `usePerfRange.ts:24-80` bounded Map (8 keys) of apply times per choice key; two-fast-click tests |
| F-15 | 3 | pr-self-review (code-review) | SUGGESTION | `client/src/components/last-run-time/constants.ts:2` | `NOW_TICK_MS = 60_000` now defined 3× (PrBriefCard, TourHeader, LastRunTime); suggest one shared constant | fixed | `client/src/lib/now-tick.ts:6`; three constants files re-export |
