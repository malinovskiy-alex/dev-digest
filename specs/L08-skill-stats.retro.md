# Retro — L08 Skill Stats (spec → plan → /run-plan) · 2026-11-05
Session(s) `fd36c3e3-f498-4a64-b3c1-f6df54f02720` · Branch `lesson/L08-homework`

The session also contains the L08 Agent Performance run (`specs/L08-agent-performance.retro.md`). Only the rows of this cycle are judged here.

## Numbers
Session totals (both cycles), verbatim:
**Total:** 225.07M input (217.07M cache read, 7.99M cache write, 2.6k uncached) · 1.31M output · 1209 API requests · cache hit 96% · 40 subagent(s)

This cycle's agents, verbatim from the script:

| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| spec-creator | Spec for L08 Skill Stats | claude-opus-5-5 | 4.07M | 64.3k | 86% | 35 | 9.2 min | 2 | 0 |
| implementation-planner | Plan L08 Skill Stats | claude-opus-5-5 | 9.50M | 78.9k | 97% | 46 | 13.0 min | 1 | 0 |
| implementer | L08-skill-stats phase 0+1a | claude-opus-5-5 | 618.9k | 8.5k | 89% | 11 | 4.7 min | 0 | 2 |
| implementer | L08-skill-stats server stream | claude-opus-5-5 | 5.05M | 57.4k | 94% | 42 | 14.7 min | 1 | 3 |
| implementer | L08-skill-stats client stream | claude-opus-5-5 | 19.85M | 111.7k | 98% | 109 | 23.0 min | 1 | 4 |
| plan-verifier | L08-skill-stats full verification | claude-sonnet-5-5 | 1.14M | 15.3k | 90% | 13 | 5.4 min | 0 | 1 |
| architecture-reviewer | L08-skill-stats architecture review | claude-sonnet-5-5 | 205.7k | 3.0k | 79% | 5 | 0.4 min | 0 | 0 |
| general-purpose | L08-skill-stats security lens | claude-opus-5-5 | 2.55M | 13.6k | 90% | 23 | 2.6 min | 1 | 1 |
| general-purpose | L08-skill-stats /code-review | claude-opus-5-5 | 403.3k | 4.2k | 83% | 7 | 3.9 min | 1 | 0 |
| general-purpose | L08-skill-stats frontend lenses | claude-opus-5-5 | 5.21M | 29.4k | 90% | 40 | 13.6 min | 4 | 0 |
| general-purpose | /code-review high | claude-opus-5-5 | 2.91M | 17.6k | 95% | 26 | 3.2 min | 0 | 1 |
| implementer | L08-skill-stats fix round 2: F-16 | claude-opus-5-5 | 443.0k | 5.7k | 89% | 10 | 1.9 min | 0 | 0 |
| architecture-reviewer | L08-skill-stats arch re-review iter 2 | claude-sonnet-5-5 | 225.2k | 2.9k | 78% | 5 | 0.4 min | 0 | 0 |
| implementer | L08-skill-stats fix round 2: F-17 F-18 | claude-opus-5-5 | 1.32M | 21.4k | 95% | 22 | 8.0 min | 1 | 0 |
| architecture-reviewer | L08-skill-stats arch re-review iter 3 | claude-sonnet-5-5 | 164.4k | 1.8k | 73% | 4 | 0.3 min | 0 | 0 |
| implementer | L08-skill-stats fix round 4: F-20 | claude-opus-5-5 | 435.2k | 7.6k | 87% | 9 | 2.0 min | 0 | 0 |
| plan-verifier | L08-skill-stats final verification | claude-sonnet-5-5 | 894.2k | 5.9k | 89% | 13 | 5.0 min | 0 | 0 |
| general-purpose | L08-skill-stats final /code-review | claude-opus-5-5 | 388.6k | 4.9k | 90% | 7 | 4.5 min | 1 | 0 |
| general-purpose | /code-review high | claude-opus-5-5 | 3.44M | 19.3k | 96% | 29 | 3.6 min | 0 | 0 |
| implementer | L08-skill-stats round 5 server: F-22 | claude-opus-5-5 | 353.6k | 4.0k | 86% | 8 | 3.6 min | 0 | 0 |
| implementer | L08-skill-stats round 5 client: F-23 F-24 | claude-opus-5-5 | 549.6k | 7.3k | 90% | 11 | 2.1 min | 0 | 0 |
| architecture-reviewer | L08-skill-stats arch re-review round 5 | claude-sonnet-5-5 | 121.7k | 1.8k | 64% | 3 | 0.3 min | 0 | 0 |
| plan-verifier | L08-skill-stats final verification | claude-sonnet-5-5 | 1.42M | 22.9k | 92% | 16 | 6.3 min | 0 | 0 |

The main session's own share of this cycle is not separable in the script output (main is one row for the whole session). Token totals do not include harness-side cost.

## Timeline
1. User sent a Skill Stats screenshot mid-run of the previous cycle and asked why the findings widget was missing → brief with 6 decisions written before spec-creator (`.devdigest/cache/sdd/L08-skill-stats/brief.md`).
2. spec-creator → 78 requirements; user answered BQ-1…8 (2 calls), G-01…16 (1 multi-select — every box ticked, then a confirmation call: "approved the recommendations"), G-17/18 + UX-01…06 (2 calls); approval asked explicitly.
3. implementation-planner (17:36–17:49) → 20 steps; user answered OQ-1…4; planner recorded them before the run started.
4. Phase 0+1a → server ∥ client streams (17:54–18:24).
5. Phase 2: five reviewers in parallel (18:07) → 0 CRITICAL, 4 WARNING, 10 SUGGESTION; user chose all 10.
6. Fix 1 (both streams) → re-review; user accepted the R-73 shift and asked to fix the attach-invalidation gap (F-16).
7. Fix 2 (two fresh implementers, disjoint) → re-review → user chose F-17, F-18 ("badge hover only").
8. Fix 3 (F-19, reserve the line) → re-review; user OK to stop `next dev`; build + smoke pass.
9. Cap reached: user chose round 4 (F-20), F-21 wontfix.
10. `/pr-self-review`: gates clean; confirming `/code-review` found F-22…F-24 → user chose round 5.
11. Final plan-verifier: 149 done, R-82 partial (the user's F-18 narrowing was not in the ledger) → decision recorded, R-82 amended.

## Per agent

### spec-creator
- Hard: none in the first pass; 2 follow-ups were the answers relay and the late R-82 amendment.
- Easy: found the decisive data limit on its own — `agent_skills` has no history and runs store no skill ids, so "had the skill at run time" is unanswerable (spec §"What the code says") — and shaped every gap as an option row, which made the 32-item relay possible.
- Missed: nothing the user corrected.

### implementation-planner
- Easy: one follow-up only (recording OQ answers); placed the skill reads in the existing `agent-performance` module (D-1), which architecture-reviewer approved in every pass.
- Missed: the plan asked for a mount-time window in the pull-frequency query key (D-11) — the root of F-04 — and for a hover tooltip inside a `role="button"` card (F-05). Both were caught only by review.

### implementer — server stream
- Easy: steps 2–8 + 32 tests green first pass; caught a self-contradiction in the plan's test fixture (§C I5 vs I6) and fixed it explicitly (Echo/Xray/S4 agents).
- Missed: no upper bound on `to` (F-02) — the mirror of the 1970 bound written in the previous cycle's INSIGHTS.

### implementer — client stream
- Hard: most expensive writer (19.85M input, 109 requests); 4 tool errors were verify exit codes, one `runner crashed` (no related tests) and a transient `.next/types` typecheck error from the running `next dev`.
- Missed: F-04 (followed the plan's key), F-05, F-06 (new keys outside the `["skills"]` prefix that every skill mutation invalidates).

### fresh implementers (rounds 2, 4, 5)
- Easy: each 0.35–1.3M input, 8–22 requests, no follow-up except the resumed F-17/F-18 one. Fresh small rounds cost a fraction of resuming the 19.85M client stream (the run-plan rule from the previous retro worked).
- Missed: round 2's F-18 fix introduced F-19 (layout shift), whose fix introduced F-20 (one-time growth) — three rounds on one tooltip.

### plan-verifier
- Hard: the first final pass was stopped because round 5 started under it (0.89M wasted); the last pass could not see the user's F-18 decision because it lived only in the conversation, and graded R-82 `partial`.
- Easy: precise per-R-ID re-grading after each fix round, incl. the R-73 shift (graded `done` because `state.md` recorded the user's acceptance).

### architecture-reviewer (×5)
- Easy: 0.1–0.2M input each, `pnpm arch` first, one SUGGESTION in five passes; no false positives once its own "25 vs 21" sentence was corrected mid-run.

### security lens
- Easy: verified every claim against the live API and pg16 (SELECT literals only); found F-02 by mirroring the previous cycle's 1970 lesson; confirmed F-07 leaks nothing.

### frontend lens (resumed 4×)
- Hard: 4 follow-ups, 5.21M input — resumed for every iteration because it held the context of its own earlier findings.
- Easy: found F-04 with the App Router mechanism (route segment cache key) that tests could not see; judged the WCAG 1.4.13 exception correctly once the hint was in flow.

### /code-review (phase 2 and pr gate)
- Easy: phase 2 found F-06 (invalidation prefix); the pr-gate pass found F-22 (a race made fatal by F-03's schema bound), F-23, F-24.
- Duplicated: each `/code-review` run spawned a nested agent (2.91M and 3.44M input) under a thin wrapper agent.

## Workflow
- **The review-in-phase-2 rule paid off but not fully.** Security and `/code-review` ran in phase 2 (new rule from the previous retro) and caught F-02 and F-06 before the gate. The pr-gate `/code-review` still found three WARNINGs (F-22…F-24) — two of them consequences of earlier fixes (F-03 → F-22; F-06/F-16 left `useDeleteAgent` → F-23). Fixes were re-reviewed only by architecture and frontend lenses, never by a bug pass, until the gate.
- **Parallelism:** writers ran in parallel only on disjoint paths (2 streams, then pairs of fresh implementers); every review round ran its readers in parallel. No collision.
- **Hand-overs:** all by path (brief, spec, plan, findings ledger, state log). One fact lived only in the conversation — the F-18 "badge hover only" choice — and cost a partial verdict plus a spec amendment.
- **Where tokens went:** client stream 19.85M + planner 9.50M + frontend lens 5.21M + server stream 5.05M + two nested `/code-review` 6.35M. The client stream and planner bought output (code, plan); the nested `/code-review` agents are mostly wrapper overhead.
- **Questions to the user:** ~14 `AskUserQuestion` calls in this cycle. Every relay item was its own option (the new rule) — but the 16-item multi-select with "mark where you want the alternative" polarity was misread (all ticked meaning "agree"), costing a confirmation call. Five calls were review-loop decisions that the rules require.
- **Fix-round cap:** five rounds against a cap of three; rounds 3–4 were one tooltip's chain of side effects.

## Recommendations
| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Record every user decision made during the run in `state.md` **and** in the ledger row's Resolution at the moment it is made (incl. option text), not only in the conversation | `.claude/skills/run-plan/SKILL.md` § The findings ledger | final verifier sees decisions; no late spec amendment | R-82 graded `partial` because F-18's choice was not in the ledger |
| 2 | After a fix round that touches behaviour (not only style), include a bug pass (`/code-review` scoped to the round's files) in the re-review, not only architecture/frontend | `.claude/skills/run-plan/SKILL.md` § One round, step 4 | consequences of fixes caught before the gate | F-22 (caused by F-03), F-23 (gap left by F-06/F-16) found only at the pr gate |
| 3 | Never use "mark where you want the alternative" multi-selects; ask "mark what to CHANGE/FIX" with the default stated in each option, or one single-select per item | `.claude/skills/run-plan/SKILL.md` relay rules | no misread batches | G-01…16: every box ticked meaning "approve", needed a confirmation call |
| 4 | When a UI fix changes layout/interaction, ask the frontend lens for the side effects before the next round (layout shift, first-load growth) in the same review | `.claude/skills/run-plan/SKILL.md` § review (frontend lens prompt) | one round instead of three on one widget | F-18 → F-19 → F-20 chain |
| 5 | Run `/code-review` inline in a single agent instead of a wrapper that spawns a nested `/code-review` agent | `.claude/skills/run-plan/SKILL.md` § review / pr | ~halves `/code-review` cost | wrapper 0.39–0.40M + nested 2.91M / 3.44M per run |
| 6 | Don't start a final plan-verifier while a fix round may still follow (wait for the pr gate) | `.claude/skills/run-plan/SKILL.md` § pr / wrap-up | no discarded verifier pass | first final pass stopped after 0.89M when round 5 began |
| 7 | Planner: flag query keys built from time anchors and interactive elements nested in `role="button"` as review risks in the plan | `.claude/agents/implementation-planner.md` § Risks | fewer review findings from plan-mandated designs | D-11 mandated the mount-time key (F-04) and the in-card tooltip (F-05) |
