# L08 — Agent Performance · plan appendix

Opened on demand by the agents executing `specs/L08-agent-performance.md`. Holds the bulky material: the full
requirements check, the rationale behind the larger decisions, and the test-case lists. The plan keeps one-line
summaries of each.

---

## A. Requirements check (all 89 IDs)

Verdicts: **ok** = buildable as written · **planner detail** = buildable, one detail fixed by a `D-n` · **pending** =
built on the spec's recommended option while the user has not answered the matching `Q-n` (the step is marked) ·
**by construction** = holds because of how the code is shaped, plus a test.

| Req | Verdict | Note | → steps |
|---|---|---|---|
| R-01 | by construction | both endpoints call the same repository reads and the same pure `foldFigures` / `foldModelCosts` (D-3); proven by a field-by-field equality test | 3, 4, 5, 21 |
| R-02 | ok | one `countedRunsWhere()` used by both reads: `workspace_id = ws AND status = 'done' AND ran_at >= from AND ran_at < to` | 4 |
| R-03 | pending Q-01 | no `source` filter in `countedRunsWhere()` | 4 |
| R-04 | ok | `>=` / `<` in `countedRunsWhere()` | 4, 21 |
| R-05 | ok | `count(*)` of counted runs | 3, 4 |
| R-06 | ok | `count(cost_usd)` = priced runs; `unpriced_runs = runs − priced_runs`; cost sums only `cost_usd` non-null | 3, 4 |
| R-07 | ok | `priced_runs === 0` → `total_cost_usd: null`, `avg_cost_usd: null` | 3 |
| R-08 | ok | `avg_cost_usd = total / priced_runs` | 3 |
| R-09 | ok | `sum(duration_ms) / count(duration_ms)` folded from group sums (never an average of averages) | 3, 4 |
| R-10 | ok | findings joined `agent_runs → reviews (run_id, same workspace) → findings`, grouped by the **run's** `agent_id` | 4 |
| R-11 | ok | `acceptRate(accepted, decided)` pure; `decided` in the contract | 1, 3 |
| R-12 | pending Q-04 | no `kind` filter on findings | 4 |
| R-13 | pending Q-03 | `max(ran_at)` of the counted runs (in range by construction) | 3, 4 |
| R-14 | ok | `range: { from, to }` echoed as `toISOString()` of the parsed query | 1, 5 |
| R-15 | ok | `totals.runs = Σ rows.runs` (deleted row included) | 3 |
| R-16 | ok | total, by-agent and by-model all summed from the same group `cost_sum` values; unit test with 1e-9 tolerance | 3, 20, 21 |
| R-17 | ok | `totals.unpriced_runs = Σ rows.unpriced_runs` | 3 |
| R-18 | ok | `Σ accepted / Σ decided` over all rows incl. deleted; both sums returned | 1, 3 |
| R-19 | pending Q-02 | `pickMostActive`: kind `agent` rows only, runs desc, `last_run_at` desc, name asc (code-unit), id asc | 3 |
| R-20 | ok | no row with runs > 0 → `most_active_agent_id: null` | 3 |
| R-21 | ok | groups with `agent_id IS NULL` fold into one row `kind: 'deleted'`, emitted only when it has ≥ 1 counted run; excluded from `pickMostActive` | 3 |
| R-22 | planner detail | key `(provider, model)`; every group with `model IS NULL` merges into one segment `{ provider: null, model: null }`; the client renders it "Unknown model" (D-6) | 3, 16 |
| R-23 | ok | only groups with `priced_runs > 0`; segment `cost_usd` = Σ `cost_sum` | 3 |
| R-24 | ok | one row per `agents` row of the workspace (enabled or not), zero figures when no run | 3, 4 |
| R-25 | ok | `GET /agents/:id/stats?from&to` | 5, 6 |
| R-26 | planner detail | path `GET /agents/performance?from&to` (Q-08 → D-1) | 6 |
| R-27 | ok | `getAgent(ws, id)` undefined → `NotFoundError('Agent not found')` before any aggregation | 5 |
| R-28 | ok | zod querystring `PerfRangeQuery` (both fields required, ISO-8601 with offset, `from < to` refine) → the global handler's 422 before the handler runs | 1, 6 |
| R-29 | by construction | the module's deps are one read-only repository; no container adapter reaches it (INV-4) | 5, 6, 21 |
| R-30 | by construction | every query filters `agent_runs.workspace_id`, `reviews.workspace_id`, `agents.workspace_id` | 4, 21 |
| R-31 | ok | new `contracts/agent-performance.ts`, byte-identical in both trees | 1 |
| R-32 | ok | `RangeControl` | 10 |
| R-33 | ok | `parseRangeParams` default | 7 |
| R-34 | planner detail | presets end at `appliedAt` (mount or selection) or at a pinned `at` from a View link (D-8) | 7, 10 |
| R-35 | pending Q-10 | `new Date(y, m − 1, d)` local midnight; end = start of the day after | 7 |
| R-36 | ok | `validateCustom` → `endBeforeStart`; no navigation, no request | 7, 10 |
| R-37 | ok | `validateCustom` → `future`; also `max={today}` on both inputs | 7, 10 |
| R-38 | ok | `usePerfRange.apply` → `router.replace` with `range/start/end` | 10 |
| R-39 | ok | any invalid param combination → `{ kind: '30d' }`, no error | 7 |
| R-40 | planner detail | `(1D)`, `(30D)`, `(<start> – <end>)` with `{ day: 'numeric', month: 'short', year: 'numeric' }` (D-9) | 7, 14, 15, 17 |
| R-41 | ok | query keys carry the ISO instants; no `placeholderData`/`keepPreviousData` → a new key shows the loading state | 8 |
| R-42 | ok | GLOBAL group in `nav.ts`; `activeKeyFor` already maps `/agent-performance` (`app-shell/helpers.ts:37`) | 18 |
| R-43 | ok | messages | 12, 13 |
| R-44 | ok | | 14 |
| R-45 | planner detail | where the label sits (D-10) | 14, 15, 16, 17 |
| R-46 | ok | `CostEstimateNote` on both screens | 11, 13, 17 |
| R-47 | ok | | 14 |
| R-48 | ok | `formatCostUsd(null)` → "—" (`format-cost.ts:19-20`) | 14 |
| R-49 | ok | | 14 |
| R-50 | ok | the row looked up by `most_active_agent_id` | 14 |
| R-51 | pending Q-07 | `formatCostUsd` unchanged | 14–17 |
| R-52 | ok | | 15 |
| R-53 | ok | `AcceptRateValue` | 11, 15 |
| R-54 | ok | `formatDurationSec` | 7, 15 |
| R-55 | ok | `LastRunTime` = `format.relativeTime(at, now)` with `useNow` + `HoverNote` absolute time | 9, 11, 15 |
| R-56 | planner detail | `statsHref()` carries `range` plus `start/end` or the pinned `at` (D-8) | 7, 15 |
| R-57 | ok | zero figures → "0" and "—" | 15 |
| R-58 | ok | `kind: 'deleted'` → label from messages, no View | 15 |
| R-59 | ok | initial sort state `{ key: 'accept', dir: 'desc' }` | 15 |
| R-60 | ok | header `<button>` inside `<th aria-sort>` | 15 |
| R-61 | ok | `isSmallSample(decided)` with `SMALL_SAMPLE_DECIDED = 5` | 7, 11 |
| R-62 | ok | `sortRows` three tiers (D-11) | 15 |
| R-63 | ok | sort is local state over loaded rows | 15 |
| R-64 | ok | expand panel from `row.figures` + `row.cost_by_model` | 1, 15 |
| R-65 | planner detail | CSS ellipsis; full name in a `HoverNote` tooltip on the focusable expand button (D-12) | 15 |
| R-66 | ok | | 16 |
| R-67 | ok | server sorts segments by cost desc, label asc; the client renders in order | 3, 16 |
| R-68 | ok | `cost_by_agent.length === 0` → one message for both charts | 16 |
| R-69 | ok | legend `<ul>` with name + amount; colour swatch is decorative (`aria-hidden`) | 16 |
| R-70 | ok | `Skeleton` in every value slot while `isPending` | 13, 14 |
| R-71 | ok | `ErrorState` with the `ApiError.message` and `onRetry` | 13 |
| R-72 | ok | no `kind: 'agent'` row → "No agents yet" + link `/agents` | 13 |
| R-73 | ok | `totals.runs === 0` → empty block with the range control still rendered | 13 |
| R-74 | ok | the client has no mutation on this screen; test asserts only GET reached `fetch` | 8, 23 |
| R-75 | ok | `TABS` + `VALID_TABS` | 17 |
| R-76 | ok | | 17 |
| R-77 | by construction | Stats tab uses the same `lib/perf-format.ts`, `formatCostUsd`, `AcceptRateValue`, `LastRunTime` | 11, 17 |
| R-78 | ok | | 17 |
| R-79 | ok | | 17 |
| R-80 | ok | | 17 |
| R-81 | ok | | 11, 17 |
| R-82 | ok | | 17 |
| R-83 | ok | | 8, 23 |
| R-84 | ok | `usePerfRange.apply` keeps every other search param (`tab`) and the path | 10 |
| R-85 | ok | native `<button>`, `<input type="date">`, `<a>` only; no `div` with `onClick` | 10, 15 |
| R-86 | ok | | 15 |
| R-87 | ok | chart wrapper `role="img"` + `aria-label` | 16 |
| R-88 | ok | KPI grid `grid-cols-[repeat(auto-fit,minmax(220px,1fr))]`; table wrapper `overflow-x-auto`, `min-w` on the table | 14, 15 |
| R-89 | ok | every string from `messages/en/agentPerformance.json` | 12 |

**Totals (89 IDs), revision 2:** 78 ok · 7 planner detail (R-22, R-26, R-34, R-40, R-45, R-56, R-65) · 4 by
construction (R-01, R-29, R-30, R-77) · blocked: **none**. The six rows marked "pending" above (R-03, R-12, R-13,
R-19, R-35, R-51) became ok when the user confirmed the recommended Q options on 2026-11-05.

**Step numbers in this table are revision 1's.** Revision 2 inserted `lib/perf-colors.ts` as step 8, so every client
step from 8 on moved down by one (old 8 → 9, 9 → 10, … 19 → 20), and the tests are now 21–24.

---

## B. Rationale behind the larger decisions

**D-1 (Q-08) — new contract file, not an edit of `AgentStats` / `AgentPerf`.** Both existing shapes are unused
(grep over `server/src` and `client/src`: only their own declarations). They require fields this lesson does not
compute (`findings_by_severity`, `trend`, `dismiss_rate`, `avg_findings_per_run`) and lack ones it needs (range,
`unpriced_runs`, `decided`, per-row `cost_by_model`). Reusing the names would either compute dead fields or silently
change a published shape. The barrel's own header (`vendor/shared/index.ts:13-14`) says feature work extends with new
files. The old declarations stay, with a one-line `@deprecated` comment pointing to the new file, so nobody wires a
second route to them.

**D-3 — SQL grouping grain `(agent_id, provider, model)`.** It is the finest grain any figure needs: per-agent
figures fold groups by `agent_id`, by-model segments fold them by `(provider, model)`, the totals fold everything.
Because all three folds read the same `cost_sum` numbers, R-16 holds up to float addition order (well inside 1e-9 for
realistic magnitudes). The answer size is bounded by agents × models, not by run count, so a long custom range only
costs scan time (Q-05).

**D-8 — preset ranges and the View link.** A preset is rolling (R-34), so "the same start and end" (R-56) cannot be
re-derived on the Stats tab from `range=30d` alone — the clock has moved. The View link therefore pins the end:
`?tab=stats&range=30d&at=<to ISO>`. `at` is only ever written by a View link; applying any range on either screen
drops it. A reload of a pinned link shows the pinned window, which is what R-38 asks ("the same range").

**D-11 — accept-rate sort tiers.** Tier A: `decided ≥ 5`, by `accept_rate` in the chosen direction. Tier B:
`1 ≤ decided < 5`, by `decided` desc, then `accept_rate` desc. Tier C: `decided = 0` (includes every zero-run row).
Tier order A → B → C in **both** directions (R-62). Every tie ends at agent label asc (code-unit), then `agent_id`
(deleted row last), so the order is total and tests are deterministic.

**Charts (D-13).** The vendored `Donut` (`client/src/vendor/ui/charts/Donut.tsx:11-57`) cannot be used as is: its
legend prints `toFixed(2)` (contradicts R-51 under the house format), it has no accessible name (R-87) and
`src/vendor/ui` may not be edited (only `nav.ts` is exempt, `client/AGENTS.md`). `recharts ^2.15.0` is already a
client dependency (`client/package.json:22`), so a route-private `CostDonut` built on `PieChart` / `Pie` / `Cell` adds
no dependency and no lockfile change.

---

**D-19 / D-18 — time zone and buckets.** Day buckets must follow the browser's days (user, UX-01), so the server
needs the zone. Sending an IANA name and bucketing in SQL keeps the answer small (≤ number of days) at any range
length. The alternative — the client sending every bucket boundary — grows with the range (no cap, Q-05). Zeros are
filled on the client because Postgres cannot cheaply emit an empty local-day series without `generate_series` in the
same zone, and the client already walks local days for R-35.

**D-20 — previous window in the same reads.** A `win` column on the same grouped queries keeps the previous figures
under exactly the rules of the current ones (the user's "same window" rule and R-01), instead of a second code path.

---

## C. Test cases (for `test-writer`)

Revision 2 numbering: server unit = step 21, server integration = step 22, client lib = step 23, client components =
step 24. The headings below keep the revision-1 numbers (20–23) in order; add the revision-2 cases listed at the end of
each block.

### Step 20 → 21 — `server/test/agent-performance-helpers.test.ts` (server unit, no Docker)
1. `acceptRate`: (3, 4) → 0.75; (0, 0) → null; (0, 5) → 0 (R-11).
2. `foldFigures` with groups: priced + unpriced + no duration → runs, priced/unpriced, total, avg cost, avg duration
   from sums (not averages of averages) (R-05…R-09).
3. All groups unpriced → `total_cost_usd` and `avg_cost_usd` null, never 0 (R-07).
4. `foldModelCosts`: two providers same model → two segments; `model: null` groups under two providers → one
   segment; unpriced-only group → no segment; order cost desc then label (R-22, R-23, R-67).
5. `buildDashboard`: totals equal Σ rows for runs, unpriced, accepted, decided; total cost equals Σ by-agent and
   Σ by-model within 1e-9 using values like 0.1, 0.2, 0.3 × many groups (R-15…R-18).
6. Deleted groups → one `kind: 'deleted'` row, counted in totals, never most-active (R-21).
7. `pickMostActive` ties: equal runs → later `last_run_at`; equal both → name asc; no runs → null (R-19, R-20).
8. Every workspace agent appears, zero figures when absent (R-24).
9. `buildStats(agent)` figures deep-equal the matching `buildDashboard` row's figures for the same inputs (R-01, unit
   half).
10. `previousWindow`: equal length, ends at `from` (R-93); `bucket_unit` equals `range.bucket` (R-90); the buckets
    passed in sum to `totals.runs` (R-91).
11. `compare`: both costs known → delta; either null → `cost_delta_usd: null` (never 0) (R-95); trend `up`/`down`/
    `flat` on whole percents — 0.674 vs 0.666 → `flat` (67 = 67); a null rate in either window → `null` (R-96, R-97);
    a known rate with 3 decided findings still gets a trend (no small-sample suppression, R-96).
12. Groups split by `win`: previous-window runs never leak into current figures, totals or most-active; the
    `comparison` of `buildStats` deep-equals the row's (D-26); `totals.comparison` from pooled totals (D-27).

### Step 21 → 22 — `server/test/agent-performance.it.test.ts` (server integration, Docker)
Fixture in one workspace W plus a foreign workspace F: agents A (enabled), B (disabled), C (no runs); runs with every
status; runs at exactly `from` and exactly `to`; a `ci` run; priced and unpriced runs; a run with `model` null; an
agent deleted after its runs; reviews + findings in all three states and of every kind; F gets the same shape with
different numbers.
1. R-01: for A and for B, `GET /agents/:id/stats` `figures` and `cost_by_model` deep-equal the dashboard row.
2. R-02/R-04: only `done`; `from` counted, `to` not.
3. R-03: the `ci` run counted.
4. R-06/R-07/R-08/R-09 on concrete numbers; an all-unpriced agent → null costs.
5. R-10/R-11/R-12: finding states and kinds; a finding of a `failed` run is not counted.
6. R-13/R-14: `last_run_at` and the echoed range.
7. R-15…R-18, R-21…R-24 on the dashboard.
8. R-27: unknown uuid → 404; an F agent id → 404.
9. R-28: missing `to`, `from=garbage`, `from == to`, `from > to` → 422 on both routes; `GET /agents/performance` is not
   captured by `/agents/:id` (200, not 422).
10. R-29: `MockLLMProvider` and `MockGitHubClient` injected via `ContainerOverrides` record zero calls; row counts of
    `agent_runs`, `reviews`, `findings`, `jobs` and every finding's `accepted_at` / `dismissed_at` unchanged after both
    reads.
11. R-30: F's runs, reviews and findings never appear in W's numbers.
12. D-26, R-106: case 1 also deep-equals `comparison`, incl. `previous_total_cost_usd` and `previous_accept_rate`.
13. D-20: a run at exactly `previous.from` is in the previous window, one just before it in neither; a run at `from`
    is current only.
14. D-18/D-19: `run_buckets` keys for runs at known UTC instants with `tz=UTC` and `tz=Europe/Kyiv` (different local
    day across midnight); `bucket=hour` → `bucket_unit: 'hour'` with `YYYY-MM-DDTHH` keys, `bucket` omitted → `'day'`;
    the bucket runs sum to `totals.runs` (R-90, R-91); `tz=Not/AZone`, `tz=` and `bucket=week` → 422.
Run with `--no-file-parallelism` and **read the skipped count** (`server/INSIGHTS.md:90-115`, `:289-311`).

### Step 22 → 23 — `client/src/lib/{perf-range,perf-format,perf-colors}.test.ts`
Revision-3 additions: `fillBuckets` with an explicit `tz` — a rolling 30-day range starting 14:00 → 31 day points, a
range from local midnight → 30, the 1-day preset → 24 hour points (25 when it straddles a fall-back, collapsed to
unique keys), the points sum to the bucket runs given (R-90, R-91); `bucketFor` → `hour` only for `1d`, custom single
day → `day` (R-90); `acceptBand` boundaries 49/50/69/70, `neutral` at decided 4 and for a null rate (R-100, R-101);
`formatCostDelta` signs (U+2212) and null (R-94, R-95); `agentColor` stable for one id, always within the palette,
never equal to `DELETED_AGENT_COLOR`; `null` → neutral (R-102, R-103).
1. `parseRangeParams`: none → 30d; `range=1d`; custom valid; custom end < start, future end, malformed date,
   unknown `range`, unparseable or future `at` → 30d (R-33, R-39).
2. `resolveRange` with a fixed `now`: 1d = 24 h, 30d = 720 h; custom = local midnight start → local midnight after the
   end date (R-34, R-35); a DST week computed with `new Date(y, m, d)` (assert hours = 167 or 169 only when the test TZ
   has DST — otherwise assert midnight boundaries).
3. `validateCustom` → `endBeforeStart`, `future`, null (R-36, R-37).
4. `statsHref` for a preset (carries `at`) and for custom (carries start/end) (R-56).
5. `formatDurationSec`: 6234 → "6.2s", null → "—" (R-54); `acceptPercent`, `isSmallSample` boundary 4/5 (R-61).

### Step 23 → 24 — client component tests (colocated)
Revision-3 additions: `PerfKpiCards` — `getByRole('img', { name: 'Runs per day' })` (30d) / `'Runs per hour'` (1d)
(R-90, R-92); one-bucket range renders without NaN; "estimate difference vs previous period" with "−$1.200" when both
totals known, and **no delta text at all** (no "$0") when either is null (R-94, R-95); ring absent when
`totals.accept_rate` is null, present and `aria-hidden` otherwise (R-98, R-99); KPI and Most-active percentages carry
the band colour, neutral under 5 decisions (R-100, R-101). `AgentPerfTable` — "up from 60%" / "down from 80%" text
for `up`/`down`, nothing for `flat`/`null` (R-96, R-97); band colours at 70/69/50/49 and neutral on a small sample
(R-100, R-101); the same `agent_id` has the same swatch colour in the table and the donut legend; the deleted row is
neutral (R-102, R-103). `StatsTab` (D-28) — cost delta (R-107) and none when either cost is null (R-108); trend arrow
with the row's text (R-109) and none when either rate is null (R-110); the accept-rate band colour, neutral with < 5
decided or unknown (R-111) — all matching the dashboard row for the same fixture; no sparkline (R-112), no ring.
`AgentPerformanceView` — "Go to Pull Requests" only with an active repo (R-104, R-105).
- `RangeControl.test.tsx`: three choices; custom inputs reachable by label; R-36/R-37 messages and no `onApply`.
- `AgentPerformanceView.test.tsx` (mock `@/lib/hooks/agent-performance`, `next/navigation`): loading skeletons and no
  "0"/"$0" text (R-70); error + Retry (R-71); no agents (R-72); no runs (R-73, control still present); data state.
- `PerfKpiCards.test.tsx`: titles with "(30D)" (R-40); unknown total → "—" and "N runs without a price — not included"
  (R-47, R-48); accept KPI with denominator and "No decided findings" (R-49); most active (R-50).
- `AgentPerfTable.test.tsx`: columns (R-52); "Small sample" (R-61); default sort and three tiers both directions
  (R-59, R-62); header `aria-sort` toggles (R-60); expand shows counts + cost per model, `aria-expanded` (R-64, R-86);
  deleted row has no View link (R-58); zero-run row "0" and "—" (R-57); View `href` carries the range (R-56); fetch mock
  called zero times by sort/expand (R-63, R-74). Use `getAllByRole` for repeated "View stats for …" names
  (`client/INSIGHTS.md:84-102`).
- `CostBreakdown.test.tsx`: legend order, names and amounts (R-66, R-67, R-69); "No priced runs in this period"
  (R-68); `getByRole('img', { name: 'Cost by agent' })` (R-87).
- `StatsTab.test.tsx`: all R-76 figures; skeleton (R-78); error (R-79); empty (R-80); small sample (R-81); unknown cost
  (R-82); only GET requests (R-83).
- `AgentEditor.test.tsx` (existing): add the `agentPerformance` namespace to its provider; the Stats tab is listed
  (R-75).
- `BriefHeader` tests keep passing after the `HoverNote` move (step 10 in revision 2).

---

## D. Accepted UX items → R-90 … R-105 (requirements file, 2026-11-05)

| UX | R-IDs | Binding decisions | Steps (rev. 3) | Tests |
|---|---|---|---|---|
| UX-01 runs sparkline | R-90, R-91, R-92 | D-18, D-19 — per local day the range touches (browser TZ), per hour for the "1 day" preset; server buckets non-empty only, client zero-fills; dashboard only (D-26) | 1, 2, 3, 4, 7, 9, 13, 15 | 21.10, 22.14, 23, 24 |
| UX-02 cost delta | R-93, R-94, R-95 | D-20, D-21 — previous window of equal length; nothing shown unless both totals known; "estimate difference vs previous period"; neutral colour | 1, 3, 4, 7, 12, 15, 18 | 21.10–11, 22.12–13, 24 |
| UX-03 trend arrows | R-96, R-97 | D-22 — whole-percent comparison; null only when a rate is unknown; "up from <p>%" / "down from <p>%"; neutral colour | 1, 3, 12, 16, 18 | 21.11, 24 |
| UX-04 accept ring | R-98, R-99 | D-24 — own SVG, not rendered when the rate is unknown, `aria-hidden` | 15 | 24 |
| UX-05 colour bands | R-100, R-101 | D-23 — ≥ 70 / 50–69 / < 50 on the displayed percent; neutral on decided < 5 or unknown; KPI, Most-active, rows (+ Stats tab, Q-11) | 7, 12, 15, 16, 18 | 23, 24 |
| UX-08 agent colour | R-102, R-103 | D-25 — FNV-1a of the id over an 8-colour palette with no grey; deleted and unknown model neutral | 8, 16, 17 | 23, 24 |
| UX-10 PR link | R-104, R-105 | step 20 — only with an active repo | 20 | 24 |
| Q-11 Stats-tab extras | R-106 … R-112 | D-28 — previous values in both reads (R-106); delta (R-107, R-108), trend (R-109, R-110), band (R-111) on the Stats tab; no sparkline (R-112), ring or agent colour | 3, 18 | 21.12, 22.12, 24 (`StatsTab`) |
| UX-06, UX-07, UX-09 | — | deferred by the user | — | — |
