# L05 — PR Brief · verification record

## /run-plan L05-pr-brief — done
Plan `specs/L05-pr-brief.md` · Requirements `specs/L05-pr-brief.requirements.md` (R-01…R-77, amended through F-23) · Branch `lesson/L05-lab-homework` · Fix rounds: 4

Commits:

| Commit | What |
|---|---|
| `75fe1ba` | docs(specs): requirements + plan, committed before any feature code |
| `21427de` | feat(brief): steps 1–22 + review fix round 1 |
| `715aad3` | test(brief): steps 23–25 |
| `cffa339` | fix(brief): F-22, F-23 (+ R-73 / D-38 amended) |
| `e37fea7` | fix(brief): F-24 (lint error that blocked `pnpm build`) |
| `8d3cb30` | refactor(brief): F-25…F-32 (pre-PR self-review suggestions) |

Execution followed the plan's `## Execution` (user decision, 2026-11-01). Server and client implementers ran in parallel, each owning its own files. Tests came in a separate `test-writer` phase, with server and client writers also in parallel. Review phase 3 ran five read-only reviewers in parallel: `plan-verifier` (gap pass), `architecture-reviewer`, a security lens, the perf rubric, and `/code-review` at high.

## Findings
33 total · fixed 31 · accepted 2 · wontfix 0 · open 0. The ledger is copied below.

Accepted, to go into the PR description:
- **F-11.** `maxRetries: 0` stops only the module's own re-asks. Network retries in the adapter and SDK on 429, 5xx or ECONNRESET can still send more than one HTTP request per generation, while the log reports `model_calls: 1`. The user allowed this under Q-10 / R-12: adapter retries are permitted and INV-3 forbids touching the adapters. It is a known limit (plan R-1).
- **F-02.** `container.smartDiffRole` stays on the composition root. Moving `classifyFile` into `_shared` would mean changing `reviews/smart-diff`; the user accepted the implementer's dispute.

## Verification
Last package runs, against baseline `L05-pr-brief @ 75fe1ba`. Both baselines had 0 failures.

```
verify server · baseline L05-pr-brief @ 75fe1ba
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 746 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 144 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
```
verify client · baseline L05-pr-brief @ 75fe1ba
  typecheck   ✅ 0 errors
  tests       ✅ 408 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
```
pnpm arch (server): ✔ no dependency violations found (210 modules, 717 dependencies cruised) · 21 known violations ignored
next lint --dir src (client): ✔ No ESLint warnings or errors
pnpm build (client): exit 0 — 13 routes, /repos/[repoId]/pulls/[number] 28.6 kB
```
`/pr-self-review`:
- Gates G1–G12: 0 CRITICAL, 0 WARNING.
- Lens passes (frontend, backend, security + zod): 0 CRITICAL, 0 WARNING, 8 SUGGESTION, all 8 fixed in `8d3cb30` and confirmed by `architecture-reviewer`.
- Verdict `approve`, `blocked: false`, HEAD `8d3cb30`.

Static checks after the last round:
- **INV-2:** exactly one `completeStructured(` call site in `server/src/modules/brief`.
- **INV-9:** `.patch` is read only in `inputs/helpers.ts`, the numeric changed-line ranges.
- **INV-1 / G1:** `diff -r server/src/vendor/shared client/src/vendor/shared` is empty.

## Not verified
| Item | What would settle it |
|---|---|
| Manual check: one `prompt.assembled` (`"kind":"brief"`) and one `brief.generation.finished` (`"model_calls":1`) in the API log for one generation, with a real key | Stack up, a real `risk_brief` key, click Generate, read the API log |
| A Review focus click scrolls the real browser to the line; Back returns to Overview at the old scroll position (AP-9, F-14) | Manual browser check (jsdom covers it with spied `scrollIntoView` / `scrollTo`) |
| Plan R-7: a strict json_schema provider accepts the `severity` enum | One real provider call |
| Cross-model review of the plan (REC-1, phase 0) | The user runs it in ChatGPT / Gemini; the note goes to `specs/L05-pr-brief.plan-review.md` and the PR description |

## Final plan-verifier report (phase 7, verbatim)

**Plan:** `specs/L05-pr-brief.md`, **final pass** (branch `lesson/L05-lab-homework`, HEAD `cffa339`; baseline `L05-pr-brief @ 75fe1ba`). Scope: steps 23–25, every `## Done when` line (12), the `pnpm build` leg of step 22, the manual check, and the INV-2 / INV-9 re-greps. Everything the phase-3 gap pass marked `done` (steps 1–22, INV-13) was not re-graded, but the outcome checks ran in full and showed no regression. Where review fix rounds changed behaviour (F-04, F-07, F-10, F-12–F-17, F-21–F-23), grading followed the findings' Resolution column. F-02 and F-11 are `accepted` by the user and were not graded. 19 items in this pass.

| # | Item | Verdict | Evidence | Note |
|---|---|---|---|---|
| 1 | Step 23: server-unit, 23a inputs, 23b prompt, 23c grounding, 23d helpers, 23e service | `done` | `server/test/brief-inputs.test.ts` (22 cases), `brief-prompt.test.ts` (20), `brief-grounding.test.ts` (24), `brief-helpers.test.ts` (8), `brief-service.test.ts` (42). The parity test at `brief-inputs.test.ts:173-174` checks `parseClosingIssues` from `brief/inputs/helpers` against `reviews/intent/sources`. Unique patch marker at `brief-prompt.test.ts:191`. One-call assertions at `brief-service.test.ts:298,375,388`. Exactly one `prompt.assembled` and one `brief.generation.finished` line at `:477,485`. Byte-identical determinism at `:462`. Suite green: 746 passed, 0 skipped. | `a/b/o3` (F-23) is covered in `brief-service.test.ts` and `brief-helpers.test.ts` |
| 2 | Step 24: server-integration `server/test/brief.it.test.ts`, Docker | `done` | `server/test/brief.it.test.ts` (13 cases). `--it` run: 144 passed, 0 failed, 0 skipped. | |
| 3 | Step 25: client (`pnpm test`, jsdom), 25a–25g | `done` | Added in `715aad3`: `PrBriefCard.test.tsx`, `lib/hooks/brief.test.tsx`, `BriefRiskAreas.test.tsx`, `BriefFileRef.test.tsx`, `OverviewTab.test.tsx`; extended `FileCard.test.tsx`, `DiffTab.test.tsx`, `SmartDiffGroup.test.tsx`, `DiffTab/helpers.test.ts`; new `page.test.tsx` for 25g. Client suite: 408 passed, 0 failed, 0 skipped. | |
| 4 | Done when, Contract (step 1): both `brief.ts` copies byte-identical, both packages typecheck | `done` | `diff -r` of the two `vendor/shared` folders prints nothing. Server and client typecheck: 0 errors. | |
| 5 | Done when, Container + log kind (step 2): `pnpm arch` green, no new cycle | `done` | `container.ts:168` `get blast`, `:177` `smartDiffRole`. `platform/prompt-log.ts:25` widens `kind` to `'review' \| 'intent' \| 'brief'`. Server verify: arch reports no new violation. | |
| 6 | Done when, Inputs (steps 4, 10a): R-09, R-10, R-26, R-27, R-29, R-64, R-65 | `done` | `brief-inputs`, `brief-prompt` and `brief-service` tests pass in the 746-test unit run. | |
| 7 | Done when, Title input (steps 4, 5, 10a): the PR title sits in its own untrusted block and is never trimmed | `done` | `brief-prompt` and `brief-service` tests pass; `brief.it.test.ts` passes (144 integration, 0 skipped). | |
| 8 | Done when, One call (steps 9, 10c): one `completeStructured`, `maxRetries: 0`, 2,000 tokens / 60 s or 10,000 / 120 s; a JobRunner re-invocation never makes a second call; one `prompt.assembled` and one `brief.generation.finished` | `done` | The single call site is `service.ts:391`. `maxRetries` comes from `GENERATION_MAX_RETRIES` (`:398`), temperature from `GENERATION_TEMPERATURE` (`:395`), and the limits are at `:396-397`, all inside `withTimeout` (`:390-405`). The synchronous claim is at `:331-333`. `callLimits` / `isReasoningModel` at `helpers.ts:107-120` (`lastIndexOf('/')`, F-23). | Under F-12 the deadline is `min(limit, 120000 − margin − elapsed)` via `callDeadlineMs` (`service.ts:375-383`). The outcome is still met. |
| 9 | Done when, Budget (step 5): R-19…R-24 | `done` | `brief-prompt.test.ts` passes; the R-23 persistence check is in `brief.it.test.ts`. | F-15 (`sliceWhole`) cuts more strictly; the outcome is still met. |
| 10 | Done when, Invented paths (step 6): R-30…R-35, R-38 | `done` | `brief-grounding.test.ts` passes. | |
| 11 | Done when, Cache + staleness (steps 7, 8, 10b, 12): R-03, R-16, R-41, R-44, R-45, R-47, R-66 | `done` | `pulls/routes.ts` adds `headSha: detail.head_sha`. Outside `db/`, `prBrief` is used only in `brief/repository.ts`. `brief-helpers` and `brief.it` tests pass. | |
| 12 | Done when, API + background (steps 10c, 11): 202, 409 when running, 409 with no key, 404, `--it` with 0 skipped | `done` | `routes.ts:48` GET, `:55` POST (202). `service.ts:265-268` checks and sets the lock with no await between them. `service.ts:274` returns 409 when there is no key. Integration: 144 passed, 0 skipped. | POST also has a rate limit (F-06). |
| 13 | Done when, Overview block (steps 13–17, 19): every state and label, model text inert | `done` | `hooks/brief.ts:16,29`: polls every 2,000 ms and stops when the query errors (F-10). Client suite: 408 passed. | |
| 14 | Done when, Risk areas in the Intent card (steps 16, 18, 19) | `done` | `IntentCard.tsx:31,39,101` takes an optional `riskAreas` slot. `BriefRiskAreas` and `OverviewTab` tests pass. | F-16 (the skeleton sits in the Intent slot) supersedes AP-11 / D-27 because the user made it a must-fix. |
| 15 | Done when, Overview → Files changed (steps 19–22): the URL, opening the group and file, highlight and focus, the notice for 4 s, Back restores the scroll | `done` (jsdom) | `page.tsx:77,81,85` use `replace` for tabs and `push(…, { scroll: false })` for focus. `NOT_IN_DIFF_MS = 4000` is in `OverviewTab/constants.ts:4`. `CodeLine.tsx:96-97` sets `tabIndex` and `aria-current="location"`. `FileCard.tsx:162` renders `diffViewer.lineNotInDiff`. All the related tests pass. | The real-browser scroll is item 18. |
| 16 | Done when, No regression: INV-1…INV-14 hold, no `new` failure, and `client pnpm build` passes | `partial` at grading time; **since settled** | No new failures. `git diff 75fe1ba` is empty over reviewer-core, adapters, `resilience.ts`, `jobs.ts`, `adapters.ts`, `package.json`, lockfiles, `server/src/db` and the dep-cruiser baseline. | The `pnpm build` leg was deferred at grading time. It later failed on lint (F-24), was fixed in `e37fea7`, and has passed since (exit 0, re-run after `8d3cb30`). |
| 17 | Step 22 checkpoint / D3 / K2 / F-20: `pnpm build` with `pnpm dev` stopped | `cannot verify` at grading time; **since settled** | Deferred by the user. | Settled: `pnpm build` exit 0 after F-24, and again after round 4. |
| 18 | Manual check: the log lines with a real key, the real scroll, Back | `cannot verify` | Needs the full stack, a real key and a browser. | Unit tests check the log lines with a mock; jsdom checks the scroll. |
| 19 | INV-2: exactly one `completeStructured(` | `done` | `grep` finds one hit, `service.ts:391`. | Re-confirmed after the fix rounds. |
| 20 | INV-9: `.patch` read only in `inputs/helpers.ts` | `done` | One hit, `inputs/helpers.ts:84`. Marker test at `brief-prompt.test.ts:191`. | Re-confirmed. |

Deviations the verifier observed, all of which still meet the outcome:
- **F-12:** the deadline is computed by `callDeadlineMs`.
- **F-16:** the skeleton renders in the Intent slot.
- **F-10:** polling also stops when the query errors.
- **F-07:** the handled state lives in `DiffTab` and the URL is kept.
- POST has a rate limit, which was not in the plan.

Changed outside the plan:
- the `shell.json` keys added for F-21, which INV-13 requires;
- the header line in `vendor/shared/index.ts`, which step 1 planned.

**Summary at grading time:** done 16 · partial 1 · not implemented 0 · contradicted 0 · cannot verify 2. The `partial` and one `cannot verify` were the deferred client `pnpm build`, which has passed since. The browser manual check is the only one still open.

## Findings ledger

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | SUGGESTION→must-fix | `server/src/modules/brief/types.ts:24` | Ring-3 type `Db` imported (type-only) into a Ring-1 types file via `BriefServiceDeps.db` (onion-architecture: ring crossed by a type) — move `BriefServiceDeps` to `service.ts` or a `deps.ts` | fixed | BriefServiceDeps → service.ts:114; types.ts no db import |
| F-02 | 1 | architecture-reviewer | SUGGESTION→must-fix | `server/src/platform/container.ts:175-177` | `smartDiffRole` is a pure function on the composition root (narrowest ring wins) | accepted | user 2026-11-01 accepted the dispute — implementer S: moving classifyFile to modules/_shared needs ownership of reviews/smart-diff/{helpers,constants}.ts; a _shared re-export breaks no-cross-module, a copy forks the single classifier |
| F-03 | 1 | architecture-reviewer | SUGGESTION→must-fix | `client/.../_components/BriefFileRef/types.ts:6`; `page.tsx:~76-96` | `BriefNavigation` type in a sibling leaf folder; URL assembly in `page.tsx` (page stays thin) | fixed | BriefNavigation → lib/hooks/brief.ts:64; URL helpers DiffTab/helpers.ts:94-112 |
| F-04 | 1 | security | WARNING | `server/src/modules/brief/grounding/helpers.ts:376` ← `service.ts:381-383` | `classifyGenerationError` maps ANY exception in `run()` (DB/collect/renderPrompt) to `provider_error` with the raw message (≤300) → shown in UI as last_failure (SQL text, host paths). Fix: keep raw message only for errors from the `completeStructured`/`withTimeout` call (tag them); other errors → fixed text, real error only in the warn log; scrub `sk-…` in `oneLine` | fixed | ModelCallError (grounding/helpers.ts:48) keeps provider msg only for call errors; others fixed text; secrets masked :183-185; cause only in warn log service.ts:458 |
| F-05 | 1 | security | SUGGESTION→must-fix | `server/src/prompts/brief.system.md:3` | guard paragraph lists inputs this prompt doesn't have (diff, README) and omits the real blocks (pr-title, linked-issue, spec:*, …) | fixed | brief.system.md:3 names the real blocks (departs from D-22 verbatim) |
| F-06 | 1 | security | SUGGESTION→must-fix | `server/src/modules/brief/routes.ts:52` | POST generate has only the app-wide rate limit; optional per-route `rateLimit: { max: 10, timeWindow: '1 minute' }` | fixed | routes.ts:53-55 rateLimit 10/min |
| F-07 | 1 | perf rubric | WARNING | `client/src/components/diff-viewer/FileCard/FileCard.tsx:68-69,86-96`; `SmartDiffGroup.tsx:33-37`; `page.tsx:95-96` | focus target is never consumed: `handledKey` ref dies with the FileCard, `?file=&line=` stays in URL → collapsing/reopening the group or toggling Smart/Original remounts the card and re-forces open + re-scrolls to the target. Fix: after the first successful scroll `router.replace` without `file`/`line` (keep `tab=diff`), or hold the handled key above FileCard | fixed | handled state in DiffTab.tsx:58-61 + DiffFocus.onHandled (focus.ts:17,23), FileCard.tsx:81-97; URL kept (R-77) |
| F-08 | 1 | perf rubric | SUGGESTION→must-fix | `server/src/modules/brief/service.ts:469-474` | `readSpecs` unbounded 2×N queries per enabled agent; batch with `inArray` or `mapBounded` | fixed | mapBounded SPEC_READ_CONCURRENCY=4 service.ts:598 |
| F-09 | 1 | perf rubric | SUGGESTION→must-fix | `server/src/modules/brief/service.ts:270,405-406` | `getPull`/`getPrFiles` (with patches) read twice per generation (brief + blast.forPull) | fixed | blast/service.ts forResolvedPull; brief reads getPull/getPrFiles once |
| F-10 | 1 | perf rubric | SUGGESTION→must-fix | `client/src/lib/hooks/brief.ts:26` | polling never stops while GET keeps erroring (last data still `generating:true`); stop on `status==='error'` or cap by `fetchFailureCount` | fixed | brief.ts:29 stops polling on error; PrBriefCard.tsx:64 shows error+Retry |
| F-11 | 1 | code-review | CRITICAL (reviewer) | `server/src/modules/brief/service.ts:284` | `maxRetries:0` doesn't stop adapter `withRetry` (`adapters/llm/openai.ts:97`) + SDK default retries on 429/5xx/ECONNRESET → one generation can send several paid requests while the log says `model_calls: 1`. NOTE: user decision Q-10 / R-12 explicitly allows adapter network retries; INV-3 forbids touching adapters; plan R-1 accepted. Open question: log the true attempt count? | accepted | user 2026-11-01: per Q-10/R-12 adapter network retries allowed; known limit (plan R-1); goes into the PR description |
| F-12 | 1 | code-review | WARNING | `server/src/modules/brief/service.ts:299`; `platform/jobs.ts:67` | collect + reasoning-model call share JobRunner's 120 s wall → `jobs` row marked failed although the brief is stored; the queue slot is freed while the LLM call still runs (>3 concurrent). Plan R-4 accepted the misleading jobs row; the slot leak is new | fixed | callDeadlineMs grounding/helpers.ts:243 = min(limit, 120000−5000−elapsed); service.ts:375-399 |
| F-13 | 1 | code-review | WARNING | `client/.../PrBriefCard/PrBriefCard.tsx:49` | `generate.error` alert (409 running / no key) never clears after the view changes | fixed | viewSignature PrBriefCard.tsx:36-38,56 / helpers.ts:82 |
| F-14 | 1 | code-review | WARNING | `client/.../OverviewTab/OverviewTab.tsx:44` | Overview scroll restore fires before sibling cards settle (lands too high) and also on a plain tab click, not only Back | fixed | {y,back} + popstate one-shot (useBriefNavigation.ts:46), useOverviewScrollRestore.ts waits useIsFetching()==0 ≤3 s |
| F-15 | 1 | code-review | WARNING | `server/src/modules/brief/prompt/helpers.ts:160` | `fitText` `slice(0, room)` can split a surrogate pair → lone surrogate in the prompt → provider 400 | fixed | sliceWhole inputs/helpers.ts:23, used in fitText, issue cut, summary cap |
| F-16 | 1 | code-review | SUGGESTION→must-fix | `client/.../PrBriefCard/PrBriefCard.tsx:67` | "Risk areas" skeleton shown in the brief card while risks render in the Intent card (AP-11 chose this placement) | fixed | BriefRiskAreasSkeleton in Intent slot while generating (overrides AP-11/D-27 per user must-fix) |
| F-17 | 1 | code-review | SUGGESTION→must-fix | `server/src/modules/brief/service.ts:152` | `getView` reads settings + secrets on every 2 s poll | fixed | view-state cache ≤5 s only while generating, service.ts:192-250 |
| F-18 | 1 | code-review | SUGGESTION→must-fix | `server/src/platform/container.ts:168`; `server/src/modules/blast/routes.ts:20` | `blast/routes.ts` still builds its own BlastService instead of `container.blast` (outside stream S ownership) | fixed | blast/routes.ts:20 uses container.blast |
| F-19 | 1 | code-review | SUGGESTION→must-fix | `client/.../OverviewTab/useBriefNavigation.ts:24`; `page.tsx` | `changedPaths` new array each render → memo never hits | fixed | page.tsx:48 memo |
| F-20 | 1 | plan-verifier | gap | step 22 / D3 / K2 | `partial` — client `pnpm build` not run (pnpm dev on :3000) | fixed | user 2026-11-01: run at the pre-PR gate with pnpm dev stopped ; pnpm build exit 0 after F-24 (orphaned dev PID 48148 killed with user approval) |
| F-21 | 1 | plan-verifier | gap | INV-13 | `partial` — new client files not fully scanned for hardcoded user-facing strings | fixed | strings → shell.json (prDetail.*, diffViewer.addComment/commentPostFailed); AddCommentButton child |
| F-22 | 2 | test-writer T-C | SUGGESTION→must-fix | `client/.../OverviewTab/useBriefNavigation.ts` (activate) | a `{once:true}` popstate listener is added on every in-diff click; it lingers when the user returns via a tab click instead of Back — listeners pile up | fixed | one listener per PR: OverviewTab/helpers.ts:70-92 armOverviewBack/disarmOverviewBack; useBriefNavigation.ts:46; useOverviewScrollRestore.ts:25 |
| F-23 | 2 | test-writer T-S | gap | R-73 vs D-38 / `server/src/modules/brief/helpers.ts` isReasoningModel | spec says "any `<vendor>/` prefix", plan D-38 says strip ONE; `a/b/o3` is ambiguous — untested | fixed | user 2026-11-01: take the segment after the LAST `/` (a/b/o3 → o3 → reasoning); amend R-73 + D-38 ; helpers.ts:109 lastIndexOf("/"); R-73 + D-38 amended |
| F-24 | 3 | pnpm build (F-20) | test | `client/.../PrBriefCard/_components/ReviewFocusList/ReviewFocusList.tsx:10` | `next build` fails at lint: `no-restricted-imports` — `../../../BriefFileRef` climbs 3+ levels; use the `@/` alias. verify.mjs does not run eslint, so all suites were green | fixed | ReviewFocusList.tsx:10 uses the @/ alias; next lint over src: no warnings or errors |
| F-25 | 4 | pr-self-review (backend) | SUGGESTION→must-fix | `server/src/modules/brief/service.ts:140-153` | third copy of `mapBounded` (also `project-context/service.ts:257`, `onboarding/service.ts:194` `mapLimit`) → one pure file in `platform/` | fixed | platform/concurrency.ts mapBounded; brief/project-context/onboarding copies removed |
| F-26 | 4 | pr-self-review (backend) | SUGGESTION→must-fix | `server/src/modules/brief/service.ts:43` | Ring-2 service imports Ring-3 `platform/prompts.js` directly → inject `renderPrompt` through `BriefServiceDeps` | fixed | renderPrompt injected via BriefServiceDeps (service.ts:135-140; routes.ts:47) |
| F-27 | 4 | pr-self-review (security+zod) | SUGGESTION→must-fix | `server/src/modules/brief/schema.ts:81-106`; `grounding/helpers.ts:152,167` | model strings kind/title/explanation/reason stored uncapped → cap with `sliceWhole` in `groundAnswer` (schema unchanged, strict mode) | fixed | groundAnswer caps kind 40/title 200/explanation 1000/reason 300 via sliceWhole (grounding/helpers.ts:159-179; constants.ts:37-41) |
| F-28 | 4 | pr-self-review (zod) | SUGGESTION→must-fix | `*/vendor/shared/contracts/brief.ts` `PrBriefView.feature_model.provider` | `z.string()` → existing `Provider` enum; both copies in one commit (G1) | fixed | feature_model.provider: Provider (brief.ts:300), both copies identical, client tsc 0 |
| F-29 | 4 | pr-self-review (frontend) | SUGGESTION→must-fix | `client/.../PrBriefCard/constants.ts:3-4`; `TourHeader/constants.ts:2`; `onboarding/AddRepoView.tsx:82,85` | `/settings/api-keys` in 3 places → one constant in `src/lib` | fixed | lib/settings-urls.ts:4 API_KEYS_HREF; PrBriefCard, TourHeader/constants (re-export), AddRepoView use it. Left: SettingsView.tsx:24, vendor/ui/nav.ts:58 (out of scope) |
| F-30 | 4 | pr-self-review (frontend) | SUGGESTION→must-fix | `client/.../OverviewTab/helpers.ts:67-92` | module-level Map + window listeners in a "pure" helpers.ts → own module (e.g. `backListener.ts`) | fixed | OverviewTab/backListener.ts (new); helpers.ts pure again |
| F-31 | 4 | pr-self-review (frontend) | SUGGESTION→must-fix | `SmartDiffGroup.tsx` (mustOpen effect); `FileCard.tsx:86-88` | adjust-state-on-prop-change via useEffect → adjust during render (prev-key pattern) | fixed | openedFor prev-key during render: FileCard.tsx:87-91, SmartDiffGroup.tsx:35-44 |
| F-32 | 4 | pr-self-review (frontend) | SUGGESTION→must-fix | `client/src/components/diff-viewer/FileCard/FileCard.tsx:92-100`; `DiffTab.tsx` | eslint-disable exhaustive-deps for `onHandled` → stable callback (useCallback in DiffTab or latest-ref) | fixed | useCallback onHandled DiffTab.tsx:62,64; FileCard.tsx:102 deps complete, eslint-disable removed |
| F-33 | 5 | manual browser check | WARNING | `client/src/app/repos/[repoId]/pulls/[number]/_components/PrBriefCard/_components/BriefHeader/BriefHeader.tsx:63` | a brief generated after page load read "Generated in 47 seconds": next-intl fixes `useNow` to the server-render time and ticks every 60 s | fixed | `now` clamped to `generated_at`; regression test in `PrBriefCard.test.tsx`; verified "Generated now" in the browser |

## Manual browser check (2026-11-02, test PR malinovskiy-alex/dev-digest#33)
Done after the run, with `risk_brief` set to `openrouter/openai/gpt-4.1`. The default `openai/gpt-4.1` had no OpenAI key, so the card showed the R-68 no-key state as designed.
- **Generate:** brief rendered with summary, Review focus (4 items) and "Generated without: linked issue". Risk areas appeared in the Intent card, each with a file.
- **API log:** one `prompt.assembled` (`kind: "brief"`) and one `brief.generation.finished` with `model_calls: 1`, `attempts: 1`, `input_tokens: 5557`, `cost_usd: 0.015764`, `duration_ms: 3841`.
- **Review focus `resilience.ts:40`:** opened `?tab=diff&file=…&line=40`, the file was outlined and new-side line 40 highlighted. Back returned to Overview at the previous scroll position.
- **Reload:** the brief showed immediately with no new `brief.generation.finished` line.
- **Regenerate:** the generating skeleton showed, then the new brief.
- **New commit pushed to the PR:** the "Brief is for an older commit (8e6908f)" badge showed, with no automatic regeneration.
- **Found here:** F-33 (fixed).
