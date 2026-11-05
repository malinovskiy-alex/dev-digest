# L08 — Agent Performance · implementation plan

**Requirements:** `specs/L08-agent-performance.requirements.md` (Status: Approved 2026-11-05, **R-01 … R-112**, accepted UX items = R-90 … R-105, Q-11 = R-106 … R-112)
**Decisions:** `specs/L08-agent-performance.decisions.md` — full requirements check, rationale, test-case lists
**Execution:** multi-agent — contract step, then server ∥ client streams — chosen by the user, 2026-11-05 (OQ-1 A)
**Branch:** `lesson/L08-homework` (the current branch; never `main`)
**Plan status:** revision 3, 2026-11-05 — **ready for `/run-plan`**. Revision 2 applied the user's answers (D-18 … D-27); revision 3 maps them to R-90 … R-105, aligns D-18/D-21/D-22 with the spec's wording, and adds Q-11 (D-28). Only `implementation-planner` edits this file.

**Built from scratch** (`INSIGHTS.md:121-133`): no git-history search, no restore of a removed dashboard. `blast`, `brief` and `agents` are read for conventions only.

**Accepted UX items are R-90 … R-105 in the requirements file** (revision 3 of this plan, 2026-11-05). D-18 … D-28 implement them; the map is in `## Requirements check`. Q-11 (Stats tab gets delta, trend **and** colour band, no sparkline) was answered **yes** by the user and is R-106 … R-112, implemented by D-28.

---

## Answered questions (user, 2026-11-05)

| ID | Answer | Where it lands |
|---|---|---|
| OQ-1 | A — multi-agent, parallel streams | `## Execution` |
| UX-01 | **include** — runs sparkline, per-day buckets in the browser TZ, per-hour for "1 day"; buckets from the server read (R-90 … R-92) | D-18, D-19 · steps 1, 3, 4, 7, 15 |
| UX-02 | **include** — cost delta vs the previous window of equal length, labelled as a DevDigest-estimate difference | D-20, D-21 · steps 1, 3, 4, 12, 15, 18 |
| UX-03 | **include** — accept-rate trend arrow per row vs the same previous window | D-20, D-22 · steps 1, 3, 12, 16, 18 |
| UX-04 | **include** — accept ring in the Avg accept card, hidden when the rate is unknown | D-24 · step 15 |
| UX-05 | **include** — bands ≥ 70 % green, 50–69 % amber, < 50 % red; text stays primary; small sample neutral | D-23 · steps 7, 12, 15, 16, 18 |
| UX-08 | **include** — agent colour from the agent id, same in table and donut; "Deleted agents" fixed neutral | D-25 · steps 8, 16, 17 |
| UX-10 | **include** | step 20 |
| UX-06, UX-07, UX-09 | **deferred** | — |
| Q-01 | count `ci` and `local` alike | step 4 |
| Q-02 | later last run, then name | step 3 |
| Q-03 | last run in range | steps 3, 4 |
| Q-04 | all finding kinds | step 4 |
| Q-05 | no cap | steps 1, 7 |
| Q-06 | no "Other" grouping | steps 3, 17 |
| Q-07 | house cost format (`$0.040`) | steps 7, 12, 15–18 |
| Q-10 | browser time zone | steps 7, 9 |
| REC-3 | frontend lenses + perf rubric in phase 2 | `## Execution` |

Q-08 was decided by the planner (D-1, D-2). Q-09 is moot.

## Requirements check

Full table for R-01 … R-89: appendix §A. **R-01 … R-89: 78 ok · 7 planner detail (R-22, R-26, R-34, R-40, R-45, R-56, R-65) · 4 by construction (R-01, R-29, R-30, R-77).** **R-90 … R-112: 22 ok, 1 by construction (R-106)** (below). Blocked: none · already holds: none.

**R-31 note:** R-31's field list does not name the comparison or sparkline fields; R-31 says "at least", and the `## Contract` block carries them (`PerfComparison`, `range.previous`, `range.tz`, `totals.bucket_unit`, `totals.run_buckets`) in both copies — so R-31 covers them by its own wording.

| Req | Verdict | Implemented by | Steps | Tests (appendix §C) |
|---|---|---|---|---|
| R-90 | ok | D-18, D-19 — one point per local day the range touches; per hour for the "1 day" preset | 1, 3, 4, 7, 9, 15 | 22.14, 23, 24 |
| R-91 | ok | D-18 — points sum to Total runs; empty bucket = 0 (`fillBuckets`) | 3, 7, 15 | 21.10, 23 |
| R-92 | ok | `aria-label` "Runs per day" / "Runs per hour" | 13, 15 | 24 |
| R-93 | ok | D-20 | 3, 4 | 21.10, 22.13 |
| R-94 | ok | D-21 — signed house format, "estimate difference vs previous period" | 3, 7, 12, 15 | 21.11, 24 |
| R-95 | ok | D-21 — null unless both totals known | 3, 12 | 21.11, 22.12, 24 |
| R-96 | ok | D-22 — whole-percent compare; "up from <p>%" / "down from <p>%" | 3, 12, 16 | 21.11, 24 |
| R-97 | ok | D-22 — no arrow when either rate unknown | 3, 12, 16 | 21.11, 24 |
| R-98 | ok | D-24 | 15 | 24 |
| R-99 | ok | D-24 | 15 | 24 |
| R-100 | ok | D-23 — KPI, Most-active card, table rows (+ Stats tab, Q-11) | 7, 12, 15, 16, 18 | 23, 24 |
| R-101 | ok | D-23 — neutral on decided < 5 or unknown | 7, 12 | 23, 24 |
| R-102 | ok | D-25 | 8, 16, 17 | 23, 24 |
| R-103 | ok | D-25 — the neutral is not in `AGENT_PALETTE` | 8, 16, 17 | 23, 24 |
| R-104 | ok | step 20 | 20 | 24 |
| R-105 | ok | step 20 | 20 | 24 |
| R-106 | ok, by construction | D-26, D-28 — `comparison.previous_total_cost_usd` / `previous_accept_rate` in both reads from the same fold; R-01 equality covers them | 1, 3 | 21.12, 22.12 |
| R-107 | ok | D-28 — `CostDelta` on the Stats tab (R-94 rules) | 18 | 24 (`StatsTab`) |
| R-108 | ok | D-28 — `CostDelta` renders nothing when `cost_delta_usd` is null | 18 | 24 (`StatsTab`) |
| R-109 | ok | D-28 — `AcceptRateValue` with `comparison`, same text as the row | 18 | 24 (`StatsTab`) |
| R-110 | ok | D-28 — no arrow when `accept_trend` is null | 18 | 24 (`StatsTab`) |
| R-111 | ok | D-28 — `acceptBand` (R-100/R-101 rules) | 18 | 24 (`StatsTab`) |
| R-112 | ok | D-26, D-28 — no `Sparkline` in `StatsTab` | 18 | 24 (`StatsTab`) |

## Decisions

Planner decisions unless marked. Rationale for D-1, D-3, D-8, D-11, D-13, D-19, D-20: appendix §B.

| ID | Question | Answer |
|---|---|---|
| D-1 | Q-08 — contract and routes | **New file** `vendor/shared/contracts/agent-performance.ts` (both trees). The unused `AgentStats` (`observability.ts:96`) and `AgentPerf` (`productionize.ts:174`) get a one-line `@deprecated` comment. Routes `GET /agents/performance` and `GET /agents/:id/stats`. Fastify prefers the static segment, so `/agents/performance` is not captured by `/agents/:id` (`agents/routes.ts:104`); a test proves it |
| D-2 | Range on the wire | Query `from`, `to` (ISO-8601 with offset, required, `from < to`) and `tz` (IANA name, required, D-19) → 422 via the global handler (`app.ts:140-148`). Echo `range` as ISO strings. No cap (Q-05) |
| D-3 | Aggregation | Module `server/src/modules/agent-performance/`. The reads cover `[previous.from, to)` and carry a `win` column (`current` when `ran_at >= from`, else `previous`, D-20): **(a) run groups** `GROUP BY win, agent_id, provider, model` → `runs`, `priced_runs = count(cost_usd)`, `cost_sum`, `timed_runs = count(duration_ms)`, `duration_sum`, `last_run_at = max(ran_at)`; **(b) finding tallies** `agent_runs ⨝ reviews (run_id, same workspace) ⨝ findings` `GROUP BY win, agent_runs.agent_id` → `accepted`, `dismissed` (dismissed and not accepted), `pending`; **(c) run buckets** (dashboard only, current window) D-18. Plus `listAgents` / `getAgent`. Pure folds in `helpers.ts` build both answers — one rule set (R-01) |
| D-4 | Postgres types | `count(...)::int`, `sum(...)::float8`, `max(ran_at)` → `Date`; an all-null `sum` stays `null` |
| D-5 | Table ownership | the repository reads `agents`, `agent_runs`, `reviews`, `findings` **read-only**; no other module's folder imported; the 404 uses its own `getAgent` |
| D-6 | Model segment labels | contract carries nullable `provider`, `model`; client label `model ?? "Unknown model"`, `provider/model` when one model id appears under two providers |
| D-7 | Client routes and URL | dashboard `/agent-performance`. Params: `range=1d\|30d\|custom`, `start`/`end` `YYYY-MM-DD` (custom), `at` ISO (pinned preset end, View link only). Invalid → 30 days, no error (R-39) |
| D-8 | Preset end instant | `usePerfRange` keeps `appliedAt` (mount, reset on every `apply`); preset `to = at ?? appliedAt`, `from = to − 24 h \| − 720 h`; the View link pins `at = range.to` |
| D-9 | Range label | `(1D)`, `(30D)`, custom `(<start> – <end>)` with `format.dateTime(d, { day: 'numeric', month: 'short', year: 'numeric' })`; sentence forms "the last day" / "the last 30 days" / "<start> – <end>" |
| D-10 | "DevDigest estimate" placement (R-45) | caption under the Total cost value; second line of the Avg cost header; Cost breakdown heading; caption under Total/Avg cost on the Stats tab. R-46's note once per screen |
| D-11 | Accept-rate sort | tiers A (`decided ≥ 5`, by rate) → B (`1–4`, decided desc) → C (`0`), same tier order both directions; ties → label asc, then id. Other columns: nulls last both directions |
| D-12 | Long names (R-65) | `truncate` inside the expand `<button>`; full name in its accessible name and in a `HoverNote` tooltip |
| D-13 | Charts | route-private `CostDonut` on `recharts` (already a dependency, `client/package.json:22`), legend is our own `<ul>` with `formatCostUsd`; the vendored `Donut` is not used. Sparkline: the vendored `Sparkline` (`vendor/ui/charts/Sparkline.tsx`), used as is |
| D-14 | `HoverNote` | promoted to `client/src/components/hover-note/` (second consumer); `BriefHeader.tsx:16` imports the new path |
| D-15 | Hooks barrel | `lib/hooks/agent-performance.ts` imported directly; `lib/hooks/index.ts` untouched |
| D-16 | Messages | every dashboard and Stats-tab string in the existing unused `messages/en/agentPerformance.json` (replaced whole); the sidebar label stays in `nav.ts` |
| D-17 | Commits (main session) | (1) spec + plan + appendix; (2) steps 1–20 after the review/fix loop; (3) tests 21–24. No lockfile change |
| D-18 | UX-01 buckets (R-90, R-91) | unit `hour` **only for the "1 day" preset** (the client sends `bucket=hour`), else `day` (`bucket=day`, also for a custom single day — R-90). SQL: `to_char(date_trunc(<unit>, ran_at AT TIME ZONE $tz), <fmt>)`, fmt `YYYY-MM-DD` or `YYYY-MM-DD"T"HH24`; `<unit>`/`<fmt>` come from a two-entry constant map, never from input. The server returns **non-empty buckets only** (`{ key, runs }`, key asc) plus `bucket_unit`; the client fills the zeros with one point per local day (or hour) **from the bucket of `from` to the bucket of `to − 1 ms`, inclusive** — so a rolling 30-day range not starting at midnight has 31 points — in the same TZ (`fillBuckets`, step 7). Points sum to `totals.runs` (R-91). A range with one bucket renders a single dot, not a line (the vendored `Sparkline` divides by `length − 1`). Counted-run rules are the same as every figure (current window only). On a DST fall-back day the repeated local hour merges into one bucket; a spring-forward hour is simply absent |
| D-19 | UX-01 time zone (R-90) | the client sends `tz = Intl.DateTimeFormat().resolvedOptions().timeZone` and `bucket` on **both** reads (so both query strings stay alike; the stats read ignores `bucket`); the contract refine accepts a name only if `new Intl.DateTimeFormat('en-US', { timeZone })` does not throw and it matches `^[A-Za-z0-9_+\-/]{1,64}$`. Passed to SQL as a bound parameter |
| D-20 | UX-02/03 previous window | `previous = [from − (to − from), from)` — equal length, immediately before (custom ranges too). Same counted-run rules. Computed by the same reads as the current window (`win` column), so the previous figures follow R-01's one rule set |
| D-21 | UX-02 unknown rule and label (R-94, R-95) | `cost_delta_usd = current.total − previous.total` only when **both** are non-null; otherwise `null` → **nothing is shown** (no delta, never "$0", never a difference against 0 — R-95). Shown as `+$0.120` / `−$1.200` (`formatCostUsd` of the absolute value, "−" is U+2212) followed by the label "estimate difference vs previous period" (R-94, verbatim). Neutral colour: a cost change is not judged good or bad |
| D-22 | UX-03 trend rule (R-96, R-97) | `accept_trend` = `up` / `down` / `flat` by comparing `acceptPercent` (whole percent) of the two windows; **`null` when either rate is null** (R-97). No small-sample suppression — R-96 shows an arrow whenever both rates are known; the small sample is already marked by the badge and the neutral band. `up`/`down` → arrow icon (`aria-hidden`) + visually hidden "up from <p>%" / "down from <p>%" with `p = acceptPercent(previous_accept_rate)` (R-96, verbatim); `flat` and `null` → no arrow, no text. Neutral arrow colour (the band carries quality) |
| D-23 | UX-05 bands (R-100, R-101) | `acceptBand(rate, decided)`: **`neutral` when `rate === null` or `decided < 5`** (`var(--text-secondary)`; the "Small sample" badge stays — R-101); else by the **displayed** whole percent: `≥ 70` → `good` (`var(--ok)`), `50–69` → `warn` (`var(--warn)`), `< 50` → `bad` (`var(--crit)`). Colours the percentage text on the Avg accept KPI, **the Most-active card**, every table row and the Stats tab (Q-11), and the ring stroke (KPI); the number and denominator are always printed (R-100) |
| D-24 | UX-04 ring (R-98, R-99) | route-private `AcceptRing` (own small SVG; `CircularScore` hard-codes 75/50 thresholds and is not used), filled to `acceptPercent(totals.accept_rate)`, stroke from `acceptBand` over the pooled totals; **not rendered at all** when `totals.accept_rate === null` (R-99); `aria-hidden="true"` (R-98) |
| D-25 | UX-08 colours (R-102, R-103) | `client/src/lib/perf-colors.ts`: `AGENT_PALETTE` — 8 fixed categorical hex colours legible on both themes, distinct from `--ok`/`--warn`/`--crit` and **containing no grey**, so the neutral can never be derived for an existing agent (R-103); `agentColor(agentId)` = FNV-1a 32-bit of the id, mod 8; `DELETED_AGENT_COLOR` and `UNKNOWN_MODEL_COLOR` = `var(--info)`; `modelColor(provider, model)` = same hash over `provider/model`. Used by the table swatch (`aria-hidden`) and both donuts. Two agents may share a colour — the legend text carries the meaning (R-69) |
| D-26 | R-01 for the new fields | `comparison` lives in **both** `AgentStatsReport` and every `AgentPerfTableRow`, from the same fold; the R-01 integration test asserts deep equality of `figures`, `comparison` and `cost_by_model`. The Stats tab **shows** the cost delta, the accept trend and the band from `comparison`/`figures` (D-28). The sparkline is **dashboard-only** (totals), so it has no per-agent twin and the Stats tab does not show one |
| D-27 | Totals comparison | `totals.comparison` uses the same `compare()` helper over the pooled totals: the KPI shows its `cost_delta_usd` (UX-02). Its `accept_trend` is computed but not displayed (not requested) |
| D-28 | Q-11 — Stats tab extras (user, 2026-11-05: **yes**; R-106 … R-112) | the Stats tab shows, for the same agent and window, exactly what that agent's dashboard row shows: the cost delta (`CostDelta`, R-94/R-95 rules), the trend arrow (R-96/R-97 rules) and the accept-rate colour band (R-100/R-101 rules, neutral on a small sample or unknown rate) — the same components over the same `comparison` and `figures` fields, so R-01's equality covers them. No sparkline, no ring, no agent colour marker on the Stats tab. R-106 (previous values in both reads), R-107/R-108 (delta), R-109/R-110 (trend), R-111 (band), R-112 (no sparkline) |

## Recommendations

| ID | Recommendation | Why / cost of not doing it | Status |
|---|---|---|---|
| REC-1 | Promote `HoverNote` instead of copying it (D-14) | a copy is the drift the frontend skill forbids; one L05 import changes | прийнято (planner, structural rule) |
| REC-2 | Index `agent_runs (workspace_id, status, ran_at)` | both reads filter on exactly these; today only `(workspace_id, pr_id, ran_at)` and `(status)` exist (`runs.ts:49-51`). With the previous window each read now scans twice the time span | **відхилено by the spec** ("no migration") — in `## Risks` |
| REC-3 | Frontend lenses + perf rubric in phase 2 | L05: 4 of 8 pre-PR findings were frontend-lens only | **прийнято** (user, 2026-11-05) → `## Execution` phase 2 |

## Touches

server: `vendor/shared/contracts/agent-performance.ts` (new) + `vendor/shared/index.ts` + comments in `contracts/observability.ts`, `contracts/productionize.ts`; `modules/agent-performance/**` (new); `modules/index.ts`
client: the same contract files mirrored; `lib/perf-range.ts`, `lib/perf-format.ts`, `lib/perf-colors.ts`, `lib/hooks/agent-performance.ts` (new); `components/{hover-note,perf-range-control,accept-rate-value,last-run-time,cost-estimate-note,cost-delta}/` (new; hover-note moved); `app/agent-performance/**` (new); `app/agents/[id]/page.tsx`, `…/AgentEditor/{AgentEditor.tsx,constants.ts}`, `…/AgentEditor/_components/StatsTab/` (new); `…/PrBriefCard/_components/BriefHeader/BriefHeader.tsx` (import only); `vendor/ui/nav.ts`; `messages/en/agentPerformance.json`
**Not touched:** reviewer-core, mcp, e2e, any `package.json` or lockfile, `server/src/db/**`, any migration, `server/src/platform/**`, `modules/agents/**`, `modules/reviews/**`, `client/src/vendor/ui/**` except `nav.ts`, `.dependency-cruiser-known-violations.json`.

## Contract

Step 1, **byte-identical** in `server/src/vendor/shared/contracts/agent-performance.ts` and `client/src/vendor/shared/contracts/agent-performance.ts`. Both `vendor/shared/index.ts` gain `export * from './contracts/agent-performance.js';` after `productionize.js` and a header line `contracts/agent-performance  AgentPerfFigures, PerfComparison, AgentStatsReport, AgentPerformanceReport, PerfRangeQuery`. The client imports it **type-only** (`server/INSIGHTS.md:72-87`).

```ts
import { z } from 'zod';

/**
 * L08 — Agent Performance. One aggregation, two reads:
 *   GET /agents/:id/stats?from&to&tz   → AgentStatsReport
 *   GET /agents/performance?from&to&tz → AgentPerformanceReport
 * Counted run = this workspace, status 'done', from <= ran_at < to. Every cost is a
 * DevDigest estimate (agent_runs.cost_usd); a run without a stored cost is never added in.
 * The previous window is [from − (to − from), from), counted by the same rules.
 * Supersedes the unused AgentStats (observability.ts) and AgentPerf (productionize.ts).
 */

const TZ_SHAPE = /^[A-Za-z0-9_+\-/]{1,64}$/;
function isTimeZone(tz: string): boolean {
  if (!TZ_SHAPE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Querystring of both reads. ISO-8601 instants; start-inclusive, end-exclusive; IANA time zone for buckets. */
export const PerfRangeQuery = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    tz: z.string().refine(isTimeZone, { message: 'unknown time zone' }),
    /** Sparkline grain (R-90): 'hour' only for the "1 day" preset. Ignored by the stats read. */
    bucket: z.enum(['hour', 'day']).default('day'),
  })
  .refine((q) => Date.parse(q.from) < Date.parse(q.to), { message: 'from must be before to', path: ['to'] });
export type PerfRangeQuery = z.infer<typeof PerfRangeQuery>;

/** The range the server applied (R-14) and the previous window of equal length (UX-02). */
export const AppliedRange = z.object({
  from: z.string(),
  to: z.string(),
  tz: z.string(),
  previous: z.object({ from: z.string(), to: z.string() }),
});
export type AppliedRange = z.infer<typeof AppliedRange>;

/** One agent's figures for a window — identical on both reads (R-01). */
export const AgentPerfFigures = z.object({
  runs: z.number().int().nonnegative(),
  priced_runs: z.number().int().nonnegative(),
  /** runs − priced_runs: counted, but never added into a cost (R-06). */
  unpriced_runs: z.number().int().nonnegative(),
  /** null when no counted run has a cost (R-07). */
  total_cost_usd: z.number().nullable(),
  avg_cost_usd: z.number().nullable(),
  avg_duration_ms: z.number().nullable(),
  accepted: z.number().int().nonnegative(),
  dismissed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  /** accepted + dismissed — the accept-rate denominator. */
  decided: z.number().int().nonnegative(),
  /** accepted / decided, 0..1; null when decided = 0 (R-11). */
  accept_rate: z.number().nullable(),
  last_run_at: z.string().nullable(),
});
export type AgentPerfFigures = z.infer<typeof AgentPerfFigures>;

/** Current vs previous window. Unknown is null, never 0 (D-21, D-22). */
export const PerfComparison = z.object({
  previous_runs: z.number().int().nonnegative(),
  previous_total_cost_usd: z.number().nullable(),
  previous_decided: z.number().int().nonnegative(),
  previous_accept_rate: z.number().nullable(),
  /** current − previous total cost (estimate difference); null unless both are known. */
  cost_delta_usd: z.number().nullable(),
  /** whole-percent comparison of the two rates; null when either rate is unknown (R-96, R-97). */
  accept_trend: z.enum(['up', 'down', 'flat']).nullable(),
});
export type PerfComparison = z.infer<typeof PerfComparison>;

/** Cost of the counted priced runs of one provider+model; model null = "Unknown model" (R-22). */
export const PerfModelCost = z.object({
  provider: z.string().nullable(),
  model: z.string().nullable(),
  runs: z.number().int().nonnegative(),
  cost_usd: z.number(),
});
export type PerfModelCost = z.infer<typeof PerfModelCost>;

export const AgentStatsReport = z.object({
  range: AppliedRange,
  agent: z.object({ id: z.string(), name: z.string() }),
  figures: AgentPerfFigures,
  comparison: PerfComparison,
  /** cost desc, then label asc. */
  cost_by_model: z.array(PerfModelCost),
});
export type AgentStatsReport = z.infer<typeof AgentStatsReport>;

/**
 * A dashboard row: an existing agent, or every deleted agent's runs folded together (R-21).
 * Not named `AgentPerfRow`: that name is taken by productionize.ts:139 and both files share the barrel.
 */
export const AgentPerfTableRow = z.object({
  kind: z.enum(['agent', 'deleted']),
  /** null on the 'deleted' row. */
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  enabled: z.boolean().nullable(),
  figures: AgentPerfFigures,
  comparison: PerfComparison,
  cost_by_model: z.array(PerfModelCost),
});
export type AgentPerfTableRow = z.infer<typeof AgentPerfTableRow>;

export const PerfAgentCost = z.object({
  kind: z.enum(['agent', 'deleted']),
  agent_id: z.string().nullable(),
  agent_name: z.string().nullable(),
  runs: z.number().int().nonnegative(),
  cost_usd: z.number(),
});
export type PerfAgentCost = z.infer<typeof PerfAgentCost>;

/** Counted runs of the current window per local hour/day; non-empty buckets only, key asc (UX-01). */
export const PerfRunBucket = z.object({
  /** 'YYYY-MM-DD' (day) or 'YYYY-MM-DDTHH' (hour), local to range.tz. */
  key: z.string(),
  runs: z.number().int().positive(),
});
export type PerfRunBucket = z.infer<typeof PerfRunBucket>;

export const AgentPerformanceReport = z.object({
  range: AppliedRange,
  totals: z.object({
    runs: z.number().int().nonnegative(),
    unpriced_runs: z.number().int().nonnegative(),
    total_cost_usd: z.number().nullable(),
    accepted: z.number().int().nonnegative(),
    decided: z.number().int().nonnegative(),
    /** pooled: Σ accepted / Σ decided over all rows; null when Σ decided = 0 (R-18). */
    accept_rate: z.number().nullable(),
    comparison: PerfComparison,
    bucket_unit: z.enum(['hour', 'day']),
    run_buckets: z.array(PerfRunBucket),
  }),
  /** an existing agent's id, or null (R-19, R-20). */
  most_active_agent_id: z.string().nullable(),
  /** every workspace agent (R-24), plus the 'deleted' row when it has a counted run in the current window. */
  agents: z.array(AgentPerfTableRow),
  /** priced runs only, cost desc (R-23, R-67). */
  cost_by_agent: z.array(PerfAgentCost),
  cost_by_model: z.array(PerfModelCost),
});
export type AgentPerformanceReport = z.infer<typeof AgentPerformanceReport>;
```

Names checked: none of the new exports exists anywhere in `server/src` today. `AgentPerfRow` and `PerfCostSegment` are taken and not reused.

## Skill map

From `.claude/skills/pr-self-review/references/routing.md`, reconciled. `perf-prompt` is **not a skill**: "perf rubric" = read `docs/agent-prompts/performance-reviewer.md`.

| Step | Path | Skills the implementer loads |
|---|---|---|
| 1 | `*/vendor/shared/contracts/*.ts`, `*/vendor/shared/index.ts` | `zod` |
| 2, 3 | `modules/agent-performance/{constants,types,helpers}.ts` | `onion-architecture`, `typescript-expert` |
| 4 | `modules/agent-performance/repository.ts` | `drizzle-orm-patterns`, `onion-architecture`, `security` (the `tz` parameter and the unit map), perf rubric |
| 5 | `modules/agent-performance/service.ts` | `onion-architecture`, perf rubric |
| 6 | `modules/agent-performance/routes.ts`, `modules/index.ts` | `fastify-best-practices`, `onion-architecture`, `security`, `zod`, perf rubric |
| 7–9 | `client/src/lib/**` | `frontend-ui-architecture`, `typescript-expert`; `react-best-practices` for 9 |
| 10–12, 14–18, 20 | `client/src/{app,components}/**/*.tsx` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` |
| 13 | `client/messages/en/agentPerformance.json` | none (gate G12) |
| 19 | `client/src/vendor/ui/nav.ts` | **not covered by routing.md**. Planner's pick: `frontend-ui-architecture` |
| 21, 22 | `server/test/agent-performance*.ts` | **not in routing.md**. Planner's pick: `onion-architecture`, `drizzle-orm-patterns` for 22 |
| 23, 24 | `client/src/**/*.test.ts(x)` | `react-testing-library` |

## Constraints

| Constraint | Source |
|---|---|
| `@devdigest/shared` is two copies: edit both in step 1, `diff` them, typecheck both packages | `AGENTS.md` hard rules; `client/INSIGHTS.md:205-211` |
| the client imports **types only** from `@devdigest/shared`; runtime values are local consts; run `pnpm build` | `server/INSIGHTS.md:72-87` |
| new logic in `service.ts` + `repository.ts`, never queries in `routes.ts` | `server/INSIGHTS.md:160-172` |
| no import of another module's folder, not even `import type` | `server/INSIGHTS.md:128-144`; `.dependency-cruiser.cjs:121-131` |
| a service `new`s only its own repository | `server/INSIGHTS.md:174-186` |
| pure code in files named `helpers.ts` (the `DOMAIN` regex) so `core-no-io` checks it | `.dependency-cruiser.cjs:55-72` |
| route registration on one line up to the path string | `blast/routes.ts:14-16` |
| a DB test is `*.it.test.ts`; `--no-file-parallelism`; **read the skipped count** | `server/INSIGHTS.md:90-115`, `:289-311` |
| `pnpm typecheck` does not cover `server/test/` → scratch tsconfig | `server/INSIGHTS.md:146-157` |
| no migration, no schema change | requirements `## Out of scope`; `INSIGHTS.md:144-151` |
| explicit `now` from `useNow` for `relativeTime` | `client/INSIGHTS.md:221-225` |
| repeated visible texts → `getAllByRole` after the final state | `client/INSIGHTS.md:84-102` |
| `fireEvent`, no `user-event` | `client/INSIGHTS.md:227-238` |
| every test provider rendering a component needs its namespace (`agentPerformance` in `AgentEditor.test.tsx:36`) | `client/INSIGHTS.md:157-171` |
| tooltips in-tree, no portal → `HoverNote` | `client/INSIGHTS.md:175-190` |
| imports ≥ 3 levels up through `@/…`; run lint | `client/INSIGHTS.md:28-32` |
| never `pnpm build` while `next dev` runs; check `:3000` first | `client/INSIGHTS.md:62-81`, `:242-246` |
| no React API newer than Next's bundled React without a grep | `client/INSIGHTS.md:22-26` |
| copy a neighbour's folder shape; Tailwind class strings in `styles.ts` | `client/INSIGHTS.md:10-18`; `client/AGENTS.md` |
| `src/vendor/` read-only except `nav.ts`; update its header comment | `client/AGENTS.md`; `nav.ts:21-34` |
| two writers in one checkout: own your paths; never `git checkout --`/`stash` others' files | `INSIGHTS.md:66-88` |
| `verify.mjs` may leave `client/pnpm-workspace.yaml` → delete it | `INSIGHTS.md:191-195` |
| regex/escape-bearing code with Edit/Write, never a heredoc (the `TZ_SHAPE` regex) | `INSIGHTS.md:42-46` |
| no commit under `server/src` while a review run is in flight | `server/INSIGHTS.md:32-49` |

---

## Steps

Steps 1–20 are code (`implementer`, no test files). Steps 21–24 are tests (`test-writer`). Every step ends with `node ../scripts/verify.mjs --baseline L08-agent-performance --related <files>` in its package.

### Phase A — contract (one step, both packages)

1. **server + client** · `{server,client}/src/vendor/shared/contracts/agent-performance.ts` (new), `{server,client}/src/vendor/shared/index.ts`, comment-only edits above `contracts/observability.ts:96` and `contracts/productionize.ts:174` · skill `zod` · covers R-31, R-14, R-28 (shape), R-11, R-90, R-93…R-97 (shape)
   - The `## Contract` block verbatim; `/** @deprecated unused — see contracts/agent-performance.ts (L08). */` above the old `AgentStats` and `AgentPerf`.
   - Checkpoint: `diff -r server/src/vendor/shared client/src/vendor/shared` → empty; typecheck both packages.

### Phase B — server stream (steps 2–6)

2. **server** · `modules/agent-performance/constants.ts`, `types.ts` (new) · covers R-02, R-21, R-22, D-18, D-22
   - `constants.ts`: `COUNTED_RUN_STATUS = 'done'` (R-02); `BUCKET_SQL = { hour: { unit: 'hour', fmt: 'YYYY-MM-DD"T"HH24' }, day: { unit: 'day', fmt: 'YYYY-MM-DD' } } as const`.
   - `types.ts`: `PerfRange { from: Date; to: Date; tz: string; bucket: 'hour' | 'day' }`; `PerfWindow = 'current' | 'previous'`; `RunGroup { win; agentId; provider; model; runs; pricedRuns; costSum; timedRuns; durationSum; lastRunAt }`; `FindingTally { win; agentId; accepted; dismissed; pending }`; `RunBucket { key; runs }`; `PerfAgentRef { id; name; enabled }`; `PerformanceReadSource` (step 4's methods); `AgentPerformanceDeps { repo: PerformanceReadSource }`. No import from `db/`.
3. **server** · `modules/agent-performance/helpers.ts` (new, pure) · skills `onion-architecture`, `typescript-expert` · covers R-01, R-05…R-09, R-11, R-13, R-15…R-24, R-91, R-93, R-95, R-96, R-97, R-106, D-26, D-27
   - `previousWindow(range) → { from; to }` (D-20, R-93). The bucket unit is `range.bucket` (D-18).
   - `acceptRate`, `foldFigures(groups, tally?)` (sums first, then divides; null costs when `priced_runs === 0`), `foldModelCosts(groups)` (priced only, null models merged, cost desc then label).
   - `compare(current: AgentPerfFigures, previous: AgentPerfFigures): PerfComparison` — D-21 and D-22 exactly (R-95, R-96, R-97); whole-percent rounding `Math.round(rate × 100)`, as the client's `acceptPercent`.
   - `pickMostActive(rows)` — current window only (Q-02 order).
   - `buildStats(range, agent, groups, tallies)` and `buildDashboard(range, agents, groups, tallies, buckets)`: split groups and tallies by `win`, fold each window with **the same** `foldFigures`, then `compare` → `comparison` on every row, on the stats report and on the totals (D-26, D-27). Rows: every agent (R-24) + one `deleted` row when its **current** window has runs (R-21). Totals summed from rows; `run_buckets` passed through key asc; `bucket_unit = range.bucket`. `range` echoed with `toISOString()` incl. `previous`.
   - No `Date.now()`, no I/O.
4. **server** · `modules/agent-performance/repository.ts` (new) · skills `drizzle-orm-patterns`, `onion-architecture`, `security`, perf rubric · covers R-02, R-03, R-04, R-10, R-12, R-24, R-27, R-30, R-90, R-93
   - `class PerformanceRepository { constructor(private db: Db) }` implementing `PerformanceReadSource`.
   - private `countedRunsWhere(ws, from, to, agentId?)` → workspace, `status = COUNTED_RUN_STATUS`, `ran_at >= from AND ran_at < to`, optional `agent_id`; no `source` filter (Q-01).
   - `runGroups(ws, range, agentId?)` and `findingTallies(ws, range, agentId?)` over `countedRunsWhere(ws, previous.from, range.to, agentId)` with ``sql`case when ${agentRuns.ranAt} >= ${range.from} then 'current' else 'previous' end` `` selected and grouped as `win`; tally join checks `reviews.workspace_id = ws`; no `findings.kind` filter (Q-04).
   - `runBuckets(ws, range)` (dashboard only): current window; `sql.raw` **only** for `BUCKET_SQL[range.bucket].unit/fmt` (the key is the zod-validated enum); `tz` as a bound parameter (`ran_at AT TIME ZONE ${tz}`).
   - `listAgents(ws)`, `getAgent(ws, id)`. Header comment: read-only over four shared tables (D-5).
5. **server** · `modules/agent-performance/service.ts` (new) · skills `onion-architecture`, perf rubric · covers R-01, R-25, R-26, R-27, R-29
   - `class AgentPerformanceService { constructor(private deps: AgentPerformanceDeps) }`.
   - `dashboard(ws, range)`: `Promise.all([listAgents, runGroups, findingTallies, runBuckets])` → `buildDashboard`.
   - `agentStats(ws, agentId, range)`: `getAgent` first → `NotFoundError('Agent not found')` (R-27); then `runGroups` + `findingTallies` with `agentId` → `buildStats`.
6. **server** · `modules/agent-performance/routes.ts` (new), `modules/index.ts` · skills `fastify-best-practices`, `onion-architecture`, `security`, `zod` · covers R-25, R-26, R-28, R-29
   - `new AgentPerformanceService({ repo: new PerformanceRepository(app.container.db) })`.
   - `app.get('/agents/performance', { schema: { querystring: PerfRangeQuery, response: { 200: AgentPerformanceReport } } }, …)`; `app.get('/agents/:id/stats', { schema: { params: IdParams, querystring: PerfRangeQuery, response: { 200: AgentStatsReport } } }, …)` — one line each up to the path; handler: `getContext` → `PerfRange` → service.
   - Registry: one import + one entry in `modules/index.ts`.
   - Checkpoint: `pnpm arch` → no new violation.

### Phase C — client stream (steps 7–20)

7. **client** · `src/lib/perf-range.ts`, `src/lib/perf-format.ts` (new, pure) · covers R-33…R-37, R-39, R-40, R-54, R-56, R-61, R-90, R-91, R-94, R-100, R-101
   - `perf-range.ts`: `PerfRangeChoice`; param consts; `PRESET_HOURS = { '1d': 24, '30d': 720 }`; `parseRangeParams(sp, now)` (D-7, R-39); `resolveRange(choice, end)` (local midnights, R-34, R-35); `validateCustom` (R-36, R-37); `rangeToParams`; `statsHref(agentId, choice, range)` (D-8, R-56); `todayLocal(now)`; `browserTimeZone()`; `bucketFor(choice) → 'hour'` for `1d`, else `'day'` (R-90); `fillBuckets(range, unit, buckets, tz) → number[]` — one point per local day/hour from the bucket of `from` to the bucket of `to − 1 ms` inclusive (D-18), keys built with `Intl.DateTimeFormat('en-CA', { timeZone: tz, year, month, day, hour, hourCycle: 'h23' })`, zeros where the server sent nothing, repeated keys collapsed (D-18).
   - `perf-format.ts`: `SMALL_SAMPLE_DECIDED = 5`; `isSmallSample`; `acceptPercent`; `formatDurationSec` (R-54); `segmentLabel` (D-6); `ACCEPT_BAND_GOOD = 70`, `ACCEPT_BAND_WARN = 50`; `acceptBand(rate, decided)` and `ACCEPT_BAND_COLOR` (D-23); `formatCostDelta(usd) → '+$0.120' | '−$1.200' | null` (D-21; `formatCostUsd` of the absolute value).
8. **client** · `src/lib/perf-colors.ts` (new, pure) · covers R-102, R-103 · D-25
   - `AGENT_PALETTE` (8 hex), `DELETED_AGENT_COLOR`, `UNKNOWN_MODEL_COLOR` (`var(--info)`), `fnv1a(s)`, `agentColor(agentId: string | null)`, `modelColor(provider, model)`.
9. **client** · `src/lib/hooks/agent-performance.ts` (new) · covers R-25, R-26, R-41, R-74, R-83, D-19
   - `useAgentPerformance(range, bucket)` / `useAgentStats(agentId, range)`: query string `from`, `to` (ISO), `tz = browserTimeZone()`, `bucket` (dashboard; the stats read sends `day`), all `encodeURIComponent`; keys `['agent-performance', from, to, tz, bucket]`, `['agent-stats', id, from, to, tz]`; no `placeholderData`, no mutation, no polling.
10. **client** · move `PrBriefCard/_components/HoverNote/*` → `src/components/hover-note/`; `BriefHeader.tsx:16` → `@/components/hover-note` · D-14
11. **client** · `src/components/perf-range-control/` (`RangeControl.tsx`, `usePerfRange.ts`, `constants.ts`, `styles.ts`, `index.ts`) · covers R-32, R-36, R-37, R-38, R-84, R-85
    - `RangeControl({ choice, onApply })`: `role="group"` with three `<button aria-pressed>`; custom → two labelled `<input type="date" max={today}>` + Apply; errors in `role="alert"`, `onApply` not called.
    - `usePerfRange()` → `{ choice, range, apply }`; `appliedAt` (D-8); `apply` rewrites only `range/start/end/at`, keeps `tab` and the path, `router.replace(…, { scroll: false })`.
12. **client** · `src/components/{accept-rate-value,last-run-time,cost-estimate-note,cost-delta}/` (new) · covers R-46, R-53, R-55, R-61, R-77, R-81, R-94…R-97, R-100, R-101
    - `AcceptRateValue({ figures, comparison?, variant: 'row' | 'kpi' })`: percentage coloured by `acceptBand` (neutral on small sample or unknown — R-100, R-101), denominator, "Small sample" badge, unknown → "—" + "0 decisions" / "No decided findings"; when `comparison` is given, the trend arrow per D-22 (icon `aria-hidden` + visually hidden "up from <p>%" / "down from <p>%"; nothing for `flat`/`null` — R-96, R-97).
    - `LastRunTime({ iso })` (`useNow`, `HoverNote` absolute time). `CostEstimateNote` (R-46).
    - `CostDelta({ comparison })`: `formatCostDelta(cost_delta_usd)` + "estimate difference vs previous period" (R-94); `null` → renders nothing (R-95); neutral colour (D-21).
13. **client** · `client/messages/en/agentPerformance.json` (replace whole) · covers R-89. Key groups: `title`, `subtitle`, `range.*` (choices, inputs, apply, the two errors, short and sentence labels), `estimate.{label,note,deltaLabel}`, `kpi.*` (titles, unpriced, decisions, noDecided, mostActiveLine, mostActiveNoDecisions, sparklinePerDay "Runs per day", sparklinePerHour "Runs per hour"), `table.*` (headers, viewLabel, detailsLabel, deletedAgents, smallSample, zeroDecisions, sortAsc, sortDesc, trendUp "up from {p}%", trendDown "down from {p}%"), `details.*`, `breakdown.*` (title, byAgent, byModel, chart names, noPriced, unknownModel), `states.*` (loadError, retry, noAgents*, noRuns*, goToPulls), `stats.*`. Exact texts are the requirement quotes.
14. **client** · `src/app/agent-performance/page.tsx` (server component) + `_components/AgentPerformanceView/` · covers R-43, R-46, R-70…R-74, R-88
    - Header (title, subtitle, `RangeControl`) in **every** state. Pending → skeletons in every value slot, no digits (R-70); error → `ErrorState` with the message + Retry (R-71); no `kind === 'agent'` row → "No agents yet" + `/agents` (R-72); `totals.runs === 0` → "No agent runs in <range>" + hint (R-73) + step 20; else `PerfKpiCards`, `CostEstimateNote`, `AgentPerfTable`, `CostBreakdown`.
15. **client** · `_components/PerfKpiCards/` (+ `_components/AcceptRing/`) · covers R-40, R-44, R-45, R-47…R-51, R-88, R-90…R-92, R-94, R-95, R-98…R-101
    - Total runs: value + the vendored `Sparkline` of `fillBuckets(...)` inside `<div role="img" aria-label="Runs per day">` ("Runs per hour" for the 1-day preset — R-92); one point → a single dot (D-18).
    - Total cost: `formatCostUsd`, "DevDigest estimate", `CostDelta` over `totals.comparison` (R-94, R-95), unpriced line (R-47).
    - Avg accept rate: `AcceptRateValue variant="kpi"` (band, R-100/R-101) + `AcceptRing` (D-24; not rendered when the rate is null — R-98, R-99).
    - Most-active (R-50): its "<rate>% accept" coloured by `acceptBand(row rate, row decided)` (R-100). Titles carry the short range label; wrapping grid (R-88).
16. **client** · `_components/AgentPerfTable/` (+ `_components/AgentPerfRowView/`, `helpers.ts` `sortRows`, `constants.ts`) · covers R-40, R-45, R-52…R-65, R-85, R-86, R-88, R-96, R-97, R-100…R-103
    - Columns per R-52; Runs header "Runs (30D)" etc.; Avg cost header second line "DevDigest estimate". `<th aria-sort>` with a `<button>` for the six sortable columns (R-60). Initial sort `{ key: 'accept', dir: 'desc' }` (R-59); `sortRows` per D-11 (R-62), derived during render, no request (R-63). The trend does not affect sorting.
    - Row: colour swatch `agentColor(row.agent_id)` / `DELETED_AGENT_COLOR` (`aria-hidden`); expand `<button aria-expanded aria-controls aria-label="Details for <name>">` holding the truncated name in a `HoverNote` (D-12); deleted row labelled "Deleted agents", no View (R-58); View `<Link href={statsHref(...)} aria-label="View stats for <name>">` (R-56, R-86); zero-run row "0" and "—" (R-57); accept cell `AcceptRateValue` with `comparison` (band + trend); `formatCostUsd`, `formatDurationSec`, `LastRunTime`.
    - Expand panel (`<tr><td colSpan>`): accepted, dismissed, pending, runs without a price, cost per model with `segmentLabel` (R-64). Wrapper `overflow-x-auto` (R-88).
17. **client** · `_components/CostBreakdown/` (+ `_components/CostDonut/`) · covers R-45, R-66…R-69, R-87, R-102, R-103
    - Heading "Cost breakdown · DevDigest estimate". `cost_by_agent.length === 0` → "No priced runs in this period" once (R-68). Else cards "By agent" and "By model": `CostDonut({ title, segments: { label, value, color }[] })` → `<div role="img" aria-label={title}>` ("Cost by agent" / "Cost by model", R-87) around a fixed-size recharts `PieChart` (`isAnimationActive={false}`), plus a sibling legend `<ul>`: `aria-hidden` swatch, label, `formatCostUsd(value)`, in the order received (R-67, R-69).
    - Colours: `agentColor` / `DELETED_AGENT_COLOR` (by agent), `modelColor` / `UNKNOWN_MODEL_COLOR` (by model); swatch and slice use the same value (R-102, R-103).
18. **client** · `AgentEditor/constants.ts` (stats tab, icon `Activity`), `AgentEditor.tsx`, `app/agents/[id]/page.tsx:19` (`VALID_TABS`), `AgentEditor/_components/StatsTab/` (new) · covers R-75…R-84, R-107…R-112 (D-28), D-26
    - `StatsTab({ agent })`: `usePerfRange()` + `RangeControl`; `useAgentStats(agent.id, range)`. Pending → skeleton tiles, no digits (R-78); error → `ErrorState` + Retry (R-79); `figures.runs === 0` → "No runs of <name> in <range>" with the control (R-80); data → tiles for Runs, Total cost, Avg cost, Runs without a price, Avg duration, Accept rate with `<accepted>/<decided>`, Accepted, Dismissed, Pending, Last run (R-76), short range label in the titles, "DevDigest estimate" captions (D-10), `CostEstimateNote`, unknown cost → "—" + "<N> runs without a price — not included" (R-82).
    - Plus, per D-28: `CostDelta` over `comparison` next to Total cost (R-107; nothing when either cost is unknown — R-108), and the Accept rate tile rendered by `AcceptRateValue` with `figures` **and** `comparison` — the **colour band** (R-111, neutral on a small sample or unknown rate) **and** the trend arrow with the row's accessible text (R-109; none when either rate is unknown — R-110). Same components and formatters as the dashboard row (R-77). **No sparkline** (R-112), no ring, no agent colour marker.
19. **client** · `client/src/vendor/ui/nav.ts` · covers R-42
    - Append `{ section: "GLOBAL", items: [{ key: "agent-performance", label: "Agent Performance", icon: "Activity", href: "/agent-performance" }] }`; extend the header comment's re-apply list. No `gKey` (UX-09 deferred).
20. **client** · `AgentPerformanceView` empty state · covers R-104, R-105
    - With an active repo (`useActiveRepo`), a link "Go to Pull Requests" → `/repos/<id>/pulls` under R-73's hint; nothing without one.

### Phase D — tests (`test-writer`; cases in appendix §C)

21. **server** · `server/test/agent-performance-helpers.test.ts` (unit) · R-01 (unit half), R-05…R-09, R-11, R-15…R-24, R-91, R-93, R-95…R-97, R-106, D-27
22. **server** · `server/test/agent-performance.it.test.ts` (integration) · R-01…R-30, R-90, R-93…R-96, R-106, D-2, D-19, D-26
23. **client** · `client/src/lib/{perf-range,perf-format,perf-colors}.test.ts` · R-33…R-37, R-39, R-54, R-56, R-61, R-90, R-91, R-94, R-100…R-103
24. **client** · colocated `*.test.tsx` for `RangeControl`, `AgentPerformanceView`, `PerfKpiCards`, `AgentPerfTable`, `CostBreakdown`, `StatsTab`, `CostDelta`, `AcceptRateValue`; `AgentEditor.test.tsx` provider · R-32…R-105, R-107…R-112

## Execution

Multi-agent, parallel streams (OQ-1 A, user 2026-11-05).

| Phase | Agent | Steps | Reads | Produces | Parallel with |
|---|---|---|---|---|---|
| 0 | `implementer` | baseline | this file | `--save-baseline` in `server/` (`--it`) and `client/` | — |
| 1a | `implementer` | 1 | this file | both contract copies + `diff -r` output | — |
| 1b | `implementer` (server) | 2–6 | this file | server tree + verify output | 1c |
| 1c | `implementer` (client) | 7–20 | this file | client tree + verify + `next lint` output | 1b |
| 2 | `plan-verifier` — **gap** pass | 1–20 | this file | verdict per item | the reviewers below |
| 2 | `architecture-reviewer` | — | the open change | findings (`pnpm arch` first) | the others |
| 2 | frontend lenses `react-best-practices`, `next-best-practices` + perf rubric on step 4 (REC-3) | — | the open change | findings | the others |
| 3 | `implementer` — **fix round(s)**, resumed via `SendMessage`, until no CRITICAL/WARNING/gap (max 3, then the user decides) | findings | `.devdigest/cache/sdd/L08-agent-performance/findings.md` | fixes + verify output | — |
| 4 | `test-writer` | 21–24 | this file, appendix §C, `## Done when` | test files + verify output (`--it`, skipped count read) | — |
| 5 | `plan-verifier` — **final** pass | items not `done` in phase 2, plus 21–24 | this file + phase-2 report | verdict per item | — |
| 6 | `doc-writer` | — | the shipped code | one `docs/` page: how runs, costs, windows and buckets are counted (estimate vs billing) | — |

**File ownership (1b ∥ 1c).** Disjoint; neither stream edits the other's paths, runs `git checkout --` or `git stash`, or commits.

| Writer | Owns |
|---|---|
| 1a contract | `server/src/vendor/shared/**`, `client/src/vendor/shared/**` (read-only for 1b/1c afterwards) |
| 1b server | `server/src/modules/agent-performance/**`, `server/src/modules/index.ts` |
| 1c client | `client/src/lib/perf-*.ts`, `client/src/lib/hooks/agent-performance.ts`, `client/src/components/{hover-note,perf-range-control,accept-rate-value,last-run-time,cost-estimate-note,cost-delta}/**`, `client/src/app/agent-performance/**`, `client/src/app/agents/[id]/**`, `client/src/app/repos/[repoId]/pulls/[number]/_components/PrBriefCard/**` (step 10 only), `client/src/vendor/ui/nav.ts`, `client/messages/en/agentPerformance.json` |

`implementer` writes **no** test file. Between phases 2 and 3 the main session writes all reports into the findings file. Phase 3 is skipped when phase 2 returned no gap and no CRITICAL/WARNING.

## Verification

| Package | Baseline (phase 0) | After each step | Final |
|---|---|---|---|
| server | `node ../scripts/verify.mjs --save-baseline L08-agent-performance --it` | `… --baseline L08-agent-performance --related <files>` | `… --baseline L08-agent-performance --it`, then `pnpm exec vitest run .it.test --no-file-parallelism` and **read the skipped count** |
| client | `node ../scripts/verify.mjs --save-baseline L08-agent-performance` | `… --baseline L08-agent-performance --related <files>` | `… --baseline L08-agent-performance`, `pnpm exec next lint --dir src`, then `pnpm build` with `:3000` free (`netstat -ano \| findstr :3000`) |

Also `diff -r server/src/vendor/shared client/src/vendor/shared` → empty; `git diff --stat -- '*/package.json' '*lock*' server/src/db` → empty. Pre-existing failures are labelled `baseline`. Manual browser check (main session): dashboard and Stats tab on the seeded workspace (1 unpriced run → "1 run without a price — not included", Total cost "—", cost delta "—"), light and dark theme for the palette.

## Done when

- [ ] R-01, R-106, D-26: integration — stats `figures`, `comparison` (incl. `previous_total_cost_usd`, `previous_accept_rate`) and `cost_by_model` deep-equal the dashboard row for two agents, same range.
- [ ] R-02…R-14, R-27…R-30: integration cases of appendix §C pass with 0 skipped.
- [ ] R-15…R-24: unit + integration; total = Σ by-agent = Σ by-model within 1e-9.
- [ ] R-25, R-26, R-28, D-2, D-19: both routes; `/agents/performance` answers 200; bad range or unknown `tz` → 422.
- [ ] R-31: `diff -r` of the two `vendor/shared` trees empty; both typecheck.
- [ ] R-32…R-41: `perf-range.test.ts`, `RangeControl.test.tsx`; a reload keeps the range.
- [ ] R-42: GLOBAL → Agent Performance with and without an active repo, highlighted on the route.
- [ ] R-43…R-51, R-90…R-92, R-94, R-95, R-98…R-100: `PerfKpiCards.test.tsx` — sparkline zero-filled and summing to Total runs, named "Runs per day"/"Runs per hour"; no delta shown when either total is unknown; ring absent when the rate is unknown and `aria-hidden` otherwise; KPI and Most-active rates banded.
- [ ] R-52…R-65, R-96, R-97, R-100…R-103: `AgentPerfTable.test.tsx` — bands by threshold, neutral on small sample/unknown, "up from <p>%"/"down from <p>%", no arrow when equal or unknown; sort/expand make zero `fetch` calls.
- [ ] R-66…R-69, R-87, R-102, R-103: `CostBreakdown.test.tsx` — the same agent has the same colour in table swatch and donut legend; deleted = neutral, never an agent's colour.
- [ ] R-70…R-74, R-104, R-105: `AgentPerformanceView.test.tsx`; no "0"/"$0" while loading or on error; only GET requests; PR link only with an active repo.
- [ ] R-75…R-84, R-107…R-112: `StatsTab.test.tsx`, `AgentEditor.test.tsx`; cost delta (none when either cost unknown), trend arrow with the row's text (none when either rate unknown) **and colour band** (neutral on small sample/unknown) shown from `comparison`/`figures`; no sparkline; `?tab=stats` survives a range change.
- [ ] R-85, R-86, R-88: keyboard-only walk (manual) + role/name assertions.
- [ ] R-89: no hardcoded user-facing string (gate G12).
- [ ] `pnpm arch` no new violation; `pnpm build` green; no lockfile, schema or migration change.

## Left to reviewers

- architecture: a module reading four tables it does not own (D-5), read-only; explicit-deps service; static `/agents/performance` beside `/agents/:id`; `HoverNote` promotion (D-14); `nav.ts` as the one vendored hand-edit.
- security: workspace scoping in every query (R-30); querystring validation before the handler incl. `tz` (D-19); `sql.raw` limited to the two-entry `BUCKET_SQL` map, `tz` bound; 404 for a foreign agent; no write path.
- performance (perf rubric): three or four grouped reads per request over twice the time span (previous window) without a `(workspace_id, status, ran_at)` index (REC-2 rejected by scope); `Promise.all` against a ~10-connection pool.

## Risks / open questions

| Question | Blocks which step | Needs |
|---|---|---|
| A `tz` that Node's `Intl` accepts but Postgres's tz database does not → a 500 from the bucket query instead of a 422 | 4, 6 | integration test with `Europe/Kyiv` and `UTC`; if Postgres rejects a valid name, fall back to `UTC` buckets and log — reviewers decide |
| `fillBuckets` (client `Intl`) and the SQL keys (Postgres `AT TIME ZONE`) must produce identical keys; a mismatch silently shows zeros. Both use local wall-clock `YYYY-MM-DD[THH]` | 4, 7, 22 | integration test asserts keys for a known UTC instant in two zones |
| DST: a custom day is 23 h or 25 h; a fall-back hour merges into one bucket | 7, 23 | tests must not assume 24 h |
| The reads are separate statements; a decision landing between them can make one response off by one | — | accepted; `REPEATABLE READ` if reviewers object |
| No index for `(workspace_id, status, ran_at)`; the previous window doubles the scanned span | 4 | later migration (REC-2) |
| 8 palette colours: agents can share a colour; text carries meaning | 8 | accepted (D-25) |
| recharts in jsdom renders no layout; tests assert legend text and `role="img"` names only | 17, 24 | — |
| spec-creator: optionally clarify R-40, R-45, R-56 | — | spec-creator (non-blocking) |
