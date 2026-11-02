# L05 — PR Brief, 2026-11-02 amendment (verdict banner, run line, Review focus card) · implementation plan

**Requirements:** `specs/L05-pr-brief.requirements.md` (Status: Approved). Scope here: **R-78 … R-105** and the amended **R-01, R-05, R-07, R-48, R-51, R-71**. Every other R-ID belongs to the shipped plan and must not regress.
**Shipped plan (conventions, earlier decisions D-n, F-n):** `specs/L05-pr-brief.md`. Do not copy from it and do not edit it. This file's own IDs carry a `B` prefix (BD-n, BA-n, BREC-n) so they never collide with D-n there.
**Decisions:** all in this file. No appendix was needed.
**Execution:** single-agent, given by the caller: one `implementer` pass (server field first, then client), then reviewers in parallel, then `test-writer`. **There is no phase 0**: this amendment has no cross-model review and no `specs/L05-pr-brief.banner.plan-review.md` (see `## Execution`).
**Branch:** `lesson/L05-lab-homework` (never `main`). Base: HEAD `af2d6e1`, PR #32. R-01…R-77 are shipped. None of this amendment is built yet: `last_reviewed_sha` appears in no contract, and `PrBriefCard` renders no `VerdictBanner`.
**Slug for `verify.mjs` and `/run-plan`:** `L05-pr-brief.banner`.
**Hard limits (caller):** no new dependency, no lockfile change, no migration, no new endpoint. Existing tests stay green. A test that pins the old layout changes only as listed under step 9 / step 13.

## Requirements check

| Req | Verdict | Note | → |
|---|---|---|---|
| R-01 | ok | Review focus leaves the block | 11, 13 |
| R-05 | ok | summary skeleton stays in the block (or in the banner's text, R-97); the Review focus skeleton moves to the card | 11, 12, 13 |
| R-07 | ok | new labels in `brief.json`; the banner keeps `prReview` | 7, 10 |
| R-48 | ok | the summary paragraph is not rendered while the banner is shown | 11 |
| R-51 | ok | placement only. The list component moves, behaviour unchanged | 12 |
| R-71 | ok | the tooltip becomes visible text in the run line | 7, 9 |
| R-78 | ok | banner directly under `BriefHeader` (BA-1), with or without a brief | 10, 11 |
| R-79 | ok | one counting helper shared with Agent runs (BD-4) | 6, 10 |
| R-80 | already holds | `VerdictBanner.tsx:50-55` renders the ring only for `score != null`. Pass `review.score` | 10 |
| R-81 | ok | text = `brief.summary` | 11 |
| R-82 | ok (client) · already holds (server) | the server's reviews read is workspace-checked and newest-first (`reviews/routes.ts:141-143` → `reviews/service.ts:161-175` → `review.repo.ts:58-74`). The client picks the newest `kind === "review"` | 10 |
| R-83 | ok | same component, same counting helper | 6, 10 |
| R-84 | ok | no review → no banner | 10 |
| R-85 | already holds + test | reads only `/reviews`, `/runs`, `/runs/active` (DB-only, already made by `page.tsx:51,56-57`). No model, no GitHub | 10, 16 |
| R-86 | already holds | `VerdictBanner.tsx:50` | 16 |
| R-87 | already holds | only a successful run writes a review row (`run-executor.ts:324-334`), so the reviews read never has a partial result | 16 |
| R-88 | ok | refresh `["reviews",prId]` and `["pr-runs",prId]` when active runs drop to 0 | 5, 10 |
| R-89 | already holds | same reason as R-87. The note itself is R-104 | 10 |
| R-90 | already holds | no server brief code changes. The existing `server/test/brief-inputs.test.ts` and `brief-prompt.test.ts` pin the inputs | — |
| R-91 | ok | `formatTokensK` + `brief.tokens` | 7, 8, 9 |
| R-92 | ok | new route-level `ReviewFocusCard` after the grid | 12, 13 |
| R-93 | ok | | 12, 13 |
| R-94 | ok | needs R-95 | 4, 10 |
| R-95 | ok | `PrDetail.last_reviewed_sha` (BA-6) | 1, 2, 15 |
| R-96 | ok | | 11 |
| R-97 | ok | `VerdictBanner` gets an optional `summarySlot` (BD-3) | 6, 11 |
| R-98 | already holds | `VerdictBanner` renders no cost (`VerdictBanner.tsx:12-58`). Pass none | 16 |
| R-99 | ok | reviews query `isError` → hidden state (BA-5) | 10 |
| R-100 | ok | | 13 |
| R-101 | ok | muted `<p>`, **no** `role` (BD-7) | 10 |
| R-102 | ok | | 10 |
| R-103 | ok | | 10 |
| R-104 | ok | "newest run" per BA-4 | 10 |
| R-105 | ok | `agentName={review.agent_name}`. `VerdictBanner.tsx:42-46` already renders it | 10 |

**Totals (34 IDs):** 25 ok · 9 already hold (R-80, R-85 server side, R-86, R-87, R-89, R-90, R-98, and R-82 server side; R-85 and R-82 also have client work). Blocked: **none**. The ambiguities are applied as non-blocking assumptions BA-1…BA-6.

## Decisions

| ID | Decision | Source |
|---|---|---|
| BD-1 | Execution single-agent; no phase 0; reviewers `architecture-reviewer` ∥ `plan-verifier` ∥ frontend lenses; then `test-writer` | caller |
| BD-2 | No dependency, lockfile, migration or endpoint change | caller |
| BD-3 | `VerdictBanner` gains two **optional** props: `notes?: ReactNode` (rendered between the title row and the summary) and `summarySlot?: ReactNode` (when not `undefined`, it replaces the `<p>{summary}</p>`). Both are absent on Agent runs, so its output there is byte-for-byte the same (R-83). A `<div>` skeleton inside the existing `<p>` would be invalid DOM nesting, which is why this is a new slot and not a widened `summary` | planner |
| BD-4 | `VerdictBanner/helpers.ts` exports `verdictCounts(findings) → { findingsCount, blockers }`: findingsCount = all findings; blockers = `severity === "CRITICAL" && !dismissed_at`. `ReviewRunAccordion.tsx:55` switches to it, so both banners count with one function (R-79, R-83). This is deliberately **not** the PR list's tally (`server/INSIGHTS.md:188-200`) | planner |
| BD-5 | Run-line wording: `generatedLine` becomes `"Generated {ago} for {sha} · {model} · {cost} · {tokens}"`. `{cost}` = `formatCostUsd(cost_usd)` or `t("costUnknown")`. `{tokens}` = `t("tokens", { in, out })` with `"tokens": "{in}K→{out}K"`, and in/out come from `formatTokensK`. The `cost` key ("Cost of this generation: …") is removed; the line is plain text, no `HoverNote` | planner, from R-71, R-91 |
| BD-6 | `formatTokensK(n) = (Math.round(n / 100) / 10).toFixed(1)` → 8200 "8.2", 400 "0.4", 420 "0.4", 1250 "1.3", 0 "0.0", 3100 "3.1". No grouping separator. It lives in `PrBriefCard/helpers.ts`, its only consumer (promote on the second one) | planner |
| BD-7 | Banner-side labels go in `brief.json` under `banner.*`: `label` "Latest review" (the `aria-label` of the banner group), `noReview`, `running`, `runningNoReview`, `failed`, `stale` ("Review is for an older commit ({sha})"). The no-review / in-progress line is a plain `<p>` with no `role`, because `PrBriefCard.test.tsx:371` uses `getByRole("status")` as the only status | planner |
| BD-8 | The banner's data comes from a colocated hook `PrBriefCard/_components/ReviewBanner/useReviewBanner.ts`. It **composes** existing hooks (`usePrReviews`, `usePrActiveRuns`, `usePrRuns`) and a pure `reviewBannerState(...)`. No `fetch` and no new query key. The precedent is `OverviewTab/useBriefNavigation.ts` | planner |
| BD-9 | R-88 hook: `useWhenActiveRunsEnd(prId, onEnd)` in `client/src/lib/hooks/reviews.ts`. It calls `onEnd` when `usePrActiveRuns(prId).data.length` goes from > 0 to 0, the same transition as `IntentCard.tsx:57-63`. The banner's `onEnd` invalidates `["reviews", prId]` (a prefix, so the Smart Diff counts are refreshed too) and `["pr-runs", prId]` | planner |
| BD-10 | `PrBriefCard` no longer takes `nav` (only Review focus used it). New props: `headSha: string`, `lastReviewedSha: string \| null`. `OverviewTab` gets `lastReviewedSha` from `page.tsx` (`pr.last_reviewed_sha ?? null`) | planner |
| BD-11 | The Review focus card's visibility is a pure helper `reviewFocusCardState(view, isError)` in `OverviewTab/helpers.ts` → `"hidden" \| "generating" \| ReviewFocusItem[]`. The rules: read error → hidden; `view.generating` → generating; `view.brief` → items; otherwise hidden. Like the Risk-areas slot (`OverviewTab.tsx:47`), it keys on the read's `generating`, which `useGenerateBrief` sets on 202 (`brief.ts:45-47`). The Risk-areas slot is **not** changed (R-63 unchanged) | planner |
| BD-12 | The `implementer` makes only the **mechanical** edits to existing tests listed in steps 9, 11 and 13, so that its checkpoints are green. `test-writer` writes every new assertion (steps 16–17) | planner, so the reviewers see a green tree |
| BD-13 | `ReviewFocusList` moves out of `PrBriefCard/_components/` into a new route-level folder `_components/ReviewFocusCard/`, because its consumer is now `OverviewTab`. The old folder is deleted in the same step (no orphan, `frontend-ui-architecture`: never demote silently) | planner |

## Assumptions / open points (non-blocking; the recommended option is applied in the steps)

| ID | Point | Options | Applied |
|---|---|---|---|
| BA-1 | R-78 says "under the block header". Where exactly? | **A (rec.)** directly after the whole `BriefHeader` (title row + run line + trimmed note + stale-brief badge), because R-92 groups "the header and run line" · B between the title row and the run line | A |
| BA-2 | The banner while the **brief** read is still loading (R-04) and a review exists | **A (rec.)** banner with verdict, counts and score, and an `aria-hidden` skeleton as its text, so there is no flash from the review's summary to the brief's · B no banner until the brief read settles · C the review's summary | A |
| BA-3 | The latest `kind === "review"` row has `verdict: null` (the contract allows it; `run-executor.ts:324-334` never writes it) | **A (rec.)** hidden: no banner and no R-101 line, as on Agent runs (`ReviewRunAccordion.tsx:137`) · B treat it as no review (R-101 line) · C show it with the `comment` fallback | A |
| BA-4 | R-104: which run is "the newest review run"? With "Run all", one agent's run can fail while a sibling's run succeeds later | **A (rec.)** the `RunSummary` with the greatest `ran_at` from `GET /pulls/:id/runs` (any agent), status `failed` or `cancelled` · B only a failed/cancelled run that started after the latest review's `created_at` | A — spec-creator may tighten R-104 |
| BA-5 | R-99 when a **refetch** of reviews fails over cached data | **A (rec.)** literal R-99: query `isError` → hidden, even with cached data · B keep the cached banner | A |
| BA-6 | Which PR read carries R-95, and with what type | **A (rec.)** `PrDetail` only (`GET /pulls/:id`, already made by `page.tsx:46`), typed `z.string().nullish()`, so `GitHubClient.getPullRequest` (`adapters.ts:146`) and its adapters need not know a DB column. The route always sends `string \| null` · B also on `PrMeta` (list) · C `.nullable()`, which forces the octokit adapter and the mock to set it | A |

## Recommendations

| ID | Recommendation | Why / cost of not doing it | Status |
|---|---|---|---|
| BREC-1 | Switch `IntentCard.tsx:57-63` to `useWhenActiveRunsEnd` (BD-9) | it would remove the second copy of the transition effect. Not doing it leaves two identical effects. It touches a tested card outside this scope | очікує — not in the steps |
| BREC-2 | Move `GET /pulls/:id`'s Drizzle reads into a service (`server/INSIGHTS.md:160-172`) | that rule applies when you *touch* a query. Step 2 adds no query and reads a column of a row the handler already selects | очікує — not in the steps |
| BREC-3 | Migrate `VerdictBanner/styles.ts` from `CSSProperties` to Tailwind | it is legacy (`frontend-ui-architecture`, Styles). Do not mix both forms in one component, so step 6 extends `s` as `CSSProperties` | очікує — not in the steps |

## Touches

server: `vendor/shared/contracts/platform.ts` (`PrDetail`), `modules/pulls/routes.ts` (`GET /pulls/:id`), `test/brief.it.test.ts` · client: `vendor/shared/contracts/platform.ts`, `app/repos/[repoId]/pulls/[number]/{page.tsx, _components/{OverviewTab, PrBriefCard, VerdictBanner, ReviewRunAccordion, ReviewFocusCard (new)}}`, `lib/hooks/reviews.ts`, `messages/en/brief.json` · reviewer-core, e2e, mcp: none.
**Not touched:** any `package.json`/lockfile, `server/src/db/**`, migrations, `server/src/adapters/**`, `*/vendor/shared/adapters.ts`, `server/src/modules/{brief,reviews}/**`, `client/src/lib/hooks/brief.ts`, `client/src/vendor/ui/**`, `messages/en/prReview.json`, `IntentCard`, `BriefRiskAreas`, `BriefFileRef`.

## Contract

In **both** `server/src/vendor/shared/contracts/platform.ts` and `client/src/vendor/shared/contracts/platform.ts`, byte-identical, in the same change. `PrDetail` (line 212) becomes:

```ts
export const PrDetail = PrMeta.extend({
  body: z.string().nullish(),
  files: z.array(PrFile),
  commits: z.array(PrCommit),
  linked_issue: IssueMeta.nullish(),
  // Head SHA of the PR's last successful review run (`pull_requests.last_reviewed_sha`),
  // null when never reviewed. Detail endpoint only; the GitHub adapters never set it.
  last_reviewed_sha: z.string().nullish(),
});
```

## Skill map

Derived from `.claude/skills/pr-self-review/references/routing.md` (rows 27–40). `routing.md` routes `perf-prompt` on `routes.ts`. That is a rubric, not a skill: none of these steps has a performance dimension, so it is not listed.

| Step | Path | Skills the implementer loads |
|---|---|---|
| 1 | `*/vendor/shared/contracts/platform.ts` | `zod` |
| 2 | `server/src/modules/pulls/routes.ts` | `fastify-best-practices`, `onion-architecture`, `security` |
| 4 | `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` | `frontend-ui-architecture`, `next-best-practices`, `react-best-practices` |
| 5 | `client/src/lib/hooks/reviews.ts` | `frontend-ui-architecture`, `typescript-expert` (+ `react-best-practices` for the effect; not routed for `lib/`) |
| 6, 8–13 | `client/src/app/**/_components/**` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` |
| 7 | `client/messages/en/brief.json` | — (G12 only) |
| 9, 11, 13 (test edits), 16–17 | `client/src/**/*.test.tsx`, `*.test.ts` | `react-testing-library` |
| 15 | `server/test/brief.it.test.ts` | **not in routing.md**. `test-writer` picks: `drizzle-orm-patterns` for the row update, `fastify-best-practices` for `app.inject` |

## Constraints

| Constraint | Source |
|---|---|
| `@devdigest/shared` is two copies; edit both in one change and typecheck both packages | root `AGENTS.md` (Hard rules), `client/INSIGHTS.md:199-205` |
| The client imports **types only** from `@devdigest/shared` | `server/INSIGHTS.md:72-87` |
| A relative import three or more levels up fails eslint (`no-restricted-imports`). From `PrBriefCard/_components/ReviewBanner/` to `VerdictBanner`, use `@/app/repos/[repoId]/pulls/[number]/_components/VerdictBanner`, as `ReviewFocusList.tsx:10` does | `client/INSIGHTS.md:22-26`, `client/eslint.config.mjs:87` |
| A component that translates through another namespace needs it in every test provider that renders it: add `prReview` to the `PrBriefCard` / `OverviewTab` test providers once a banner renders, and assert the rendered string | `client/INSIGHTS.md:151-165` |
| Do not reach a non-unique accessible name with `findByRole`; await a final-state element, then `getAllByRole` | `client/INSIGHTS.md:78-96` |
| There is no `@testing-library/user-event`; use `fireEvent` | `client/INSIGHTS.md:221-232` |
| `relativeTime` keeps its explicit `now` (`BriefHeader.tsx:63-69`); do not regress it | `client/INSIGHTS.md:215-219` |
| A Postgres test is `*.it.test.ts`; when it matters, read the passed/**skipped** counts | `server/INSIGHTS.md:109-115`, `:90-106` |
| `pnpm typecheck` does not cover `server/test/` | `server/INSIGHTS.md:146-157` |
| `pulls/routes.ts` queries Drizzle in the route (grandfathered). Add **no** query and no import there | `server/INSIGHTS.md:160-172` |
| Banner blockers ≠ the PR list's tally; use the Agent-runs rule (BD-4) | `server/INSIGHTS.md:188-200` |
| Never `pnpm build` while `next dev` runs (`.next` clash); on Windows check `:3000` first | `client/INSIGHTS.md:56-75`, `:236-240` |
| Model text stays plain text (R-36): the brief summary in the banner is a text child, never HTML | shipped plan D-28 |

## Steps

**Server — first.**

1. **shared (both copies)** · `server/src/vendor/shared/contracts/platform.ts`, `client/src/vendor/shared/contracts/platform.ts` · skill: `zod` · covers: R-95. Add `last_reviewed_sha` to `PrDetail` exactly as in `## Contract`. Nothing else in either file.
2. **server** · `server/src/modules/pulls/routes.ts` (`GET /pulls/:id`, :216-310) · skills: `fastify-best-practices`, `onion-architecture`, `security` · covers: R-95. GitHub path (:276): `return { ...detail, id: pr.id, last_reviewed_sha: pr.lastReviewedSha ?? null };` — **after** the spread, so the DB value wins. Offline path (:281-308): add `last_reviewed_sha: pr.lastReviewedSha ?? null`. `pr` is already the full selected row: no new query, no new import. Workspace scoping is unchanged (:218-224).
3. **checkpoint** · in `server/`: `node ../scripts/verify.mjs --baseline L05-pr-brief.banner --it` — typecheck, arch, unit and integration show no `new` failure. Then in `client/`: `pnpm typecheck` stays green after step 1.

**Client.**

4. **client** · `…/pulls/[number]/page.tsx` (:157-165) · covers: R-94. Pass `lastReviewedSha={pr.last_reviewed_sha ?? null}` to `OverviewTab`. Nothing else; the page stays thin.
5. **client** · `client/src/lib/hooks/reviews.ts` · covers: R-88. Add and export `useWhenActiveRunsEnd(prId: string | null | undefined, onEnd: () => void): void` (BD-9). It reads `usePrActiveRuns(prId).data?.length ?? 0`, keeps the previous count in a `useRef`, and in an effect calls `onEnd()` on a > 0 → 0 transition. Keep the latest `onEnd` in a ref, so an inline callback does not re-run the effect. Header comment: "R-88, same transition as IntentCard".
6. **client** · `_components/VerdictBanner/{VerdictBanner.tsx, helpers.ts (new), styles.ts, index.ts}` + `_components/ReviewRunAccordion/ReviewRunAccordion.tsx:55` · covers: R-79, R-83, R-94, R-97, R-102, R-104. `helpers.ts`: `verdictCounts(findings: FindingRecord[])` (BD-4). `VerdictBanner.tsx`: the optional `notes` and `summarySlot` props (BD-3). `notes` renders in a `<div style={s.notes}>` after the title row; `summarySlot !== undefined` replaces the summary `<p>`. Add `s.notes` as `CSSProperties` (BREC-3). `index.ts`: also export `verdictCounts`. `ReviewRunAccordion.tsx:55`: `const { blockers } = verdictCounts(findings);`, with behaviour unchanged.
7. **client** · `client/messages/en/brief.json` · covers: R-07, R-71, R-91, R-94, R-101…R-104. `generatedLine` → `"Generated {ago} for {sha} · {model} · {cost} · {tokens}"`. Add `"tokens": "{in}K→{out}K"`. Remove `"cost"`. Add a `"banner"` object: `label` "Latest review", `noReview` "No review yet — run one to see the verdict and PR score", `running` "Review in progress — showing the previous review", `runningNoReview` "Review in progress", `failed` "The latest review run failed — showing the previous review", `stale` "Review is for an older commit ({sha})". `prReview.json` is unchanged (R-07).
8. **client** · `_components/PrBriefCard/helpers.ts` · covers: R-91. Add `formatTokensK(n: number): string` (BD-6).
9. **client** · `_components/PrBriefCard/_components/BriefHeader/BriefHeader.tsx` (`MetaLine`, :59-102) · covers: R-08, R-71, R-91. Build the line with `t("generatedLine", { ago, sha, model, cost, tokens })` per BD-5, with `tokens = t("tokens", { in: formatTokensK(meta.tokens_in), out: formatTokensK(meta.tokens_out) })`. Render it as a plain `<span>` (drop the `HoverNote` around it; keep `HoverNote` for the trimmed note). Update the file's header comment (R-71 is no longer a tooltip).
   *Mechanical test edits, `PrBriefCard.test.tsx`:* :212 → `"Generated 2 hours ago for abc1234 · openai/gpt-4.1 · $0.014 · 3.1K→0.4K"`. Delete :214-215 (`tabindex`, accessible description). :244 → `getByText("Generated 2 hours ago for abc1234 · openai/gpt-4.1 · cost unknown · 3.1K→0.4K")`. :252 → `"Generated now for abc1234 · openai/gpt-4.1 · $0.014 · 3.1K→0.4K"`.
10. **client** · new `_components/PrBriefCard/_components/ReviewBanner/{ReviewBanner.tsx, useReviewBanner.ts, helpers.ts, styles.ts, index.ts}` · covers: R-78, R-79, R-82…R-89, R-94, R-96…R-99, R-101…R-105.
    - `helpers.ts` (pure):
      - `latestReview(reviews)` → the `kind === "review"` row with the greatest `Date.parse(created_at)`, or null.
      - `newestRun(runs)` → the greatest `ran_at` (null `ran_at` ignored).
      - `reviewBannerState({ reviewsStatus, reviews, activeRunCount, runs, headSha, lastReviewedSha })` returns:
        - `{ kind: "hidden" }` when reviews are loading or errored (R-99, BA-5), or the latest review has a null verdict (BA-3);
        - `{ kind: "none", running }` when there is no latest review (R-84, R-101, R-103);
        - `{ kind: "review", review, findingsCount, blockers, running, newestRunFailed, staleSha }` otherwise.
        `findingsCount` and `blockers` come from `verdictCounts`. `running = activeRunCount > 0`. `newestRunFailed` = the newest run's status is `failed` or `cancelled` **and** `!running` (R-104 "until a newer run starts"; BA-4). `staleSha = lastReviewedSha && lastReviewedSha !== headSha ? shortSha(lastReviewedSha) : null` (R-94).
    - `useReviewBanner(prId, headSha, lastReviewedSha)`: `usePrReviews`, `usePrActiveRuns`, `usePrRuns`, plus `useWhenActiveRunsEnd(prId, …)`, which invalidates `["reviews", prId]` and `["pr-runs", prId]` (R-88). It returns the state (BD-8).
    - `ReviewBanner({ state, text })`, where `text` is a `ReactNode | undefined` chosen by the parent:
      - `hidden` → `null`.
      - `none` → `<p className={cx.line}>`, muted, no role: `t("banner.runningNoReview")` if running, else `t("banner.noReview")` (R-101, R-103).
      - `review` → `<div role="group" aria-label={t("banner.label")}>` wrapping `<VerdictBanner verdict score findingsCount blockers agentName={review.agent_name} summary={review.summary} summarySlot={text} notes={…}/>`.
        - notes: the stale `Badge` (`t("banner.stale", { sha })`), plus **one** note: `banner.running` if running (R-102), else `banner.failed` if `newestRunFailed` (R-104).
        - No cost and no tokens are passed (R-98).
      - Import `VerdictBanner` through the `@/` alias (Constraints).
11. **client** · `_components/PrBriefCard/PrBriefCard.tsx` (+ `styles.ts`) · covers: R-01, R-05, R-48, R-81, R-92, R-96, R-97.
    - Props become `{ prId, headSha, lastReviewedSha }` (BD-10). Call `useReviewBanner`.
    - Render `<ReviewBanner>` directly after `<BriefHeader>` (BA-1).
    - The banner `text`:
      - brief loading → `aria-hidden` skeleton (BA-2);
      - `busy` → `<div role="status" aria-label={t("generating")}>` with two `Skeleton` lines (R-97);
      - brief shown (`view && !query.isError && !busy && view.brief`) → `view.brief.summary` (R-81);
      - otherwise → `undefined`, so the banner shows `review.summary` and hides it when empty (R-96).
    - `GeneratingSkeleton` keeps only the Summary group (its Review focus group goes, R-93). It is **not rendered** when the banner state is `review` (the banner's text is the skeleton, R-05/R-97).
    - `BriefBody`: drop `nav` and `ReviewFocusList`; add `showSummary` (= banner state is not `review`) guarding the summary `<p>` (R-48).
    - Update the header comment (states list, R-92).
    *Mechanical test edits, `PrBriefCard.test.tsx`:*
    - `serve()` (:88-90) routes by URL: `/brief` → `get()`. Add `/reviews` → `reviews()`, `/runs/active` → `active()` and `/runs` → `runs()`, with module-level fixtures defaulting to `[]` and reset in `beforeEach`. POST behaves as today.
    - `renderCard` (:111-121) and the F-10 render (:190-195): `<PrBriefCard prId="pr-1" headSha={HEAD} lastReviewedSha={null} />`, and add `prReview` to the messages. Delete the now-unused `nav()`, `CHANGED` and `activate` (eslint `no-unused-vars`).
    - :158-169: rename to "R-05, R-93 …". Replace :163 with `expect(within(card()).queryByText("Review focus — read these first")).not.toBeInTheDocument()`.
    - :206-238: rename to "R-08, R-48, R-71". Delete :217-231 (Review focus moves to step 12's test).
    - Delete the R-52 test :335-341.
    - In R-36 :343-363, drop `reason` (:345, :352, :359); the summary checks stay.
    - :402: count only GETs whose URL ends with `/brief`.
12. **client** · new `_components/ReviewFocusCard/{ReviewFocusCard.tsx, styles.ts, index.ts}`. Move the content of `PrBriefCard/_components/ReviewFocusList/{ReviewFocusList.tsx, styles.ts}` here and delete that folder and its `index.ts` (BD-13) · covers: R-51, R-92, R-93.
    - `ReviewFocusCard({ items, nav }: { items: ReviewFocusItem[] | null; nav: BriefNavigation })`.
    - Render a card `<section aria-labelledby={headingId}>` with the card look of `PrBriefCard/styles.ts` `cx.card` and the existing heading (`t("reviewFocus")`). The count badge shows only when `items` is non-null.
    - `items === null` → `<div role="status" aria-label={t("generating")}>` with two `Skeleton` lines (R-93). Otherwise the existing list or empty text (R-51, R-52, R-58, R-72, R-76 unchanged).
    - `BriefFileRef` now imports as `../BriefFileRef`.
13. **client** · `_components/OverviewTab/{OverviewTab.tsx, helpers.ts}` · covers: R-01, R-92, R-93, R-100.
    - `helpers.ts`: `reviewFocusCardState` (BD-11).
    - `OverviewTab`: new prop `lastReviewedSha: string | null`. Render `<PrBriefCard prId headSha lastReviewedSha />`, then the grid, then `{state !== "hidden" && <ReviewFocusCard items={state === "generating" ? null : state} nav={nav} />}`, then the PR description. Read `brief.isError` from the existing `usePrBrief` call.
    - Update the comments.
    *Mechanical test edits, `OverviewTab.test.tsx`:*
    - Add `lastReviewedSha={null}` to `tree()` (:151-159).
    - Add `const focusCard = () => screen.getByRole("region", { name: /Review focus — read these first/ })`.
    - Re-target every `within(briefCard())` that reaches a Review focus button to `within(focusCard())`: :238, :257, :278, :301, :303, :318, :342, :364.
    - :201 stays on `briefCard()`.
14. **checkpoint** · in `client/`: `node ../scripts/verify.mjs --baseline L05-pr-brief.banner` (typecheck · lint · tests) with no `new` failure. Then `implementer` hands off: reviewers next (`## Execution`).

**Tests — `test-writer`, after the review loop.** Expected values come from the requirements, not from the code.

15. **server** · `server/test/brief.it.test.ts` · new `describe('R-95 — GET /pulls/:id returns last_reviewed_sha')` next to the R-66 block (:366-383), reusing `mk` and `makePr`. Three cases:
    - (a) the row's `lastReviewedSha` is set to `'rev-1'` via `pg.handle.db.update`, and `MockGitHubClient({ detail: { last_reviewed_sha: 'from-gh' } })` → body `last_reviewed_sha === 'rev-1'` (the DB wins);
    - (b) never reviewed → `null`;
    - (c) offline: a `MockGitHubClient` subclass whose `getPullRequest` throws → `'rev-1'` from the persisted path.
    Each case asserts `PrDetail.parse(body)` succeeds.
16. **client** · `PrBriefCard.test.tsx` new `describe("verdict banner")`. Fixtures: a review with 3 findings (1 CRITICAL, 1 CRITICAL dismissed, 1 WARNING), score 61, `agent_name` "Security Reviewer", `summary` "Review text.", plus an older `kind: "summary"` row and an older `review` row. Cases:
    - R-78 banner with and without a brief, above the summary state;
    - R-79/R-83 "3 findings · 1 blockers";
    - R-80 "61" + "PR SCORE";
    - R-86 `score: null` → no "PR SCORE";
    - R-81/R-48 brief summary exactly once, inside the group "Latest review";
    - R-96 the review's summary with no brief; `summary: ""` → no text;
    - R-97 generating → verdict and counts visible, status "Generating…" inside the group, brief summary absent;
    - R-82 the newest `review` is picked over a newer `summary` row;
    - R-84/R-101 no reviews → the line, no group;
    - R-99 `/reviews` 500 → no group, no line, the brief still shows;
    - R-102 / R-103 active run with and without a review;
    - R-104 newest run `failed` and `cancelled` → the note; with an active run → the R-102 note instead;
    - R-94 stale badge "Review is for an older commit (rev1234)" for `lastReviewedSha="rev1234aaaa"` ≠ HEAD; absent when equal or null;
    - R-98 no `$` and no `→` inside the group;
    - R-105 agent badge;
    - R-87 an active run leaves the stored review shown;
    - R-88 active `[run]` → then `[]` and the reviews fixture gains the review; `await qc.refetchQueries({ queryKey: ["pr-active-runs","pr-1"] })` → the banner appears without remount;
    - R-85 every fetched URL is one of `/brief`, `/reviews`, `/runs`, `/runs/active`, and no POST;
    - R-07 with `mark(prReview)` and the banner + notes shown → `untranslated(...)` is `[]`.
    Also: `PrBriefCard/helpers.test.ts` (new) for `formatTokensK` (BD-6 table); `ReviewBanner/helpers.test.ts` (new) for every `reviewBannerState` branch, `latestReview`, `newestRun` and BA-3; `VerdictBanner.test.tsx` adds `notes` and `summarySlot` rendering, and the existing smoke stays as is.
17. **client** · `ReviewFocusCard/ReviewFocusCard.test.tsx` (new): the R-51 assertions removed in step 11 (heading + count "2", model order, button names, R-76 tag, `activate` called with path and line), R-52 empty with count 0, R-36 reason as literal text with no link, R-93 `items={null}` → heading + status "Generating…" + no count. `OverviewTab.test.tsx` adds:
    - R-01/R-92 document order brief → Intent/Blast → focus card → description, and the focus card is not inside the brief block;
    - R-93 generating → status "Generating…" inside the focus card, and no "Review focus" text inside the brief block;
    - R-100 the card is absent for `brief: null`, for a `/brief` 500, and while the brief read is pending;
    - add `prReview` to the provider.

## Execution

Single-agent (BD-1). The main session spawns and sequences. Writers run one at a time; read-only agents run in parallel. Recommended entry point: `/run-plan specs/L05-pr-brief.banner.md --test-writer`.

**No phase 0.** This plan accepts **no cross-model review**. `specs/L05-pr-brief.banner.plan-review.md` does not exist and is not expected, so `/run-plan`'s preflight must **not** stop on its absence.

| Phase | Agent | Steps | Reads | Produces | Parallel with |
|---|---|---|---|---|---|
| 0 | — | — | — | *none — no cross-model review for this amendment* | — |
| 1 | `implementer` | baseline, 1–14 (server 1–3 first, then client 4–14), including the mechanical test edits in 9, 11, 13 | this file | baseline files + working tree + `verify.mjs` output per package | — |
| 2 | `architecture-reviewer` | — | the open change | findings | `plan-verifier`, frontend lenses |
| 2 | `plan-verifier` — **gap** pass | 1–14 | this file | verdict per item | `architecture-reviewer`, frontend lenses |
| 2 | frontend lenses: `react-best-practices`, `next-best-practices` | — | the open `client/` change | findings | the two above |
| 3 | `implementer` — fix rounds, resumed via `SendMessage` with `.devdigest/cache/sdd/L05-pr-brief.banner/findings.md`, until no CRITICAL/WARNING/gap is open (max 3, then the user decides) | the findings | the findings file | fixes + `verify.mjs` | — |
| 4 | `test-writer` | 15–17 | this file, `## Done when` | test files + `verify.mjs` output | — |
| 5 | `plan-verifier` — **final** | what phase 2 did not mark `done`, plus 15–17 | this file + the phase-2 report | verdict per item | — |
| 6 | main session | — | — | `/pr-self-review` | — |

`implementer` leaves to `test-writer` every **new** assertion (steps 15–17). It does only the listed mechanical edits to existing tests (BD-12).

## Verification

Run from inside the package directory. `verify.mjs` owns the commands; the client lane includes eslint.

| Package | Baseline (phase 1, before the first edit) | After each step | Final |
|---|---|---|---|
| server | `node ../scripts/verify.mjs --save-baseline L05-pr-brief.banner --it` | `… --baseline L05-pr-brief.banner --related <files>` | `… --baseline L05-pr-brief.banner --it` (check the **skipped** count) |
| client | `node ../scripts/verify.mjs --save-baseline L05-pr-brief.banner` | `… --baseline L05-pr-brief.banner --related <files>` | `… --baseline L05-pr-brief.banner` |

## Done when

- [ ] R-95: `PrDetail.last_reviewed_sha` is byte-identical in both `platform.ts` copies; `GET /pulls/:id` returns it on the GitHub and offline paths; `server/test/brief.it.test.ts` "R-95" passes (not skipped).
- [ ] R-01, R-92, R-100: Overview order is PR Brief → Intent | Blast → Review focus card → description. There is no card without a brief, and none when the brief read fails (`OverviewTab.test.tsx`).
- [ ] R-05, R-93: while generating, the summary skeleton is in the block (or the banner), Risk areas are in Intent, and Review focus is in its card.
- [ ] R-51: Review focus behaviour is unchanged in its card (`ReviewFocusCard.test.tsx`; the navigation tests in `OverviewTab.test.tsx` are green).
- [ ] R-71, R-91: visible line "Generated … · openai/gpt-4.1 · $0.014 · 3.1K→0.4K", with no tooltip (`PrBriefCard.test.tsx`, `helpers.test.ts`).
- [ ] R-78…R-89, R-94, R-96…R-99, R-101…R-105: every case of step 16 is green in `PrBriefCard.test.tsx` and `ReviewBanner/helpers.test.ts`.
- [ ] R-48, R-81: the brief summary renders once, as the banner's text, while a banner is shown.
- [ ] R-07: the marked-messages check is green with the banner and notes shown.
- [ ] R-90: `server/test/brief-inputs.test.ts` and `brief-prompt.test.ts` are unchanged and green.
- [ ] Agent runs is unchanged: `VerdictBanner.test.tsx` smoke is green, and `ReviewRunAccordion` counts through `verdictCounts`.
- [ ] `node ../scripts/verify.mjs --baseline L05-pr-brief.banner --it` in `server/` and `node ../scripts/verify.mjs --baseline L05-pr-brief.banner` in `client/` (typecheck · lint · tests): no `new` failure.
- [ ] No `package.json`, lockfile or migration in the diff.

## Left to reviewers

- architecture: `pulls/routes.ts` stays a flat Drizzle route (no new query; BREC-2). Contract parity of the two copies. `ReviewBanner` composes queries in a colocated hook (BD-8), not in `lib/`. `VerdictBanner` is extended and not forked (BD-3). `ReviewFocusList` is moved, with no orphan (BD-13).
- security: `last_reviewed_sha` is a commit SHA from the caller's own workspace-scoped row (no new input surface). The banner renders the brief and review summaries as text children (R-36).
- frontend lenses: the `useWhenActiveRunsEnd` effect with a callback ref; the `role="status"` uniqueness per region; the `VerdictBanner` slot API.

## Risks / open questions

None block a step. BA-1…BA-6 are applied with option A and can be overridden by the user. If BA-4 changes to B, only `reviewBannerState` and its test change. If BA-2 changes, only the `text` choice in step 11 changes.
