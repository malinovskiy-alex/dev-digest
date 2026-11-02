# L05 — PR Brief amendment (verdict banner) · verification record

## /run-plan L05-pr-brief.banner — done
Plan `specs/L05-pr-brief.banner.md` · Requirements `specs/L05-pr-brief.requirements.md` (R-78…R-105, plus amended R-01, R-05, R-07, R-48, R-51, R-71) · Branch `lesson/L05-lab-homework` · Fix rounds: 2

| Commit | What |
|---|---|
| `b534d6b` | docs(specs): amended requirements and the plan, committed before any code |
| `824c157` | feat(brief): steps 1–14 plus review fixes B-01…B-05 |
| `02ea27c` | test(brief): steps 15–17 |
| `49f0fe2` | fix(brief): B-06, found in the manual browser check |

Execution was single-agent with `--test-writer` and no phase 0. BA-1…BA-6 were set to option A by the coordinator; they are non-blocking.

## Findings
6 findings: 6 fixed, 0 accepted, 0 open. The full table is in the ledger below.

**B-06 was missed by every automated check.** Typecheck, lint, all 473 client tests and the final plan-verifier pass were all green, yet every PR page crashed in the browser with `useEffectEvent is not a function`. The Next 15 App Router renders with its bundled React, while vitest uses React 19.2 from `node_modules`. The lesson is recorded in `client/INSIGHTS.md`.

## Verification
These runs are the final plan-verifier's, at `02ea27c`. B-06 later changed only `client/src/lib/hooks/reviews.ts`; its re-run was client typecheck · lint · 473 passed.
```
verify server · baseline L05-pr-brief.banner @ b534d6b
  typecheck   ✅ 0 errors
  arch        ✅ no new violation
  tests       ✅ 746 passed · 0 failed (0 baseline, 0 new) · 0 skipped
  integration ✅ 148 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```
```
verify client · baseline L05-pr-brief.banner @ b534d6b
  typecheck   ✅ 0 errors
  lint        ✅ no errors
  tests       ✅ 473 passed · 0 failed (0 baseline, 0 new) · 0 skipped
```

## Manual browser check (2026-11-02, after B-06)
**PR #34** (review with blockers):
- The banner shows "Request changes · 6 findings · 4 blockers · Security Reviewer" and a "0 PR SCORE" ring.
- The brief summary is the banner text.
- The run line reads `openrouter/anthropic/claude-sonnet-5.5 · $0.029 · 9.0K→1.1K`.
- Review focus is its own card below Blast radius.

**PR #33** (approve):
- The banner shows "Approve · 0 findings · General Reviewer" and "100 PR SCORE".
- The badge "Brief is for an older commit (8e6908f)" is shown.

## Final plan-verifier report (summary)
Graded at `02ea27c`, before B-06 was found:
- **Items:** 15 in total (steps 15–17 and 12 `Done when` lines). All 15 are `done`: 0 partial, 0 not implemented, 0 contradicted, 0 cannot verify. Verdict: **complete**.
- **Deviations:** B-01 to B-05 supersede plan details. The outcome is met for each.

## Findings ledger

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| B-01 | 1 | architecture-reviewer | SUGGESTION→must-fix | `client/.../PrBriefCard/_components/ReviewBanner/helpers.ts:4` | pure helper imports `verdictCounts` via the `VerdictBanner` component index (pulls the component into its graph); optional: promote `verdictCounts` to `src/lib/` (2 consumers) | fixed | lib/verdict-counts.ts:5; ReviewRunAccordion:14 + ReviewBanner/helpers:4 import it |
| B-02 | 1 | frontend lenses | WARNING | `client/.../ReviewBanner/useReviewBanner.ts:18-21`; `page.tsx` onRunDone (~186) | after a run ends only `["reviews"]`/`["pr-runs"]` are invalidated; `["pull", prId]` (source of `last_reviewed_sha`) is not → stale badge stays on a current review until remount (R-88 + R-94). Fix: invalidate `["pull", prId]` in both onEnd and onRunDone | fixed | ["pull",prId] invalidated: useReviewBanner.ts:23, page.tsx:194 |
| B-03 | 1 | frontend lenses | SUGGESTION→must-fix | `PrBriefCard.tsx:71`; `BriefRiskAreasSkeleton.tsx:13`; `ReviewFocusCard.tsx:33` | three identical "Generating…" role=status regions on one page; keep one live region, others aria-hidden / aria-busy | fixed | one live status (PR Brief block); Risk-areas + Review focus skeletons aria-hidden, card aria-busy |
| B-04 | 1 | frontend lenses | SUGGESTION→must-fix | `PrBriefCard.tsx:64-69` + `:93-98` | R-04 load with a review: banner skeleton + "Loading brief…" skeleton stacked; keep one | fixed | banner text slot holds the single Loading brief… status; block skeleton skipped (PrBriefCard.tsx:67,95) |
| B-05 | 1 | frontend lenses | SUGGESTION→must-fix | `client/src/lib/hooks/reviews.ts:45-48`; `IntentCard.tsx:57-63` | ref-in-effect → `React.useEffectEvent` (React 19.2); IntentCard keeps a duplicate inline transition (BREC-1) | fixed | useEffectEvent reviews.ts:46-48; IntentCard on useWhenActiveRunsEnd (BREC-1) |
| B-06 | 3 | manual browser check | CRITICAL | `client/src/lib/hooks/reviews.ts:46-48` (B-05) | PR page crashes: `React.useEffectEvent is not a function` — Next 15 App Router renders with its bundled `next/dist/compiled/react`, which lacks stable `useEffectEvent`; vitest uses node_modules react 19.2.7 so all tests passed. Fix: revert to the latest-callback ref pattern | fixed | ref pattern back in reviews.ts:47-54; no useEffectEvent left; verified in the browser on PR #33/#34 |
