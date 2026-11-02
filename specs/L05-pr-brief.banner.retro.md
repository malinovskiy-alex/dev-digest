# Retro — L05 PR Brief amendment (verdict banner) · 2026-11-02
Session `00782d22-b8dc-4c90-9b52-e467e0b50c55` (the same session as the main run; see `L05-pr-brief.retro.md`) · Branch `lesson/L05-lab-homework`

## Numbers
The session total, both runs together, is: **231.86M input (222.83M cache read, 9.03M cache write, 2.4k uncached) · 1.08M output · 1115 API requests · cache hit 96% · 30 subagent(s)**.

This run's agents:

| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| spec-creator | Spec amendment: verdict banner (P3) | claude-opus-5-5 | 4.86M | 55.9k | 94% | 44 | 8.7 min | 4 | 0 |
| implementation-planner | Plan: verdict banner amendment | claude-opus-5-5 | 6.06M | 55.0k | 96% | 43 | 8.7 min | 0 | 1 |
| implementer | Banner amendment: implement 1–14 | claude-opus-5-5 | 7.66M | 55.6k | 93% | 66 | 18.0 min | 2 | 2 |
| architecture-reviewer | Banner: architecture review | claude-sonnet-5-5 | 160.2k | 3.2k | 72% | 4 | 0.5 min | 0 | 0 |
| plan-verifier | Banner: plan-verifier gap pass | claude-sonnet-5-5 | 249.6k | 8.4k | 57% | 6 | 4.6 min | 1 | 0 |
| general-purpose | Banner: frontend lenses review | claude-opus-5-5 | 956.8k | 11.0k | 89% | 11 | 2.0 min | 0 | 0 |
| architecture-reviewer | Banner: re-review fix round 1 | claude-sonnet-5-5 | 209.0k | 3.5k | 77% | 5 | 0.5 min | 0 | 0 |
| test-writer | Banner: tests steps 15–17 | claude-opus-5-5 | 3.58M | 44.9k | 96% | 34 | 11.6 min | 0 | 1 |
| plan-verifier | Banner: final plan-verifier pass | claude-sonnet-5-5 | 168.8k | 5.6k | 75% | 5 | 4.9 min | 0 | 0 |

This run added up to about **23.9M input and 243k output** across 9 agents, roughly a tenth of the main run's 125.8M. Token totals are what the transcripts record. They are not converted to money.

## Timeline
1. The user asked for the P3 verdict banner and a test PR with blockers. The coordinator built test PR #34 with deliberate blockers while spec-creator worked.
2. **spec-creator** wrote R-78…R-91. The user added two requirements mid-run: the visible run line, and Review focus as a separate card. Both were relayed by SendMessage, which is follow-ups 2–4. The draft closed with R-78…R-93 and Q-12…Q-16.
3. **User decision:** Q-12…Q-14 and UX-07…UX-10. The coordinator applied option A for Q-15 and Q-16. The spec reached R-105 and was approved.
4. Meanwhile the Security Reviewer run on #34, using `deepseek-v4-flash`, hung for more than 17 minutes. **User decision:** cancel it and switch the model to Claude. The rerun found 4 CRITICAL issues.
5. **implementation-planner** wrote a separate plan of about 10k tokens (`L05-pr-brief.banner.md`) with BA-1…BA-6. The coordinator applied option A to all of them. The plan was committed before code, in `b534d6b`.
6. **implementer** did steps 1–14 in one pass.
7. Review: architecture-reviewer, plan-verifier and the frontend lenses ran in parallel. Result: 0 CRITICAL, 1 WARNING (B-02), 4 SUGGESTION. **User decision:** fix all of them. Fix round 1 followed, then the re-review came back clean and the feature was committed in `824c157`.
8. **test-writer** wrote steps 15–17 (`02ea27c`). The final plan-verifier pass returned **complete**.
9. **Manual browser check:** every PR page crashed with `useEffectEvent is not a function` (B-06, CRITICAL). Fix round 2 fixed it in `49f0fe2`. The browser check then passed on #33 and #34.

## Per agent
### spec-creator
- **Hard:** the user's two mid-run additions each needed a resume. A cheaper route is to collect such additions before the first spawn.
- **Easy:** it found the real data path itself: `usePrReviews` was already on the page. It also found the real gap, that reviews have no head SHA. That gap became Q-12 and got a no-migration answer through `last_reviewed_sha`.
- **Missed:** nothing that needed correcting. It obeyed the new rule against inventing numeric limits.

### implementation-planner
- **Easy:** the new "plan ≤ 20k tokens" rule held. At about 10k tokens there were no Read failures this run, against 6 in the main run. It listed exactly which old-layout tests change, so the implementer's checkpoints stayed green.
- **Missed:** nothing that a reviewer had to correct.

### implementer
- **Hard:** it did not load `zod`, `fastify-best-practices` or `security` for steps 1–2. It reported this honestly as a deviation, and the outcome was unaffected.
- **Missed:** it applied B-05 as asked. Every automated check then accepted a crash only the browser could show (B-06).

### Reviewers (architecture, frontend lenses, plan-verifier)
- **Easy:** the frontend lens found B-02, a stale badge after a run. It was a real behavioural bug that the tests did not cover.
- **Missed, and the most important lesson of this run:** the frontend lens *recommended* `useEffectEvent` (B-05) and checked that it typechecks against `@types/react` 19.2. No reviewer checked the React that Next actually bundles. The final plan-verifier then graded **complete** against a build that crashed on every PR page.

### test-writer
- **Easy:** it wrote 4 server cases and about 40 client cases, with expected values taken from the requirements. It found no product bug.
- **Missed:** B-06 cannot be caught by vitest in jsdom: the test runtime's React has the API and the app's does not.

## Workflow
- **Order and parallelism:** this was a single writer. Three read-only reviewers ran in parallel in about 5 minutes of wall time.
- **Hand-overs:** agents received paths. The relayed user additions were the only retold facts.
- **Where the tokens went:** implementer 7.7M, planner 6.1M, spec-creator 4.9M. The reviewers together used under 2M.
- **Questions to the user:** 3. All were real product decisions (Q-12…Q-14, UX choices, suggestion triage), plus the hung-review decision.
- **Process gap:** `/run-plan` treats "final plan-verifier complete" as the end. Here the manual browser check found a CRITICAL *after* that point, so the check carries weight the pipeline never schedules.

## Recommendations
| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Make a browser smoke check a required step before the final verification, not an optional note. For example: open the touched route in `pnpm dev` and assert that no route error appears in the console. | `.claude/skills/run-plan/SKILL.md` § phases (before `pr`) | Runtime-only failures surface before "complete" | B-06: every automated gate was green, yet the page crashed |
| 2 | Lens reviewers must not recommend a React API without checking Next's bundled React (`next/dist/compiled/react`) | `.claude/agents/*` review prompts / `react-best-practices` usage note | No more "fix" that crashes the app | B-05 → B-06 |
| 3 | Collect the user's additions (layout, visible data) before spawning spec-creator, by asking about every visible element in the target screenshot up front | coordinator practice / `spec-creator` brief template | Fewer resumes (4 follow-ups here) | Run line and Review-focus card were added mid-run |
| 4 | Ask the user once before a test run whether to switch a review agent off a model that is known to hang | coordinator practice | No 17-minute dead wait | Security Reviewer on `deepseek-v4-flash` hung; its earlier intent calls failed schema validation |
