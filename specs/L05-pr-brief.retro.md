# Retro — L05 PR Brief (spec-creator → implementation-planner → /run-plan) · 2026-11-01
Session `00782d22-b8dc-4c90-9b52-e467e0b50c55` · Branch `lesson/L05-lab-homework`

## Numbers
**Total:** 125.80M input (119.01M cache read, 6.79M cache write, 1.5k uncached) · 724.9k output · 710 API requests · cache hit 95% · 20 subagent(s)

| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| main | — | claude-opus-5-5 | 25.89M | 87.9k | 98% | 122 | 71.3 min | 44 | 2 |
| spec-creator | PR Brief requirements spec | claude-opus-5-5 | 9.13M | 63.1k | 90% | 52 | 9.8 min | 8 | 0 |
| implementation-planner | PR Brief implementation plan | claude-opus-5-5 | 19.59M | 115.9k | 95% | 73 | 15.3 min | 2 | 0 |
| implementer | Phase 1: baselines + contract | claude-opus-5-5 | 399.1k | 5.0k | 87% | 9 | 4.5 min | 0 | 0 |
| implementer | Phase 2: server stream S | claude-opus-5-5 | 20.37M | 97.0k | 95% | 100 | 26.6 min | 3 | 1 |
| implementer | Phase 2: client stream C | claude-opus-5-5 | 17.58M | 91.5k | 93% | 87 | 18.1 min | 4 | 1 |
| plan-verifier | Phase 3: plan-verifier gap pass | claude-sonnet-5-5 | 1.03M | 15.7k | 77% | 13 | 5.2 min | 1 | 1 |
| architecture-reviewer | Phase 3: architecture review | claude-sonnet-5-5 | 539.3k | 8.2k | 87% | 10 | 1.3 min | 0 | 0 |
| general-purpose | Phase 3: security lens | claude-opus-5-5 | 1.37M | 10.0k | 91% | 14 | 1.8 min | 0 | 0 |
| general-purpose | Phase 3: performance rubric | claude-opus-5-5 | 1.94M | 14.0k | 94% | 23 | 2.6 min | 0 | 1 |
| general-purpose | Phase 3: code-review correctness | claude-opus-5-5 | 135.4k | 2.6k | 30% | 3 | 0.4 min | 1 | 0 |
| general-purpose | /code-review high | claude-opus-5-5 | 2.86M | 23.9k | 90% | 24 | 4.2 min | 0 | 0 |
| architecture-reviewer | Re-review iteration 2 | claude-sonnet-5-5 | 326.0k | 4.2k | 82% | 7 | 0.6 min | 0 | 0 |
| plan-verifier | Re-grade F-21 / INV-13 | claude-sonnet-5-5 | 123.7k | 3.4k | 81% | 6 | 0.9 min | 0 | 0 |
| test-writer | Phase 5: server tests T-S | claude-opus-5-5 | 9.64M | 82.0k | 97% | 55 | 20.0 min | 1 | 1 |
| test-writer | Phase 5: client tests T-C | claude-opus-5-5 | 12.01M | 68.8k | 98% | 71 | 13.5 min | 0 | 1 |
| plan-verifier | Phase 7: final plan-verifier pass | claude-sonnet-5-5 | 342.4k | 8.0k | 77% | 6 | 4.3 min | 0 | 1 |
| general-purpose | pr-self-review: frontend lens pass | claude-opus-5-5 | 835.3k | 8.1k | 87% | 10 | 1.4 min | 0 | 0 |
| general-purpose | pr-self-review: backend lens pass | claude-opus-5-5 | 584.6k | 4.7k | 87% | 9 | 0.9 min | 0 | 0 |
| general-purpose | pr-self-review: crosscutting lens pass | claude-opus-5-5 | 916.5k | 8.1k | 90% | 12 | 1.5 min | 0 | 0 |
| architecture-reviewer | Re-review fix round 4 | claude-sonnet-5-5 | 171.1k | 2.7k | 71% | 4 | 0.5 min | 0 | 0 |

Token totals are what the transcripts record. They do not include anything the harness spent outside the model (hooks, MCP servers), and they are not converted to money here.

## Timeline
The script's timeline shows spec-creator and implementation-planner as "parallel with" almost everything. That is only because both were resumed late for one-line amendments (F-23); they did no work during implementation. The order that actually happened:

1. **spec-creator.** Draft with 11 open questions. Then **user decision 1:** answers to Q-01…Q-11 and UX-01…UX-06, collected in two `AskUserQuestion` rounds. Then the spec was amended.
2. **User decision 2:** "run implementation planner". The spec was marked Approved, with R-34 and R-56 left at the agent's defaults. **User decision 3:** multi-agent execution.
3. **implementation-planner** wrote revision 1 with AP-1…AP-12 and REC-1…REC-5. **User decision 4:** all AP as option A; REC-1, 2, 3 and 5 accepted. Then the spec was amended (8 items, including the 120 s reasoning timeout) and the plan moved to revision 2 (D-37…D-39).
4. **User decision 5:** "start the implementation". Spec and plan committed as `75fe1ba`. The cross-model review (phase 0) was **not** done before code.
5. `/run-plan`. **User decision 6:** follow the plan's parallel streams over the skill's "writers one at a time" rule.
   - Phase 1, implementer A: 21:09–21:13.
   - Phase 2, S ∥ C: 21:13–21:25.
6. Phase 3: five read-only reviewers in parallel, 21:25–21:37. They returned 21 findings, F-01…F-21. **User decision 7:** F-11 accepted, F-12 handled as a deadline, all suggestions must-fix, F-20 (the build) deferred.
7. Fix round 1, S ∥ C. **User decision 8:** the F-02 dispute accepted. Re-review at iteration 2 was clean. Feature committed as `21427de`.
8. Phase 5: T-S ∥ T-C, 21:51–22:11. No product bugs, two new findings (F-22, F-23). **User decision 9:** fix both, using the last-segment rule. Fix round 2; spec and plan amended. Committed as `715aad3` (tests) and `cffa339` (fixes).
9. Phase 7: final plan-verifier pass, 22:11–22:15.
10. Pre-PR gate:
    - `pnpm build` failed at lint (F-24). Fixed in round 3, commit `e37fea7`.
    - **User decision 10:** kill the orphaned `next dev`. The build then passed.
    - `/pr-self-review`: three lens passes returned 8 SUGGESTIONs. **User decision 11:** fix all 8.
    - Fix round 4, re-review, commit `8d3cb30`, verdict `approve`.

## Per agent

### spec-creator
- **Hard:** it ran in the background without `AskUserQuestion`. All 11 blocking questions came back in the hand-back and needed two relay rounds and one resume (follow-ups: 8). This was the known behaviour from memory `background-agents-no-askuserquestion`, so the coordinator pre-collected the four big decisions (scope, budget, stale policy, cross-model review) before spawning.
- **Easy:** it found three real design gaps the course brief did not mention:
  - line numbers cannot come from stats alone (Q-11);
  - the Intent card already has a "Risk areas" list (Q-05);
  - the head SHA was never persisted (Q-04).

  It also produced 77 traceable requirements with `file:line` provenance.
- **Duplicated:** it read about 20 source files that implementation-planner then read again (script: "files read by more than one agent"). Expected, since the two roles check the same code.
- **Missed:** it raised the reasoning-model timeout to 120 s unasked. That created the JobRunner-wall overlap, which needed D-39 in the plan and later F-12. The rule "any `<vendor>/` prefix" disagreed with the plan's "one prefix" until test-writer found it (F-23).

### implementation-planner
- **Hard:** the plan grew past 25,000 tokens. **Six** Read calls across implementer, plan-verifier and test-writer failed with `File content (27065 tokens) exceeds maximum allowed tokens (25000)`. It was the most expensive non-implementer agent: 19.59M input, 115.9k output.
- **Easy:** the ownership table and stream rules held. Two parallel writers, then two parallel test-writers, produced zero collisions. Every R-ID was traced to a step, a test and a Done-when line.
- **Missed:**
  - It planned the client `pnpm build` checkpoint but no `next lint`. F-24 was found only by the build.
  - Its REC-2 phase-3 reviewers did not include the frontend lenses (`react-best-practices`, `next-best-practices`). Those lenses later produced 4 of the 8 pre-PR suggestions.

### implementer (S, C)
- **Hard:**
  - Each was resumed for 4 fix rounds. S reached 100 requests and 20.37M input; C reached 87 requests and 17.58M. Each resume re-sends the whole accumulated context.
  - S's heredoc-scripted edit turned `\b` into a backspace byte. S caught it itself (now in root `INSIGHTS.md`).
  - C could not run `pnpm build` because `pnpm dev` was up.
- **Easy:** the first pass was green against the baselines in both packages, and every deviation was reported in a table, which made the plan-verifier gap pass cheap. Fix rounds 2–4 were small and closed first time.
- **Missed:**
  - F-04: every exception was classified as a provider error.
  - F-07: the focus target was never consumed.
  - F-24: a three-level relative import.

  All three were caught by reviewers or the build, not by the writer.

### plan-verifier
- **Hard:** hit the plan-size Read error. One Bash grep tripped on a findings-table row (exit 2).
- **Easy:** the gap pass graded 89 items at 1.03M input. Re-grades were scoped and cheap (123.7k).

### architecture-reviewer
- **Easy:** all four runs were cheap (171k–539k input, Sonnet) and decisive. It confirmed fixes with `file:line`. No false CRITICALs.

### general-purpose reviewers (security, perf, /code-review, pr-self-review lenses)
- **Easy:** the security lens found F-04, the one real leak. Perf found F-07. /code-review found F-12, F-13, F-14 and F-15.
- **Hard:**
  - The "Phase 3: code-review correctness" wrapper spawned a nested `/code-review` agent, so the cost was counted twice in the timeline. The wrapper itself had a 30% cache hit, but it was small (135k).
  - /code-review labelled F-11 CRITICAL even though it contradicted a recorded user decision (Q-10). It had not been given the decision log.
- **Duplicated:** `service.ts` was read by 6 agents. That is unavoidable for independent reviews.

### test-writer (T-S, T-C)
- **Easy:** 6 server and 10 client test files, with expected values taken from requirements, not code. The suites grew from 581+131 to 746+144 (server) and 334 to 408 (client). Each test listed what production change would make it fail.
- **Missed / found:** it found the R-73 / D-38 contradiction (F-23), and T-C noticed the listener pile-up (F-22). Both were spec or design issues, not test issues.

## Workflow
- **Order and parallelism:**
  - Read-only reviewers always ran in parallel: five in phase 3, three in the pre-PR lenses.
  - Writers ran in parallel only with disjoint ownership. That contradicts `/run-plan`'s "writers run one at a time" rule, and the user chose the plan over the skill. No collision happened.
- **Hand-overs:**
  - Agents got paths: the plan, the findings ledger, `phase2-deviations.md`.
  - Two exceptions where the coordinator retold facts in the prompt:
    - the test-writer prompts summarised fix-round behaviour changes, because the plan was older than the fixes;
    - the spec amendments were dictated item by item.
  - Both would be cheaper if the findings ledger's Resolution column were the only source.
- **Where the tokens went:**
  - Long resumed writers dominate: implementers 38.0M and test-writers 21.7M, out of 125.8M.
  - The planner (19.6M) and the main session (25.9M, 44 follow-ups) are next.
  - Reviewers cost under 12M combined for all 13 review runs. Reviews were cheap; writer context was expensive.
- **Questions to the user:** 12 `AskUserQuestion` calls.
  - About 4 were unavoidable product decisions: scope, budget, stale policy, the F-11 accept.
  - About 3 were caused by agents filling gaps unasked or disagreeing with each other: the 120 s timeout, F-23, the run-plan vs plan conflict.
  - About 5 were suggestion triage, which the skill's own process requires.
- **Process gap:** the cross-model review (REC-1, phase 0, a P2 deliverable) never ran before code. The user asked to start implementation, and nothing in `/run-plan`'s preflight checks for `specs/<slug>.plan-review.md`.

## Recommendations
| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Cap the plan at about 20k tokens. Move `## Requirements check`, `## Decisions` detail and test-case lists into an appendix file (`<slug>.decisions.md`) that agents open on demand | `.claude/agents/implementation-planner.md` § output | No more Read failures; cheaper cold reads for every downstream agent | 6× `exceeds maximum allowed tokens (25000)` on `specs/L05-pr-brief.md` |
| 2 | Add eslint to the client lane of `verify.mjs` (`next lint --dir src`, or eslint on `--related` files) | `scripts/verify.mjs:29` | A lint failure surfaces in the stream's own verify, not at the pre-PR build | F-24: green 408/408, then `next build` failed on `no-restricted-imports` |
| 3 | Preflight: if the plan accepts a cross-model review (phase 0), refuse to start `implement` until `specs/<slug>.plan-review.md` exists, unless the user overrides | `.claude/skills/run-plan/SKILL.md` § 0 Preflight | The P2 "review before code" deliverable is not silently skipped | Phase 0 never ran; code started at `21427de` without it |
| 4 | Allow parallel writers when the plan has an ownership table, instead of "writers run one at a time" | `.claude/skills/run-plan/SKILL.md` § Rules | No conflict question at the start of every multi-agent run | User decision 6; S ∥ C and T-S ∥ T-C ran with zero collisions |
| 5 | Run phase-3 reviews with the frontend lenses (`react-best-practices`, `next-best-practices`) alongside architecture | `.claude/agents/implementation-planner.md` § Execution template (REC-2) | Suggestions land in fix round 1 instead of a 4th round after the gate | 4 of the 8 pre-PR suggestions (F-29…F-32) were frontend-lens only |
| 6 | Give `/code-review` and other lens agents the findings ledger and the spec `## Decisions` before they rate severity | the coordinator's review prompts / `run-plan` § review | No CRITICAL raised against a recorded user decision | F-11 rated CRITICAL despite Q-10 / R-12 |
| 7 | For small late fix rounds (one or two findings), spawn a fresh implementer with the plan and ledger paths rather than resuming a 100-request context | `.claude/skills/run-plan/SKILL.md` § 4 One round | Rounds 2–4 cost a fraction of a resumed 20M-input context | S: 100 requests / 20.37M input after 4 rounds; round-2 fix was a one-line change |
| 8 | spec-creator must not raise numeric limits beyond what the user asked; it lists them as an open question instead | `.claude/agents/spec-creator.md` § decisions | No downstream invariant (D-39) or fix (F-12) needed for an unrequested choice | 120 s reasoning timeout added unasked → JobRunner wall overlap |
