# L08 follow-up — Skill Stats tab + shared Findings widget · implementation plan

**Requirements:** `specs/L08-skill-stats.requirements.md` (Status: Approved 2026-11-05, **R-01 … R-83**, no open question)
**Decisions:** `specs/L08-skill-stats.decisions.md` — full requirements check (§A), decision rationale (§B), test-case lists (§C)
**Execution:** multi-agent, parallel streams (contract → server ∥ client), default `/run-plan` — chosen by the user, 2026-11-05 (OQ-1 A)
**Branch:** `lesson/L08-homework` (current, `.git/HEAD`; never `main`)
**Predecessor:** `specs/L08-agent-performance.md` + `.verification.md` (F-01 … F-15). This plan reuses its module, range control, range contract and lessons; it does not reopen them.
**Plan status:** revision 2, 2026-11-05 — **ready for `/run-plan`**. OQ-1 … OQ-4 answered by the user (all option A), recorded as D-19 … D-22; no question open.

---

## Answered questions (user, 2026-11-05)

| ID | Answer | Where it lands |
|---|---|---|
| OQ-1 | A — multi-agent, parallel streams, default `/run-plan` (tests in the streams, no `--test-writer`) | D-19 · `## Execution` |
| OQ-2 | A — "Small sample" only for 1–4 decided findings | D-20 · step 17 |
| OQ-3 | A — reuse `AcceptRateValue` bands unchanged | D-21 · step 17 |
| OQ-4 | A — year in the custom caption only when a date is outside the current year | D-22 · steps 9, 13 |

---

## Requirements check

Full table: appendix §A. **R-01 … R-83: 66 ok · 9 by construction (R-03, R-04, R-09, R-16, R-18, R-27, R-57, R-72, R-78) · 8 planner detail (R-31, R-33, R-39, R-40, R-43, R-58, R-82, R-83).** Blocked: none. Already holds: none (R-28's control exists but must be wired into a new tab). Every ID is covered by a step; none dropped.

Notes that change how a step is built:
- **R-03** — `agent_runs.source` is an enum of `local | ci` (`runs.ts:37`), so the predecessor's predicate (no source filter, `repository.ts:31-39`) already means "local or ci". No filter is added.
- **R-21** — `IdParams` is `z.string().uuid()` (`_shared/schemas.ts:11`): a non-uuid id is a 422, as on every `/skills/:id` route today; an unknown or foreign **uuid** is the 404 R-21 asks for (D-1).
- **R-40, R-39** — OQ-2, OQ-3. **R-31** year — OQ-4.
- **R-71** — the card's badge changes from "Used by 2 agents" to "2 agents · 100% pull freq"; `SkillCard.test.tsx:58` asserts the old text and is updated in step 20 (D-11).

## Decisions

Planner decisions unless marked. Rationale: appendix §B.

| ID | Question | Answer |
|---|---|---|
| D-1 | Where the two skill reads live | In the **existing `agent-performance` module** — it owns the counted-run predicate (`repository.ts:31-39`) and the tz probe; a new module could not import it (`no-cross-module`). Routes `GET /skills/:id/stats` and `GET /skills/pull-frequency`, both with querystring `PerfRangeQuery`. The static `/skills/pull-frequency` wins over the skills module's `GET /skills/:id` in find-my-way (same as `/agents/performance`, predecessor D-1); a test proves it. `modules/index.ts` is not touched |
| D-2 | Contract | `## Contract`: `FindingsBreakdown` (+ the two count objects) appended to `contracts/agent-performance.ts` and a required `findings` field on `AgentStatsReport`; new `contracts/skill-stats.ts`. Both trees byte-identical; the client imports **types only** |
| D-3 | Range validation | `PerfRangeQuery` reused verbatim, so R-22 inherits the `from < to` refine and the 1970 bound, R-23 the letter-first `TZ_SHAPE`. `bucket` is ignored by both skill reads. Both new service methods call `repo.assertTimeZoneKnown(range.tz)` **first** (R-23 incl. an empty range — `server/INSIGHTS.md:222-226`). `range` echoed with the existing `appliedRange()` (R-17) |
| D-4 | "Uses the skill" | `usingAgents(ws, skillId)`: `agent_skills ⨝ skills ⨝ agents` with `activeSkillOnAgent()` (`db/skill-gates.ts:22-28`) **and** `agents.workspace_id = ws` **and** `skills.workspace_id = ws`, ordered by name then id. Evaluated at request time, so attach/detach moves past runs (R-01, R-02). A deleted agent's run has `agent_id = null` and joins nothing (R-04) |
| D-5 | Findings per category/severity | One read `findingBreakdown(ws, range, agentIds)`: counted runs of the **current window only** ⨝ `reviews` (same `run_id` + workspace check as `findingTallies`, `repository.ts:99`) ⨝ `findings`, `GROUP BY agent_runs.agent_id, findings.category, findings.severity`, with the **same three state filters** as `findingTallies` — extracted into one private `findingStateColumns()` so both reads use identical SQL (R-16, R-26). Every kind and state counts (BQ-3). Fold `foldBreakdown(rows)` in `helpers.ts`: exact match against `FindingCategory.options` / `Severity.options`, anything else → `other` (R-14, R-15, G-06) |
| D-6 | Skill accept figures | `skillFigures(rows)` sums accepted/dismissed/pending of the breakdown rows; `decided = accepted + dismissed`, `accept_rate = acceptRate(...)` (the existing helper, R-13). For a single-agent skill these are the same rows `findingTallies` counts for that agent → R-16 |
| D-7 | Pull frequency | `reviewedPrCount(ws, range)` = `count(distinct pr_id)` over counted runs with `pr_id is not null`, every agent incl. deleted (R-07, R-09). `prsWithSkill(ws, range, skillId?)` = `count(distinct agent_runs.pr_id)` over counted runs ⨝ `agents` ⨝ `agent_skills` ⨝ `skills` with `activeSkillOnAgent()`, both workspace checks, `pr_id is not null`, `GROUP BY skills.id` (R-08, R-09). **Both reads call these two methods** → R-18, R-72, R-78 by construction. `rate = n / d`, `null` at `d = 0` (R-10); unrounded on the wire, the client shows `Math.round(rate × 100)` |
| D-8 | Read order (skill stats) | probe → `getSkill` (absent → `NotFoundError('Skill not found')`, R-21) → `usingAgents` → `Promise.all([runCountsByAgent, findingBreakdown, reviewedPrCount, prsWithSkill(skillId)])` → `buildSkillStats`. Methods given an empty `agentIds` return `[]` **without a query** (`inArray` with `[]` is invalid SQL) |
| D-9 | Window caption (R-31 … R-33) | `RangeCaption({ choice, applied })` in `components/perf-range-control/`; `applied` is the **response's** `range` (`{ from, to, tz }`), so the caption names the window the figures were computed for (R-33). Not rendered while loading or on error. Preset → `range.caption.preset` "{choice} · {start} – {end}", choice label = the button's label ("1 day" / "30 days"), dates `format.dateTime(d, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: applied.tz })` → "Nov 4, 10:37". Custom → `range.caption.custom` "{start} – {end}", start = `from`, end = `to − 1 ms` (both days included, G-02), `{ month: 'short', day: 'numeric', timeZone }` plus `year: 'numeric'` when either date is not in the current year (**OQ-4 A**). `applied.tz` is the browser zone the client sent (Q-10) |
| D-10 | Findings widget | `components/findings-widget/` (two routes → shared). Props `{ findings: FindingsBreakdown; emptyLabel: string }`. `total === 0` → only "No findings in {range}" (R-65). Else: a recharts ring in `<div role="img" aria-label="Findings by category">` with the total in its centre (R-60, R-66); legend `<ul>` security, bug, perf, style, test always, `other` only when > 0, each "count · p%" (R-61); severity row CRITICAL, WARNING, SUGGESTION always, `other` only when > 0, icon + colour from `SEV` (`@devdigest/ui`), label from messages (R-63); `p = Math.round(count / total × 100)` per entry (R-62); "Small sample" badge when `1 ≤ total ≤ 4` (`SMALL_SAMPLE_FINDINGS = 5`, R-64). Colours: fixed `CATEGORY_COLOR` in the widget's `constants.ts` — security `#ef4444`, bug `#f97316`, perf `#8b5cf6`, style `#3b82f6`, test `#10b981`, other `var(--info)` (R-67). No request of its own (R-70) |
| D-11 | Card pull frequency | `useSkillsPullFrequency()` — **one** GET per page (R-74), window = 720 h ending at the hook's mount (`lastThirtyDays(mountedAt)`, R-73), key `['skills-pull-frequency', from, to, tz]`. Card prop `pullFrequency?: CardPullFreq` (`{ status: 'loading' } \| { status: 'error' } \| { status: 'ready'; rate: number \| null }`), mapped by `toCardPullFreq(query, skillId)` in `SkillCard/helpers.ts`. Badge text: ready → "2 agents · 100% pull freq"; `rate null` → "2 agents · — pull freq" (R-75); loading → "2 agents · " + an inline skeleton, no digit (R-76); error or no prop → "2 agents" (R-77). The wording replaces "Used by N agents" (R-71). Hint (R-82, R-83) in a new `_components/PullFreqBadge/`: a `role="tooltip"` span, `hidden group-hover:flex group-focus-within:flex`, referenced by `aria-describedby` from the pull-frequency text **and** the card's `role="button"` root (the focusable element AT reads); the card root gets `className="group"`. Hint shown for ready (known or "—"), not while loading or failed |
| D-12 | Skill accept-rate KPI | `AcceptRateValue variant="kpi"` reused unchanged (**OQ-2 A, OQ-3 A**): "<accepted>/<decided> decisions" or "—" + "No decided findings", band colour, "Small sample" for 1–4 decided |
| D-13 | "Open" target (R-43, R-44) | `<Link href={statsHref(agent.id, choice, appliedRange)} aria-label="Open <name>">` where `appliedRange = { from: new Date(report.range.from), to: new Date(report.range.to) }` — a preset pins `at` = the applied end, so the agent tab shows the same start and end |
| D-14 | Rail keeps tab + range (R-53) | `skillEditorHref(skillId, tab, current)` in `lib/skills.ts`, the twin of `agentEditorHref` (`lib/agents.ts:20-24`, F-13); `page.tsx` `setTab` (`:38-42`) and the rail click (`:110`) both use it |
| D-15 | Skill gone (R-58) | `useSkillStats`: `retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 1` (as `hooks/brief.ts:31`); on a 404 the queryFn calls `qc.invalidateQueries({ queryKey: ['skill', skillId] })` then rethrows, so `useSkill` re-reads, 404s, and the page shows its existing not-found `ErrorState` (`page.tsx:51-62`) |
| D-16 | Messages | Added, not replaced. `agentPerformance.json`: `range.caption.{preset,custom}`, `findings.*`. `skills.json`: `editor.tabs.stats`, `listItem.{agents,pullFreq,pullFreqUnknown,pullFreqLoading,pullFreqHint}`, `stats.*`. Exact texts = the requirement quotes (list in appendix §B) |
| D-17 | Agent Stats tab (R-32, R-57, R-69) | Header: `RangeCaption` after `RangeControl`. `StatsFigures`: `<FindingsWidget findings={report.findings} emptyLabel=…>` between the tile grid and `<CostEstimateNote />`. Nothing else changes; the "No runs" branch stays as is (the widget shows only with figures, R-69). Dashboard header: `RangeCaption` with `q.data?.range` (R-32) |
| D-18 | Commits (main session) | (1) spec + plan + appendix; (2) code + tests after the review/fix loop. No lockfile, `package.json`, schema or migration change |
| D-19 | OQ-1 — execution mode (user, 2026-11-05) | A: multi-agent, parallel streams (contract → server ∥ client, each stream writes its package's tests), default `/run-plan` — `## Execution` as written |
| D-20 | OQ-2 — small sample at 0 decided, R-40 (user, 2026-11-05) | A: badge only for 1–4 decided findings, as on the agent Stats tab; at 0 "—" + "No decided findings", no badge (D-12) |
| D-21 | OQ-3 — accept-rate colour band on the skill tab (user, 2026-11-05) | A: `AcceptRateValue` reused unchanged, bands included (D-12) |
| D-22 | OQ-4 — year in the custom caption, R-31 (user, 2026-11-05) | A: year only when a date is outside the current year (D-9) |

## Recommendations

| ID | Recommendation | Why / cost of not doing it | Status |
|---|---|---|---|
| REC-1 | Extend `agent-performance` instead of a new module (D-1) | a second module would need a second copy of the counted-run predicate — the drift R-03/R-16/R-18 forbid | прийнято (planner, structural) |
| REC-2 | One `findingStateColumns()` for tallies and breakdown (D-5) | two hand-written copies of the accepted/dismissed/pending filters is how R-16 and R-26 would break silently | прийнято (planner, structural) |
| REC-3 | Index `agent_runs (workspace_id, status, ran_at)` | the new reads add `count(distinct pr_id)` scans over the same span | **відхилено by the spec** ("no migration") — F-04 precedent, in `## Risks` |
| REC-4 | Security lens + `/code-review` in phase 2, not only at the gate | predecessor: 5 WARNINGs (F-08, F-09, F-11, F-12, F-13) found only at `/pr-self-review` | **прийнято** — the updated `/run-plan` (`.claude/skills/run-plan/SKILL.md:101-115`) |

## Touches

server: `vendor/shared/contracts/{agent-performance.ts (edit), skill-stats.ts (new)}`, `vendor/shared/index.ts`; `modules/agent-performance/{types,helpers,repository,service,routes}.ts`; `test/skill-stats-helpers.test.ts`, `test/skill-stats.it.test.ts` (new)
client: the same contract files mirrored; `lib/{perf-range,skills}.ts`, `lib/hooks/{agent-performance,skill-stats}.ts`; `components/perf-range-control/` (+ `RangeCaption`), `components/findings-widget/` (new); `app/agents/[id]/_components/AgentEditor/_components/StatsTab/StatsTab.tsx`; `app/agent-performance/_components/AgentPerformanceView/AgentPerformanceView.tsx`; `app/skills/[id]/{page.tsx, _components/SkillEditor/{constants.ts,SkillEditor.tsx,_components/StatsTab/ (new)}}`; `app/skills/_components/{SkillCard,SkillsListView}/`; `messages/en/{agentPerformance,skills}.json`; `test/agent-performance-fixtures.tsx`; tests
**Not touched:** reviewer-core, mcp, e2e, every `package.json` and lockfile, `server/src/db/**` (read only: `db/skill-gates.ts` is imported), migrations, `server/src/platform/**`, `server/src/modules/{index,skills/**,agents/**}`, `client/src/vendor/ui/**`, `.dependency-cruiser-known-violations.json`, `specs/L08-skill-stats.requirements.md`.

## Contract

Step 1, **byte-identical** in `server/src/vendor/shared/` and `client/src/vendor/shared/`.

**(a) `contracts/agent-performance.ts`** — insert after `PerfModelCost` (before `AgentStatsReport`), and add one field to `AgentStatsReport`. Header comment: add the line `* GET /skills/:id/stats, GET /skills/pull-frequency → contracts/skill-stats.ts (same counted-run rule)`.

```ts
const count = () => z.number().int().nonnegative();

/** Findings per category (R-14): a stored value outside FindingCategory counts as `other`. */
export const FindingCategoryCounts = z.object({
  security: count(), bug: count(), perf: count(), style: count(), test: count(), other: count(),
});
export type FindingCategoryCounts = z.infer<typeof FindingCategoryCounts>;

/** Findings per severity (R-15): a stored value outside Severity counts as `other`. */
export const FindingSeverityCounts = z.object({
  CRITICAL: count(), WARNING: count(), SUGGESTION: count(), other: count(),
});
export type FindingSeverityCounts = z.infer<typeof FindingSeverityCounts>;

/**
 * Every finding of the counted runs in the current window, any kind, any state (BQ-3).
 * total = Σ by_category = Σ by_severity = accepted + dismissed + pending.
 */
export const FindingsBreakdown = z.object({
  total: count(),
  by_category: FindingCategoryCounts,
  by_severity: FindingSeverityCounts,
});
export type FindingsBreakdown = z.infer<typeof FindingsBreakdown>;
```

`AgentStatsReport` gains, after `cost_by_model`: `/** This agent's findings per category and severity (L08 skill-stats R-26). */ findings: FindingsBreakdown,` — required. `AgentPerfTableRow` is **not** changed (UX-04 deferred).

**(b) `contracts/skill-stats.ts`** (new):

```ts
import { z } from 'zod';
import { AgentPerfFigures, AppliedRange, FindingsBreakdown } from './agent-performance.js';

/**
 * L08 follow-up — Skill Stats. The agent-performance counted-run rule, attributed to skills:
 *   GET /skills/:id/stats?from&to&tz       → SkillStatsReport
 *   GET /skills/pull-frequency?from&to&tz  → SkillsPullFrequencyReport
 * Querystring: PerfRangeQuery (`bucket` ignored). An agent uses a skill when, at request
 * time, it is in the workspace, has the skill checked, and the skill is on globally
 * (server db/skill-gates.ts) — current attachment, not run-time (R-01, R-02).
 */

/** Share of reviewed PRs that had a counted run of an agent using the skill (R-07 … R-10). */
export const PullFrequency = z.object({
  /** distinct PRs with a counted run of an agent using the skill */
  prs_with_skill: z.number().int().nonnegative(),
  /** distinct PRs with any counted run in the range, deleted agents included */
  prs_reviewed: z.number().int().nonnegative(),
  /** prs_with_skill / prs_reviewed, 0..1; null when prs_reviewed = 0 */
  rate: z.number().nullable(),
});
export type PullFrequency = z.infer<typeof PullFrequency>;

export const SkillStatsAgent = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  /** counted runs in the range, 0 included (R-79) */
  runs: z.number().int().nonnegative(),
});
export type SkillStatsAgent = z.infer<typeof SkillStatsAgent>;

/** A skill's accept figures — field for field an agent's (R-13, R-16). */
export const SkillFindingFigures = AgentPerfFigures.pick({
  accepted: true, dismissed: true, pending: true, decided: true, accept_rate: true,
});
export type SkillFindingFigures = z.infer<typeof SkillFindingFigures>;

export const SkillStatsReport = z.object({
  range: AppliedRange,
  skill: z.object({ id: z.string(), name: z.string(), enabled: z.boolean() }),
  /** agents using the skill now — equals the card's agent count (R-05) */
  used_by: z.number().int().nonnegative(),
  /** of those, agents with at least one counted run in the range (R-06) */
  ran_in_period: z.number().int().nonnegative(),
  pull_frequency: PullFrequency,
  figures: SkillFindingFigures,
  /** findings.total is the Findings KPI (R-12) */
  findings: FindingsBreakdown,
  /** every agent using the skill, name asc then id (R-42) */
  agents: z.array(SkillStatsAgent),
});
export type SkillStatsReport = z.infer<typeof SkillStatsReport>;

export const SkillPullFrequency = z.object({ skill_id: z.string(), pull_frequency: PullFrequency });
export type SkillPullFrequency = z.infer<typeof SkillPullFrequency>;

export const SkillsPullFrequencyReport = z.object({
  range: AppliedRange,
  /** one entry per skill of the workspace, name asc then id (R-20) */
  skills: z.array(SkillPullFrequency),
});
export type SkillsPullFrequencyReport = z.infer<typeof SkillsPullFrequencyReport>;
```

**(c) both `vendor/shared/index.ts`**: `export * from './contracts/skill-stats.js';` after `agent-performance.js`; header: append `FindingsBreakdown` to the agent-performance line and add `contracts/skill-stats  PullFrequency, SkillStatsReport, SkillsPullFrequencyReport`.

Names checked: none of the new exports exists in `server/src` today (grep `PullFrequency|SkillStats|FindingsBreakdown|FindingCategoryCounts|FindingSeverityCounts` → no match).

## Skill map

From `.claude/skills/pr-self-review/references/routing.md`, reconciled with the planner's list. `perf-prompt` is **not a skill**: "perf rubric" = read `docs/agent-prompts/performance-reviewer.md`.

| Step | Path | Skills the implementer loads |
|---|---|---|
| 1 | `*/vendor/shared/contracts/*.ts`, `*/vendor/shared/index.ts` | `zod` |
| 2, 3 | `modules/agent-performance/{types,helpers}.ts` | `onion-architecture`, `typescript-expert` |
| 4 | `modules/agent-performance/repository.ts` | `drizzle-orm-patterns`, `onion-architecture`, `security` (workspace scoping), perf rubric |
| 5 | `modules/agent-performance/service.ts` | `onion-architecture`, perf rubric |
| 6 | `modules/agent-performance/routes.ts` | `fastify-best-practices`, `onion-architecture`, `security`, `zod` |
| 7, 8 | `server/test/skill-stats*.ts` | **not in routing.md** — planner's pick: `onion-architecture`; `drizzle-orm-patterns` for 8 |
| 9–11 | `client/src/lib/**` | `frontend-ui-architecture`, `typescript-expert`; `react-best-practices` for 10 |
| 12 | `client/messages/en/*.json` | none (gate G12) |
| 13–18 | `client/src/{app,components}/**/*.tsx` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` (step 14's chart colours are fixed by R-67; no chart skill needed) |
| 19, 20 | `client/src/**/*.test.ts(x)` | `react-testing-library` |

## Constraints

| Constraint | Source |
|---|---|
| `@devdigest/shared` is two copies: edit both in step 1, `diff -r`, typecheck both packages | root `AGENTS.md`; `client/INSIGHTS.md:211-217` |
| the client imports **types only** from `@devdigest/shared`; runtime lists (category/severity order) are local consts; run `pnpm build` | `server/INSIGHTS.md:72-87` |
| logic in `service.ts` + `repository.ts`; `routes.ts` only parses and delegates; the route uses `AgentPerformanceService.fromDb`, never a repository | `server/INSIGHTS.md:160-172`; predecessor F-01 (`service.ts:21-23`) |
| no import of another module's folder (not even `import type`); `db/skill-gates.ts` is the shared home of the "active skill" predicate | `server/INSIGHTS.md:128-144`, `:234-248`; `db/skill-gates.ts:15-20` |
| pure folds in `helpers.ts` (the `DOMAIN` regex) — no `Date.now()`, no I/O | `.dependency-cruiser.cjs:65-72` |
| probe the zone **before any read** in every new service method; 1970 bound comes from the contract | `server/INSIGHTS.md:222-232` |
| route registration on one line up to the path string | `agent-performance/routes.ts:25,30` |
| a DB test is `*.it.test.ts`; run `--no-file-parallelism`; **read the skipped count** | `server/INSIGHTS.md:90-115`, `:301-323` |
| `pnpm typecheck` does not cover `server/test/` → scratch tsconfig over the two new test files | `server/INSIGHTS.md:146-157` |
| `buildStats` gains a 5th parameter **with a default** (`= []`): `server/test/agent-performance-helpers.test.ts:281` calls it with four | that test |
| `AgentStatsReport.findings` is required: update `client/src/test/agent-performance-fixtures.tsx` `statsReport()` in the same stream | `agent-performance-fixtures.tsx:129-138` |
| no migration, no schema change, no new dependency (`recharts` ^2.15 is present) | requirements `## Out of scope`; `client/package.json:22` |
| don't pair an urgent `setState` with `router.replace` on one query key — reuse `usePerfRange`, write no second range hook | `client/INSIGHTS.md:22-26` |
| no React API newer than Next's bundled React without grepping `next/dist/compiled/react` | `client/INSIGHTS.md:28-32` |
| run `pnpm exec next lint --dir src`; import ≥ 3 levels up through `@/…` | `client/INSIGHTS.md:34-38` |
| several "Open" links share a role → await the final state, then `getAllByRole` | `client/INSIGHTS.md:90-108` |
| every test provider rendering a component needs each namespace it translates through: skill StatsTab = `skills` + `agentPerformance`; `SkillCard` stays `skills` only | `client/INSIGHTS.md:163-177` |
| `fireEvent`, no `user-event` | `client/INSIGHTS.md:233-244` |
| tooltips in-tree, no portal | `client/INSIGHTS.md:181-196` |
| `SkillsListView.test.tsx` stubs one global `fetch`: route the mock by URL once the pull-frequency GET exists | `SkillsListView.test.tsx:34-49` |
| new client components in Tailwind (`styles.ts` class strings); `SkillCard` keeps its legacy `CSSProperties` and only gains `className="group"` (D-11) | `client/AGENTS.md`; `frontend-ui-architecture` |
| never `pnpm build` while `next dev` runs; check `:3000` by PID first | `client/INSIGHTS.md:68-88`, `:248-252` |
| two writers in one checkout: own your paths; never `git checkout --` / `git stash` others' files | `INSIGHTS.md:66-88` |
| `verify.mjs` may leave `client/pnpm-workspace.yaml` → delete it | `INSIGHTS.md:191-195` |
| regex- or escape-bearing code with Edit/Write, never a heredoc | `INSIGHTS.md:42-46` |
| no commit under `server/src` while a review run is in flight | `server/INSIGHTS.md:32-49` |

---

## Steps

Every step ends with `node ../scripts/verify.mjs --baseline L08-skill-stats --related <files>` in its package.

### Phase A — contract (both packages)

1. **server + client** · `{server,client}/src/vendor/shared/contracts/agent-performance.ts` (edit), `…/contracts/skill-stats.ts` (new), `…/index.ts` · skill `zod` · covers R-27, R-10, R-14, R-15, R-17, R-19, R-20, R-26, R-79 (shapes)
   - `## Contract` (a)–(c) verbatim. Checkpoint: `diff -r server/src/vendor/shared client/src/vendor/shared` → empty; `pnpm typecheck` in both packages. **Expected red, and only these:** server — `buildStats` does not yet return `findings` (cleared by step 3); client — `src/test/agent-performance-fixtures.tsx` `statsReport()` lacks `findings` (the client stream edits that fixture **first**, before step 9). Phase 1a reports both and fixes neither.

### Phase B — server stream (steps 2–8)

2. **server** · `modules/agent-performance/types.ts` · covers R-01, R-11 · D-4, D-5
   - Add `BreakdownRow { agentId: string | null; category: string; severity: string; accepted: number; dismissed: number; pending: number }`, `AgentRunCount { agentId: string; runs: number }`, `PerfSkillRef { id: string; name: string; enabled: boolean }`.
   - Extend `PerformanceReadSource` with: `getSkill(ws, skillId): Promise<PerfSkillRef | undefined>`, `listSkillIds(ws): Promise<string[]>` (name asc, id), `usingAgents(ws, skillId): Promise<PerfAgentRef[]>`, `runCountsByAgent(ws, range, agentIds): Promise<AgentRunCount[]>`, `findingBreakdown(ws, range, agentIds): Promise<BreakdownRow[]>`, `reviewedPrCount(ws, range): Promise<number>`, `prsWithSkill(ws, range, skillId?): Promise<Map<string, number>>`. Doc comments: current window only.
3. **server** · `modules/agent-performance/helpers.ts` · skills `onion-architecture`, `typescript-expert` · covers R-05, R-06, R-10, R-12 … R-15, R-17, R-19, R-20, R-26, R-42 (order), R-79 · D-5 … D-8
   - `foldBreakdown(rows): FindingsBreakdown` — zeroed counts; `category ∈ FindingCategory.options ? category : 'other'`, same for `Severity.options` (runtime import of the two zod enums from `@devdigest/shared` is fine on the server — Ring 1); `total = Σ (accepted + dismissed + pending)`.
   - `skillFigures(rows): SkillFindingFigures` (D-6, via `acceptRate`).
   - `pullFrequency(withSkill, reviewed): PullFrequency` — `rate = reviewed === 0 ? null : withSkill / reviewed`.
   - `buildSkillStats(range, skill, agents, runCounts, rows, reviewed, withSkill): SkillStatsReport` — `agents` mapped with `runs` (0 when absent, R-79), order kept from `usingAgents` (name, id); `used_by = agents.length`; `ran_in_period = agents.filter(runs > 0).length`; `figures`/`findings` from `rows`; `range: appliedRange(range)`.
   - `buildSkillsPullFrequency(range, skillIds, reviewed, withSkill: Map): SkillsPullFrequencyReport` — one entry per id, missing → 0.
   - `buildStats(range, agent, groups, tallies, breakdown: BreakdownRow[] = [])` → adds `findings: foldBreakdown(breakdown.filter(r => r.agentId === agent.id))`.
4. **server** · `modules/agent-performance/repository.ts` · skills `drizzle-orm-patterns`, `onion-architecture`, `security`, perf rubric · covers R-01 … R-09, R-11, R-21, R-24, R-25 · D-4, D-5, D-7, D-8
   - `private findingStateColumns()` → `{ accepted, dismissed, pending }` SQL (the three filters now inline at `:94-96`); `findingTallies` switches to it (same SQL text, no behaviour change).
   - `getSkill`, `listSkillIds` (both `skills.workspace_id = ws`); `usingAgents` (D-4: `innerJoin(t.skills, eq(agentSkills.skillId, skills.id))`, `innerJoin(t.agents, eq(agentSkills.agentId, agents.id))`, `where(and(eq(agentSkills.skillId, id), activeSkillOnAgent(), eq(agents.workspaceId, ws), eq(skills.workspaceId, ws)))`, `orderBy(agents.name, agents.id)`).
   - `runCountsByAgent(ws, range, ids)` and `findingBreakdown(ws, range, ids)`: `countedRunsWhere(ws, range.from, range.to)` **current window only**, `inArray(agentRuns.agentId, ids)`; `[]` → return `[]` without a query (D-8). Breakdown joins `reviews` on `run_id` + `reviews.workspace_id = ws`, then `findings`; groups by agent id, category, severity.
   - `reviewedPrCount(ws, range)`: `count(distinct pr_id)::int` with `isNotNull(agentRuns.prId)`.
   - `prsWithSkill(ws, range, skillId?)`: from `agentRuns` ⨝ `agents` (`agents.id = agent_runs.agent_id`) ⨝ `agentSkills` ⨝ `skills`, `activeSkillOnAgent()`, both workspace checks, `isNotNull(prId)`, optional `eq(skills.id, skillId)`, `GROUP BY skills.id` → `Map`.
   - Import `activeSkillOnAgent` from `../../db/skill-gates.js`. Header comment: read-only over `agents`, `agent_runs`, `reviews`, `findings`, **`skills`, `agent_skills`**; every statement workspace-scoped (R-25). All values bound; no `sql.raw`.
5. **server** · `modules/agent-performance/service.ts` · skills `onion-architecture`, perf rubric · covers R-19 … R-24, R-26 · D-3, D-8
   - `skillStats(ws, skillId, range)` per D-8. `skillsPullFrequency(ws, range)`: probe → `Promise.all([listSkillIds, reviewedPrCount, prsWithSkill(ws, range)])` → `buildSkillsPullFrequency`.
   - `agentStats` adds `repo.findingBreakdown(ws, range, [agent.id])` to its `Promise.all` and passes it to `buildStats` (R-26). `dashboard` unchanged.
6. **server** · `modules/agent-performance/routes.ts` · skills `fastify-best-practices`, `onion-architecture`, `security`, `zod` · covers R-19 … R-23
   - `app.get('/skills/pull-frequency', { schema: { querystring: PerfRangeQuery, response: { 200: SkillsPullFrequencyReport } } }, …)` and `app.get('/skills/:id/stats', { schema: { params: IdParams, querystring: PerfRangeQuery, response: { 200: SkillStatsReport } } }, …)` — one line each up to the path; handler `getContext` → `toPerfRange(req.query)` → service. Header comment lists all four routes and the static-path note (D-1).
   - Checkpoint: `pnpm arch` → no new violation; `pnpm typecheck` green.
7. **server** · `server/test/skill-stats-helpers.test.ts` (new, unit) · covers R-05, R-06, R-10, R-12 … R-15, R-17, R-20, R-26, R-79 — cases U1–U7, appendix §C.
8. **server** · `server/test/skill-stats.it.test.ts` (new, integration; own fixtures modelled on `agent-performance.it.test.ts:39-120`, explicit `category`/`severity` per finding) · covers R-01 … R-26, R-48 (server half), R-68 (server half), R-72, R-78, R-79 — cases I1–I20, appendix §C. Scratch-tsconfig typecheck of both test files.

### Phase C — client stream (steps 9–20)

9. **client** · `src/lib/perf-range.ts`, `src/lib/hooks/agent-performance.ts` · covers R-31, R-33, R-73 · D-9, D-11
   - Move the private `rangeQuery` of `hooks/agent-performance.ts:17-24` to `perf-range.ts` as exported `perfRangeQuery(range, tz, bucket)`; the hook file imports it (no behaviour change).
   - `lastThirtyDays(now: Date): PerfRange` = `resolveRange(DEFAULT_CHOICE, now)` (720 h).
   - `captionWindow(choice, applied: { from: string; to: string }): { kind: 'preset'; preset: PerfPreset; start: Date; end: Date } | { kind: 'custom'; start: Date; lastDay: Date }` — custom `lastDay = to − 1 ms` (G-02). `captionNeedsYear(dates, now)` per OQ-4 A.
10. **client** · `src/lib/hooks/skill-stats.ts` (new) · covers R-30, R-52, R-58, R-70, R-73, R-74, R-76, R-77 · D-11, D-15
    - `skillStatsKey(id, from, to, tz)`, `useSkillStats(skillId, range)` → `api.get<SkillStatsReport>('/skills/<id>/stats?' + perfRangeQuery(range, tz, 'day'))`, `enabled: !!skillId`, retry/404 per D-15.
    - `useSkillsPullFrequency()` — `const [mountedAt] = useState(() => new Date())`, `lastThirtyDays(mountedAt)`, key `['skills-pull-frequency', from, to, tz]`, `select` → `Map<skill_id, PullFrequency>`. GET only, no polling, no `placeholderData`. Imported directly, not through the hooks barrel.
11. **client** · `src/lib/skills.ts` · covers R-29, R-53 · D-14 — `skillEditorHref(skillId, tab, current)`, same body as `agentEditorHref`.
12. **client** · `messages/en/agentPerformance.json`, `messages/en/skills.json` (add keys) · covers R-56 · D-16 — key list and texts: appendix §B (D-16).
13. **client** · `src/components/perf-range-control/RangeCaption.tsx` (+ `styles.ts` entry, `index.ts` export) · covers R-31, R-32, R-33 · D-9
    - `RangeCaption({ choice, applied }: { choice: PerfRangeChoice; applied: { from: string; to: string; tz: string } | undefined })` → `null` without `applied`; else one `<p>` with the caption.
14. **client** · `src/components/findings-widget/` (new: `FindingsWidget.tsx`, `_components/CategoryDonut/`, `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts`) · covers R-59 … R-68, R-70 · D-10
    - `constants.ts`: `CATEGORY_ORDER = ['security','bug','perf','style','test'] as const` with a compile-time check against the contract's keys, `SEVERITY_ORDER`, `CATEGORY_COLOR`, `SMALL_SAMPLE_FINDINGS = 5`, `DONUT_SIZE`, `DONUT_STROKE`.
    - `helpers.ts`: `categoryEntries(f)`, `severityEntries(f)` (fixed order, `other` only when > 0), `entryPercent(count, total)`, `isSmallFindingsSample(total)`.
    - `CategoryDonut`: recharts `PieChart`/`Pie`/`Cell`, `isAnimationActive={false}`, fixed size, centre total as an absolutely positioned span inside the `role="img"` box (the total is also in the label text, R-66). Severity row: `Icon[SEV[sev].icon]` (`aria-hidden`) + label + "count · p%" in `SEV[sev].c`.
15. **client** · `app/agents/[id]/_components/AgentEditor/_components/StatsTab/StatsTab.tsx` (+ `styles.ts`), `app/agent-performance/_components/AgentPerformanceView/AgentPerformanceView.tsx` (+ `styles.ts`) · covers R-26 (display), R-32, R-57, R-69, R-70 · D-17
16. **client** · `app/skills/[id]/_components/SkillEditor/constants.ts`, `SkillEditor.tsx`, `app/skills/[id]/page.tsx` · covers R-29, R-34, R-53 · D-14
    - `TABS`: insert `{ key: "stats", labelKey: "editor.tabs.stats", icon: "Activity" }` between preview and versions; replace the comment at `constants.ts:18-22` (the tab is now built). `SkillEditor` renders `{tab === "stats" && <StatsTab skill={skill} />}`. `VALID_TABS` follows `TABS`.
    - `page.tsx`: `setTab` → `router.replace(skillEditorHref(id, next, search))`; rail click → `router.push(skillEditorHref(sk.id, tab, search))`.
17. **client** · `app/skills/[id]/_components/SkillEditor/_components/StatsTab/` (new: `StatsTab.tsx`, `_components/SkillKpiCards/`, `_components/SkillAgentsList/`, `constants.ts`, `styles.ts`, `index.ts`) · covers R-28 … R-31, R-35 … R-52, R-54, R-55, R-58, R-80, R-81 · D-12, D-13, D-15
    - `StatsTab({ skill })`: `usePerfRange()` + `useRangeLabels(choice)` + `useSkillStats(skill.id, range)`. Header: h2, `RangeControl`, `RangeCaption applied={q.data?.range}` (R-28 … R-31). Error → `ErrorState` with the message + Retry (R-51). Pending → skeletons in the 4 KPI slots, the list and the widget, no digit (R-50). Data → R-48 note when `!report.skill.enabled` (above the KPIs), `SkillKpiCards`, the R-81 note, then a responsive two-column area (`grid-cols-1 lg:grid-cols-2`, R-54) with `SkillAgentsList` and `<FindingsWidget findings={report.findings} emptyLabel={t('findings.empty', { range: labels.sentence })} />` (R-47). A zero-run range keeps all of it (R-49).
    - `SkillKpiCards({ report, rangeSentence })`: wrapping grid (`grid-cols-[repeat(auto-fit,minmax(200px,1fr))]`, R-54). Used by "<N> agents" + "<M> ran in period" (R-36); Pull frequency "<p>% (<n>/<d> PRs)" + "PRs reviewed in the period", or "—" + "No reviewed PRs in <range>" (R-37, R-38); Accept rate `AcceptRateValue variant="kpi" figures={report.figures}` (R-39, R-40, D-12); Findings `report.findings.total` (R-41).
    - `SkillAgentsList({ agents, choice, applied })`: heading "Agents using this skill"; `agents.length === 0` → "No agent uses this skill" + "Attach it on an agent's Skills tab" (R-46); rows in the order received (name asc, R-42): name, "Disabled" badge when `!enabled` (R-45), "<n> runs" (R-80), `Link` per D-13 (R-43, R-44, R-55).
18. **client** · `app/skills/_components/SkillCard/` (`SkillCard.tsx`, `helpers.ts`, `index.ts`, new `_components/PullFreqBadge/`), `app/skills/_components/SkillsListView/SkillsListView.tsx`, `app/skills/[id]/page.tsx` · covers R-71, R-73 … R-77, R-82, R-83 · D-11
    - Both parents call `useSkillsPullFrequency()` once and pass `pullFrequency={toCardPullFreq(q, sk.id)}` to every card.
19. **client** · tests for `lib/perf-range.ts` (extend `perf-range.test.ts`), new `lib/skills.test.ts`, new `lib/hooks/skill-stats.test.tsx` — cases L1–L6, appendix §C.
20. **client** · component tests (new `FindingsWidget.test.tsx`, `RangeCaption.test.tsx`, skill `StatsTab.test.tsx`, `SkillKpiCards.test.tsx`, `SkillAgentsList.test.tsx`, `app/skills/[id]/page.test.tsx`; extended agent `StatsTab.test.tsx`, `AgentPerformanceView.test.tsx`, `SkillCard.test.tsx`, `SkillsListView.test.tsx`, `SkillEditor` tab-order case) + `src/test/agent-performance-fixtures.tsx` (`statsReport()` gains `findings`; new `skillStatsReport()` builder) — cases C1–C12, appendix §C.

## Execution

Chosen by the user (OQ-1 A, D-19): multi-agent, parallel streams, run by `/run-plan specs/L08-skill-stats.md` — no `--test-writer` (tests go to the stream implementers), no phase 0 cross-model review.

| Phase | Agent | Steps | Reads | Produces | Parallel with |
|---|---|---|---|---|---|
| 0 | `implementer` | baseline | this file | `--save-baseline L08-skill-stats` in `server/` (`--it`) and `client/` | — |
| 1a | `implementer` | 1 | this file | both contract copies, `diff -r` output, both typecheck outputs (server red only on `buildStats`, expected) | — |
| 1b | `implementer` (server) | 2–8 | this file, appendix §C | server tree + tests + verify `--it` output (skipped count read) | 1c |
| 1c | `implementer` (client) | 9–20 | this file, appendix §B, §C | client tree + tests + verify + `next lint` output | 1b |
| 2 | `plan-verifier` — **full** pass | 1–20, R-01 … R-83 | this file + the requirements | verdict per item | all phase-2 reviewers |
| 2 | `architecture-reviewer` | — | the open change | findings (`pnpm arch` first) | all |
| 2 | **security lens** — `security` skill + `docs/agent-prompts/security-reviewer.md`, with `zod`, `fastify-best-practices`, `drizzle-orm-patterns` | — | the open change; focus: workspace scoping of the six new reads, `inArray([])`, 404 vs 422, querystring | findings | all |
| 2 | **`/code-review`** (correctness bugs) | — | the open change | findings | all |
| 2 | frontend lenses `react-best-practices`, `next-best-practices` + perf rubric on step 4 | — | the open change (client) | findings | all |
| 3 | `implementer` — fix rounds (resume the stream; a fresh one for a small late round or a stream past ~100 requests / ~15M input), until no CRITICAL / WARNING / gap / test is open, max 3 | findings | `.devdigest/cache/sdd/L08-skill-stats/findings.md` | fixes + verify output | — |
| 4 | main session — **browser smoke** | — | — | `/skills`, `/skills/:id?tab=stats` (1 day, 30 days, custom; Open → agent tab), `/agents/:id?tab=stats`, `/agent-performance`; console free of route errors; one pull-frequency GET per page | — |
| 5 | `/pr-self-review` (main session) | — | the open change | gate verdict; should confirm, not discover | — |
| 6 | wrap-up: `/engineering-insights`, `specs/L08-skill-stats.verification.md`, `/workflow-retro` | — | — | — | — |

Every phase-2 prompt names `findings.md`, this plan's `## Decisions` and the requirements' `## Decisions` as inputs to read **before** rating severity, and (client) "confirm a React API exists in Next's bundled React before recommending it". `doc-writer` only with `--docs` (a `docs/` page on skill attribution and pull frequency).

**File ownership (1b ∥ 1c).** Disjoint; a writer never edits, checks out or stashes another's paths, and nobody commits.

| Writer | Owns |
|---|---|
| 1a contract | `server/src/vendor/shared/**`, `client/src/vendor/shared/**` (read-only for 1b / 1c afterwards) |
| 1b server | `server/src/modules/agent-performance/**`, `server/test/skill-stats-helpers.test.ts`, `server/test/skill-stats.it.test.ts` |
| 1c client | `client/src/lib/{perf-range,perf-range.test,skills,skills.test}.ts`, `client/src/lib/hooks/{agent-performance.ts,skill-stats.ts,skill-stats.test.tsx}`, `client/src/components/{perf-range-control,findings-widget}/**`, `client/src/app/agents/[id]/_components/AgentEditor/_components/StatsTab/**`, `client/src/app/agent-performance/_components/AgentPerformanceView/**`, `client/src/app/skills/**`, `client/src/test/agent-performance-fixtures.tsx`, `client/messages/en/{agentPerformance,skills}.json` |


## Verification

| Package | Baseline (phase 0) | After each step | Final |
|---|---|---|---|
| server | `node ../scripts/verify.mjs --save-baseline L08-skill-stats --it` | `… --baseline L08-skill-stats --related <files>` | `… --baseline L08-skill-stats --it`; read the skipped count (0) |
| client | `node ../scripts/verify.mjs --save-baseline L08-skill-stats` | `… --baseline L08-skill-stats --related <files>` | `… --baseline L08-skill-stats`, `pnpm exec next lint --dir src`, then `pnpm build` with `:3000` free (`netstat -ano \| findstr :3000`) |

Also: `diff -r server/src/vendor/shared client/src/vendor/shared` → empty; `git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty; `client/pnpm-workspace.yaml` absent. Pre-existing failures are labelled `baseline`.

## Done when

- [ ] R-27: `diff -r` of the two `vendor/shared` trees empty; both packages typecheck.
- [ ] R-01, R-02, R-04 … R-06, R-19, R-48 (server): I1, I2, I4, I5, I12, I19 — used_by equals `GET /skills` `agent_count`; attach-after-run counts, detach removes; a deleted agent's run is never attributed.
- [ ] R-03, R-07 … R-10: I3, I6, I7 — two using agents on one PR count once; null-PR runs excluded from both; rate null at 0/0.
- [ ] R-11 … R-16, R-26, R-68 (server): I8, I9, I18 — "other" buckets; per-category and per-severity sums = total = accepted + dismissed + pending; single-agent skill equals the agent's stats field by field.
- [ ] R-17, R-18, R-20, R-72, R-78: I10, I11 — every skill's entry in the pull-frequency read equals its stats read for the same 30-day range.
- [ ] R-21 … R-25: I13 … I17 — 404 unknown/foreign skill; 422 on bad range, early range and `US/Pacific-New` (also empty); zero mock calls and unchanged row counts; foreign workspace never counted. I20: `/skills/pull-frequency` answers 200 with the report shape.
- [ ] R-28 … R-33: C2, C3, C11 — caption formats, caption from the response range, range kept in the address with the tab.
- [ ] R-34, R-53: C10, C11 — tab order Config / Preview / Stats / Versions / Context; rail click keeps tab and range.
- [ ] R-35 … R-52, R-54, R-55, R-58, R-79 … R-81: C4 … C6 and I5 — every KPI text, list row, empty/off/attribution notes, skeleton without digits, error + Retry, GET only, 404 → page not-found state.
- [ ] R-59 … R-70: C1, C7 — one component on both tabs; legend/severity order and zeros; per-entry rounding; small sample 1–4; empty state; fixed colours; widget below the tiles and above the note; no extra request.
- [ ] R-71 … R-77, R-82, R-83: C8, C9, L4 — card text in grid and rail, "— pull freq", placeholder, failure → count only, one request for all cards, hint as accessible description.
- [ ] R-57: the predecessor's suites stay green (`agent-performance*.test.ts`, `StatsTab.test.tsx`, `AgentPerformanceView.test.tsx`, …) with only the caption/widget/fixture additions.
- [ ] R-56: no hard-coded user-facing string (gate G12).
- [ ] `pnpm arch` no new violation; `pnpm build` green; no lockfile, schema or migration change; browser smoke clean (phase 4).

## Left to reviewers

- architecture: a second read family (skills) in `agent-performance` (D-1, REC-1); the module now reads `skills` and `agent_skills` read-only and imports `db/skill-gates.ts`; `/skills/*` routes registered outside the skills module; `findings-widget` and `RangeCaption` placement; `SkillCard` gaining one Tailwind hook class.
- security: workspace scoping of `getSkill`, `usingAgents`, `prsWithSkill` (both `agents` and `skills` checked), `findingBreakdown` (reviews workspace check); 404 for a foreign skill id; no write path; querystring validated before the handler; zone probed first.
- performance (perf rubric): five statements per skill-stats request (probe + 4 in `Promise.all`), `count(distinct pr_id)` over the range without a `(workspace_id, status, ran_at)` index; the pull-frequency read joins four tables per page load.

## Risks / open questions

| Question | Blocks which step | Needs |
|---|---|---|
| Current-attachment attribution (decision 5) re-attributes past runs on attach/detach — by design, labelled by R-81 | — | accepted in the spec |
| The reads are separate statements; an attach or a decision landing between them can make one answer off by one (e.g. `used_by` vs the numerator) | — | accepted (predecessor precedent); `REPEATABLE READ` if reviewers object |
| No `(workspace_id, status, ran_at)` index (REC-3) | 4 | a later migration |
| In jsdom the Tailwind `hidden` class does not hide the hint, so it joins the card button's accessible name in tests; `SkillCard` tests match names with a regex or by the skill name | 18, 20 | — |
| recharts renders no layout in jsdom; widget tests assert the `role="img"` name, legend and severity text only | 14, 20 | — |
| Category colours: security red sits next to CRITICAL red in the same widget (R-67 as drawn); text carries every value (R-66) | 14 | accepted (G-16) |
