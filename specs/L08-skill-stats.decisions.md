# L08 follow-up — Skill Stats · plan appendix

Appendix to `specs/L08-skill-stats.md`. Opened on demand: the full requirements check (§A), the rationale behind the plan's decisions (§B, incl. every message text), and the test cases the test steps cite (§C).

## §A — Requirements check (R-01 … R-83)

Verdicts: **ok** = buildable as written; **by construction** = holds because of how the reads are shared, with a test that proves it; **planner detail** = buildable, the plan fixes a detail the spec leaves open (D-n / OQ-n).

| Req | Verdict | Implemented by | Steps | Tests |
|---|---|---|---|---|
| R-01 | ok | D-4 `usingAgents` + `activeSkillOnAgent()` | 2, 4 | I1 |
| R-02 | ok | D-4 — evaluated at request time | 4, 5 | I2 |
| R-03 | by construction | predecessor `countedRunsWhere`; `source` enum is `local\|ci` (`runs.ts:37`) | 4 | I3 |
| R-04 | by construction | `agent_id null` cannot join `agents` | 4 | I4 |
| R-05 | ok | `used_by = agents.length`; same gate as `agentCountsFor` | 3, 4 | I1 |
| R-06 | ok | `ran_in_period` from `runCountsByAgent` | 3, 4 | I5 |
| R-07 | ok | D-7 `reviewedPrCount` | 4 | I4, I6 |
| R-08 | ok | D-7 `prsWithSkill`, `count(distinct)` | 4 | I6 |
| R-09 | by construction | `pr_id is not null` in both counts | 4 | I6 |
| R-10 | ok | `pullFrequency()` | 3 | U2, I7 |
| R-11 | ok | D-5 `findingBreakdown` | 4 | I8 |
| R-12 | ok | `findings.total` | 3 | U1, I8 |
| R-13 | ok | D-6 `skillFigures` | 3 | U3, I8 |
| R-14 | ok | `foldBreakdown` → `other` | 3 | U1, I8 |
| R-15 | ok | same | 3 | U1, I8 |
| R-16 | by construction | D-5/D-6 same rows, same filter SQL (REC-2) | 3, 4 | I9 |
| R-17 | ok | `appliedRange()` | 3 | U7, I10 |
| R-18 | by construction | D-7 both reads call the same two methods | 4, 5 | I11 |
| R-19 | ok | `buildSkillStats` | 3, 5, 6 | U4, I12 |
| R-20 | ok | `buildSkillsPullFrequency`, `listSkillIds` | 3, 5, 6 | U5, I12 |
| R-21 | ok | D-8 `getSkill` → 404; non-uuid → 422 (`IdParams`) | 5, 6 | I13 |
| R-22 | ok | D-3 `PerfRangeQuery` | 6 | I14 |
| R-23 | ok | D-3 probe first | 5 | I15 |
| R-24 | ok | read-only repository | 4 | I16 |
| R-25 | ok | workspace checks on every read (D-4, D-7) | 4 | I17 |
| R-26 | ok | `buildStats(…, breakdown)` | 3, 5 | U6, I18 |
| R-27 | by construction | step 1 + `diff -r` | 1 | typecheck ×2 |
| R-28 | ok | `RangeControl` + `usePerfRange` reused | 17 | C4 |
| R-29 | ok | `usePerfRange.apply` keeps `tab`; D-14 | 16, 17 | C11 |
| R-30 | ok | query key per range, no `placeholderData` | 10 | L4 |
| R-31 | planner detail | D-9, OQ-4 | 9, 13 | L1, C2 |
| R-32 | ok | D-17 | 15 | C3, C7 |
| R-33 | planner detail | D-9 caption from the response; hidden while loading | 13 | C2 |
| R-34 | ok | `TABS` | 16 | C10 |
| R-35 | ok | `SkillKpiCards` | 17 | C5 |
| R-36 | ok | plural keys | 17 | C5 |
| R-37 | ok | `Math.round(rate×100)` + fraction | 17 | C5 |
| R-38 | ok | `rate null` → "—" | 17 | C5 |
| R-39 | planner detail | D-12, OQ-3 | 17 | C5 |
| R-40 | planner detail | D-12, OQ-2 | 17 | C5 |
| R-41 | ok | `findings.total` | 17 | C5 |
| R-42 | ok | server order name, id | 4, 17 | I12, C6 |
| R-43 | planner detail | D-13 `statsHref` from the response range | 17 | C6 |
| R-44 | ok | `aria-label` | 17 | C6 |
| R-45 | ok | badge | 17 | C6 |
| R-46 | ok | empty list text | 17 | C6 |
| R-47 | ok | `FindingsWidget` | 17 | C4 |
| R-48 | ok | `!report.skill.enabled` note | 17 | C4, I19 |
| R-49 | ok | no zero-run branch | 17 | C4 |
| R-50 | ok | skeletons | 17 | C4 |
| R-51 | ok | `ErrorState` + Retry | 17 | C4 |
| R-52 | ok | GET only | 10 | L4, C4 |
| R-53 | ok | D-14 | 11, 16 | L3, C11 |
| R-54 | ok | wrapping grids | 17 | manual smoke |
| R-55 | ok | native buttons, inputs, links | 17 | C6 + manual |
| R-56 | ok | D-16 | 12 | gate G12 |
| R-57 | by construction | only the caption, widget and fixture change | 15 | predecessor suites |
| R-58 | planner detail | D-15 | 10 | L5, C4 |
| R-59 | ok | one shared component | 14, 15, 17 | C1, C7 |
| R-60 | ok | donut + centre total | 14 | C1 |
| R-61 | ok | `categoryEntries` | 14 | C1 |
| R-62 | ok | `entryPercent` | 14 | C1 |
| R-63 | ok | `severityEntries` + `SEV` | 14 | C1 |
| R-64 | ok | `isSmallFindingsSample` | 14 | C1 |
| R-65 | ok | `total === 0` branch | 14 | C1 |
| R-66 | ok | `role="img"` name + legend text | 14 | C1 |
| R-67 | ok | `CATEGORY_COLOR` | 14 | C1 |
| R-68 | ok | one `findings` object feeds card and widget; server sum | 3, 15, 17 | C5, C7, I18 |
| R-69 | ok | D-17 placement | 15 | C7 |
| R-70 | ok | no hook in the widget | 14 | C7 |
| R-71 | ok | D-11 | 18 | C8 |
| R-72 | by construction | D-7 | 4 | I11 |
| R-73 | ok | `lastThirtyDays(mountedAt)` | 9, 10 | L1, L4 |
| R-74 | ok | one hook call per page | 10, 18 | C9, L4 |
| R-75 | ok | "— pull freq" | 18 | C8 |
| R-76 | ok | inline skeleton | 18 | C8 |
| R-77 | ok | count only | 18 | C8 |
| R-78 | by construction | D-7 | 4 | I11 |
| R-79 | ok | `runs` per agent | 3, 4 | U4, I5 |
| R-80 | ok | plural key | 17 | C6 |
| R-81 | ok | note | 17 | C4 |
| R-82 | planner detail | D-11 — hint for ready states only | 18 | C8 |
| R-83 | planner detail | D-11 — `aria-describedby` on text and card root | 18 | C8 |

## §B — Decision rationale

**D-1 (module).** The counted-run predicate (`agent-performance/repository.ts:31-39`), the tz probe (`:134-136`) and the range echo live in `agent-performance`. A `skill-stats` module could not import them (`no-cross-module`, `.dependency-cruiser.cjs:121-131`), and copying them is the drift R-03, R-16 and R-18 forbid. Moving the predicate to `src/db/` (like `skill-gates.ts`) was the alternative; it touches shipped code for no behaviour gain. The routes are under `/skills/` because that is where the resource is; the agents module already coexists with `/agents/performance` the same way.

**D-5 / REC-2 (one filter set).** `findingTallies` defines "dismissed" as dismissed **and not** accepted (`repository.ts:95`). A second hand-written copy in the breakdown read that forgets the "not accepted" half would still pass most tests and break R-16 and R-26 on a finding that was accepted and then dismissed. One private `findingStateColumns()` makes both reads share the text.

**D-7 (two counts, both reads).** R-18 and R-78 demand equality between the stats read and the card read. Computing the numerator from `usingAgents` ids in one read and from a join in the other would be two rules. Both reads call `reviewedPrCount` + `prsWithSkill`; equality is then structural and I11 proves it.

**D-9 (caption).** R-33 is satisfied only if the caption reads the window off the response: the client's `range` may already belong to a newer apply while the old figures are on screen. The response's `range.tz` is the browser zone the client sent, so formatting with it is "the browser's time zone" (R-31) and deterministic in tests. Nothing is shown while loading (no window has figures yet).

**D-10 (widget).** `CostDonut` is route-private to the dashboard and prints money (`CostDonut.tsx:50`); the widget gets its own small recharts ring. The vendored `Donut` prints `toFixed(2)` and has no accessible name (predecessor D-13). Severity uses the existing `SEV` tokens (colour + icon) but labels from messages, because `SEV[*].label` is "Critical" while R-63 names "CRITICAL" and R-56 wants message files.

**D-11 (card).** One read per page (R-74), window fixed at mount (R-73) so a Stats-tab range change never moves the cards. The hint's `aria-describedby` sits on the card's `role="button"` root as well as the text: a description on a non-focusable span is not announced when the user tabs to the card.

**D-15 (404).** The page owns the not-found state (`page.tsx:51-62`). Invalidating `['skill', id]` lets that state take over without a second error UI.

**D-16 — message keys and texts** (ICU; `{range}` = the sentence label of `useRangeLabels`, e.g. "the last 30 days").

`client/messages/en/agentPerformance.json` (add):
```json
"range": { "caption": { "preset": "{choice} · {start} – {end}", "custom": "{start} – {end}" } },
"findings": {
  "title": "Findings by category",
  "chartLabel": "Findings by category",
  "severityLabel": "Findings by severity",
  "entry": "{count} · {pct}%",
  "smallSample": "Small sample",
  "empty": "No findings in {range}",
  "category": { "security": "security", "bug": "bug", "perf": "perf", "style": "style", "test": "test", "other": "other" },
  "severity": { "CRITICAL": "CRITICAL", "WARNING": "WARNING", "SUGGESTION": "SUGGESTION", "other": "other" }
}
```
(`range.caption` merges into the existing `range` object.)

`client/messages/en/skills.json` (add):
```json
"editor": { "tabs": { "stats": "Stats" } },
"listItem": {
  "agents": "{count, plural, one {# agent} other {# agents}}",
  "pullFreq": "{pct}% pull freq",
  "pullFreqUnknown": "— pull freq",
  "pullFreqLoading": "Loading pull frequency",
  "pullFreqHint": "PRs reviewed in the last 30 days with an agent that uses this skill"
},
"stats": {
  "heading": "Stats",
  "loadError": "Could not load skill stats",
  "offNote": "This skill is off — no agent sends it, so no run is attributed to it",
  "attributionNote": "Figures cover the agents that use this skill now. Findings come from their runs and are not traced to the skill itself.",
  "kpi": {
    "usedBy": "Used by",
    "usedByValue": "{count, plural, one {# agent} other {# agents}}",
    "ranInPeriod": "{count} ran in period",
    "pullFreq": "Pull frequency",
    "pullFreqValue": "{pct}% ({n}/{d} PRs)",
    "pullFreqCaption": "PRs reviewed in the period",
    "pullFreqUnknown": "No reviewed PRs in {range}",
    "accept": "Accept rate",
    "findings": "Findings"
  },
  "agents": {
    "title": "Agents using this skill",
    "open": "Open",
    "openLabel": "Open {name}",
    "disabled": "Disabled",
    "runs": "{count, plural, one {# run} other {# runs}}",
    "none": "No agent uses this skill",
    "noneHint": "Attach it on an agent's Skills tab"
  }
}
```
(Each merges into the existing object of the same name; `listItem.agentCount` and `editor.usedBy` stay — the editor header still uses `usedBy`.)

## §C — Test cases

### Server unit — `server/test/skill-stats-helpers.test.ts` (step 7)
- **U1** `foldBreakdown`: rows with all five categories and three severities → exact counts; `category 'Security'` and `'misc'`, `severity 'warning'` → `other`; `total = Σ by_category = Σ by_severity = Σ states` (R-12, R-14, R-15).
- **U2** `pullFrequency(0, 0)` → `{0, 0, null}`; `(1, 3)` → `rate 1/3`; `(2, 2)` → `1` (R-10).
- **U3** `skillFigures`: decided 0 → `accept_rate null`; 3 accepted / 1 dismissed / 2 pending → `0.75`, decided 4 (R-13).
- **U4** `buildSkillStats`: two agents, one with runs → `used_by 2`, `ran_in_period 1`, `runs 0` kept, order as given (R-05, R-06, R-79).
- **U5** `buildSkillsPullFrequency`: three ids, numerator for one → entries for all three, missing → 0, shared denominator (R-20).
- **U6** `buildStats(…, breakdown)` → `findings` from the agent's rows only; without a 5th argument → all zeros (R-26).
- **U7** both builders echo `range` via `appliedRange` (R-17).

### Server integration — `server/test/skill-stats.it.test.ts` (step 8)
Range `[2030-01-11, 2030-01-21)` UTC; two PRs P1, P2 plus a run with `pr_id null`; skill S1 (on), S2 (off globally), S3 (no agent). Agents A (S1 checked), B (S1 row unchecked), D (disabled, S1 checked), C (S3 only).
- **I1** R-01, R-05: `used_by` = 2 (A, D) = `GET /skills` → S1 `agent_count`.
- **I2** R-02: A has a run before S3 is attached to it; attach (insert row) → S3 counts the run; detach → it does not.
- **I3** R-03: `failed` / `running` runs excluded; a run at `from` counted, at `to` not; a `ci` run counted.
- **I4** R-04, R-07: a run with `agent_id null` on P2 → not attributed to S1, but P2 is in `prs_reviewed`.
- **I5** R-06, R-79: A 2 runs, D 0 → `ran_in_period 1`, runs 2 and 0.
- **I6** R-07 … R-09: A and D both on P1 → `prs_with_skill` 1; C on P2 → `prs_reviewed` 2; the null-PR run counts in neither.
- **I7** R-10: a range with no run → `0/0`, `rate null`.
- **I8** R-11 … R-15: accepted, dismissed, both (counts as accepted), pending, kinds `finding` + `secret_leak`; one `category 'misc'`, one `severity 'warning'` → `other`; sums equal `findings.total`.
- **I9** R-16: S3 attached only to C → S3 `figures` and `findings` deep-equal C's `GET /agents/:id/stats` `figures` subset and `findings`.
- **I10** R-17: both reads echo `from`, `to`, `tz`.
- **I11** R-18, R-72, R-78: a 30-day range → for every skill, the pull-frequency entry deep-equals the stats read's `pull_frequency`.
- **I12** R-19, R-20, R-42: agents list `{id, name, enabled, runs}` name asc; pull-frequency has one entry per skill incl. S3 with no runs.
- **I13** R-21: random uuid → 404; another workspace's skill → 404; non-uuid → 422.
- **I14** R-22: missing `from`, garbled `to`, `from ≥ to`, previous window before 1970 → 422 on both routes.
- **I15** R-23: `tz=US/Pacific-New` → 422 on both routes, also on an empty range.
- **I16** R-24: `MockLLMProvider` / `MockGitHubClient` record zero calls; row counts of `agent_runs`, `reviews`, `findings`, `agent_skills`, `skills`, `agents` and every finding's `accepted_at`/`dismissed_at` unchanged after both skill reads and the agent stats read.
- **I17** R-25: workspace F with the same shape → never counted; a link row from F's agent to W's skill (inserted directly) → not counted.
- **I18** R-26, R-68: `GET /agents/A/stats` → `findings.total = accepted + dismissed + pending`; per-category and per-severity counts as seeded.
- **I19** R-48: S2 (off) with a checked agent that ran → `used_by 0`, `prs_with_skill 0`, `findings.total 0`, `agents []`.
- **I20** `GET /skills/pull-frequency` → 200 with `skills` array (not captured by `/skills/:id`).

### Client lib and hooks (step 19)
- **L1** `perf-range.test.ts`: `lastThirtyDays(now)` = 720 h ending at `now`; `perfRangeQuery` encodes `from`/`to`/`tz`/`bucket`; `captionWindow` preset → applied start/end; custom → `lastDay = to − 1 ms` (incl. a DST-day custom range); `captionNeedsYear` per OQ-4.
- **L2** (moved helper) the existing `hooks/agent-performance.test.tsx` stays green unchanged.
- **L3** `skills.test.ts`: `skillEditorHref('s2', 'stats', 'tab=stats&range=custom&start=…&end=…')` keeps every key and sets `tab`.
- **L4** `hooks/skill-stats.test.tsx`: stats → one GET `/skills/<id>/stats?from&to&tz`; pull frequency → one GET `/skills/pull-frequency?…` for any number of cards, window 720 h; no other method; a new range is a new key.
- **L5** a 404 from the stats read is not retried and invalidates `['skill', id]`.
- **L6** `captionWindow` never reads the client range — given an `applied` that differs, it returns the applied instants (R-33).

### Client components (step 20)
- **C1** `FindingsWidget.test.tsx`: `role="img"` named "Findings by category" with the total; legend order security, bug, perf, style, test with zeros, `other` only when > 0; 1 of 3 → "1 · 33%" (sum 99 allowed); severity row CRITICAL/WARNING/SUGGESTION with zeros, `other` only when > 0; "Small sample" at totals 1 and 4, not at 0 or 5; total 0 → only "No findings in the last 30 days"; swatch colours = `CATEGORY_COLOR`, identical across two renders.
- **C2** `RangeCaption.test.tsx` (`timeZone="UTC"`): preset 1 day → "1 day · Nov 4, 10:37 – Nov 5, 10:37"; custom Nov 1–3 → "Nov 1 – Nov 3"; a past-year custom range shows years (OQ-4 A); `applied` undefined → nothing.
- **C3** `AgentPerformanceView.test.tsx`: the caption appears beside the range control with data, not while loading; all existing cases green.
- **C4** skill `StatsTab.test.tsx` (providers `skills` + `agentPerformance`, QueryClient, mocked `fetch`): skeleton with no digit / "0" / "0%"; error → reason + Retry; data → off note when disabled; attribution note; zero-run report keeps the four cards and the list, widget says "No findings in …"; only GET requests; applying "1 day" keeps `tab=stats` in `router.replace`; a 404 invalidates the skill query.
- **C5** `SkillKpiCards.test.tsx`: "1 agent" / "2 agents", "1 ran in period"; "100% (2/2 PRs)" + "PRs reviewed in the period"; `rate null` → "—" + "No reviewed PRs in the last 30 days", no "0%"; accept "—" + "No decided findings"; 3/4 decided → "75%", "3/4 decisions", "Small sample"; Findings value = `findings.total`.
- **C6** `SkillAgentsList.test.tsx`: rows in received order; `getAllByRole('link', { name: /^Open / })` names "Open Security Reviewer", "Open Test Quality Reviewer"; href `/agents/<id>?tab=stats&range=30d&at=<applied to>`; custom → `range=custom&start&end`; "Disabled" only on the disabled agent; "1 run" / "0 runs"; empty → both texts.
- **C7** agent `StatsTab.test.tsx`: the widget renders after the last tile and before the estimate note (DOM order); its total = accepted + dismissed + pending of the fixture; caption shown; still one GET per range.
- **C8** `SkillCard.test.tsx`: ready → "2 agents · 100% pull freq"; `rate null` → "2 agents · — pull freq"; loading → "2 agents" and no "%"; error / no prop → "2 agents" and no "pull freq"; the card button's accessible description = the hint text; "1 agent" singular. Existing "Used by 2 agents" assertion (`:58`) updated.
- **C9** `SkillsListView.test.tsx`: fetch mock routed by URL; three skills → exactly one `/skills/pull-frequency` request; each card shows its percentage.
- **C10** SkillEditor tabs: Config, Preview, Stats, Versions, Context in that order; `?tab=stats` renders the Stats tab.
- **C11** `app/skills/[id]/page.test.tsx` (modelled on `app/agents/[id]/page.test.tsx`): with `?tab=stats&range=custom&start=…&end=…`, clicking another skill in the rail pushes `/skills/<other>?tab=stats&range=custom&start=…&end=…`; switching tab keeps the range.
- **C12** fixtures: `statsReport()` carries a `findings` breakdown; new `skillStatsReport()` builder used by C4–C6.
