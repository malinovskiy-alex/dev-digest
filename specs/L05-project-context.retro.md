# Retro — L05 Project Context (spec → plan → /run-plan) · 2026-10-30
Session `523573a1-05b7-4a1a-bd07-5857cddc087e` · Branch `lesson/L05-lab` · Verification: [`L05-project-context.verification.md`](L05-project-context.verification.md)

## Numbers

From `node .claude/skills/workflow-retro/scripts/session-stats.mjs --session 523573a1-05b7-4a1a-bd07-5857cddc087e`.
The session also contains the spec-language change and the `workflow-retro` skill itself; they are a small share of `main`.

**Total:** 140.22M input (134.40M cache read, 5.82M cache write, 1.6k uncached) · 716.7k output · 760 API requests · cache hit 96% · 19 subagent(s)

| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| main | — | claude-opus-5-5 | 36.20M | 159.3k | 98% | 147 | 96.9 min | 43 | 3 |
| spec-creator | Write L05 Project Context spec | claude-opus-5-5 | 2.77M | 36.0k | 90% | 27 | 5.7 min | 1 | 0 |
| implementation-planner | Plan L05 Project Context | claude-opus-5-5 | 14.06M | 90.6k | 95% | 58 | 17.5 min | 2 | 1 |
| implementer | Implement L05 steps 1-18 (+ 6 fix rounds) | claude-opus-5-5 | 55.88M | 189.2k | 95% | 225 | 58.4 min | 8 | 4 |
| architecture-reviewer ×4 | review + 3 re-reviews | claude-sonnet-5-5 | 1.20M | 15.3k | 64–90% | 24 | 2.5 min | 0 | 0 |
| plan-verifier ×2 | gap pass, final pass | claude-sonnet-5-5 | 1.63M | 22.4k | 86–90% | 24 | 6.4 min | 0 | 0 |
| test-writer ×4 | steps 19–22, rounds 4/5/6 | claude-opus-5-5 | 21.94M | 136.1k | 87–99% | 168 | 40.0 min | 0 | 1 |
| doc-writer | docs page | claude-sonnet-5-5 | 818.8k | 10.1k | 89% | 12 | 1.4 min | 0 | 0 |
| general-purpose ×5 | pre-PR lenses, /code-review, 2 security re-checks | claude-opus-5-5 | 5.73M | 57.8k | 88–94% | 75 | 13.4 min | 0 | 5 |

## Timeline

1. spec-creator — requirements; two relayed rounds of user answers (it had no `AskUserQuestion` in the background).
2. User: language of specs must be English → spec translated, `spec-creator` rule changed.
3. implementation-planner — plan; one relayed round of 6 questions (again no `AskUserQuestion`), one follow-up to add R-70…R-72.
4. implementer — steps 1–18 (58 min of its 58.4 total over the run happened in this phase and the fix rounds).
5. architecture-reviewer ∥ plan-verifier (gap) — 1 WARNING, 0 code gaps.
6. Fix 1 (F-02) → re-review.
7. test-writer — steps 19–22; step 23 blocked by its scope.
8. Fix 2 (e2e flow), rate-limit stop, fix 3 (aria-label); global install of `agent-browser` refused by the classifier.
9. plan-verifier (final) ∥ architecture-reviewer → doc-writer.
10. /pr-self-review: gates + 2 lens agents + /code-review → 7 WARNING, 9 SUGGESTION; user decisions (budget 128,000) → fix 4 + tests.
11. Security re-run → **CRITICAL F-27 introduced by fix 4** → fix 5 + tests → security re-check → fix 6 + tests.

## Per agent

### spec-creator
- **Hard:** `AskUserQuestion` was not available in a background spawn, so all blocking questions came back in the hand-back and went through the coordinator (1 follow-up). It wrote the spec in Ukrainian because its definition said "Triggers are always Ukrainian" and the coordinator's prompt said "українською" — the user corrected it afterwards.
- **Easy:** design analysis — 22 gap rows, 61 requirements, and it found the existing `specs` slot in `reviewer-core/src/prompt.ts` and the hard-coded `specs_read: []` from the code.
- **Missed:** left a stray `L05-project-context.requirements.md.tmp-guard` it could not delete (no shell).

### implementation-planner
- **Hard:** same missing `AskUserQuestion`; 1 failed `Edit` (string not found).
- **Easy:** checked all 69 requirements against the code; REC-1 (read docs from git objects, not the working tree — symlink leak) was adopted and held through every review.
- **Duplicated:** re-read 17 files `spec-creator` had already read (see "Files read by more than one agent").
- **Missed:** assigned the e2e step 23 to `test-writer`, whose rules forbid `e2e/`.

### implementer
- **Hard:** 225 requests, 4 tool errors (failed edits, a classifier denial); the Windows `db:migrate`/`db:seed` no-op needed a scratchpad `runMigrations` script; hit the account rate limit mid-round and was resumed.
- **Easy:** steps 1–18 green on the first pass except one planned copy change; arch clean every round.
- **Missed:** fix round 4 widened the `</untrusted` escape with `[^>]*` and a whole-match replacement → deleted diff text (F-27, CRITICAL). It verified the new escape only on single-line samples.

### test-writer
- **Hard:** step 23 blocked by scope (`e2e/`); `routing.md` routes no `server/test/**` or `reviewer-core/test/**`, so it picked lenses by hand in all four runs.
- **Easy:** strong assertions with an explicit "what must change for this to fail" table; found the pre-existing trace-after-done race.
- **Missed:** nothing material; the integration file now makes 8 review POSTs against a 10/min limit.

### architecture-reviewer
- **Easy:** 4 runs, 2.5 min total, sonnet; F-02 was the only real finding. Cheap and precise.
- **Duplicated:** noted the same doc drift ("21 vs 25 grandfathered violations") in every run.

### plan-verifier
- **Hard:** the final pass did not receive the gap-pass report and could not map row numbers; it ran before the pre-PR rounds, so rounds 4–6 never got a per-item re-grade.

### pre-PR lenses (general-purpose ×5)
- **Easy:** found everything the in-loop reviewers missed: remote images in untrusted markdown, attachment loss across repos (F-19), the 1,000-blob listing, no prompt budget, and later the F-27 regression and F-31 gap.
- **Hard:** fuzzing scripts in the scratchpad had 5 shell/escaping errors.

## Workflow

- **Where the bugs were found.** 6 in-loop findings (review + tests) vs 23 at the pre-PR gate. The architecture and plan reviewers do not look at security or performance by design, so those landed only at the end, after the implementation was "done" — and the fixes for them (round 4) introduced the only CRITICAL.
- **Order and parallelism.** Read-only reviewers ran in parallel as intended. The script shows `implementer` "parallel with" every agent because a resumed agent's window spans first-to-last record; its real work was sequential.
- **Hand-overs.** Paths, not retellings, worked: every agent read the plan/ledger itself. Exception: the first `plan-verifier` final pass got numbered rows from the coordinator's prompt it could not resolve.
- **Where the tokens went.** `implementer` 40% of input (55.9M) for 225 requests across 7 resumes — its context only grows, so each fix round re-sends the whole earlier implementation. `main` 26% (orchestration + this session's other work). `test-writer` 16%.
- **Questions to the user.** 11 `AskUserQuestion` calls from `main`; ~8 relayed questions only existed because background `spec-creator`/`implementation-planner` could not ask.

## Recommendations

| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Run the `security` + `perf-prompt` lenses (one agent) in the **review** phase, next to `architecture-reviewer`, not only at the pre-PR gate | `.claude/skills/run-plan/SKILL.md` § review | security/perf findings land before tests are written; fewer late rounds | 23 of 29 findings came from the pre-PR gate; rounds 4–6 |
| 2 | Any fix to an escape/sanitiser must ship with a property test (input recoverable after un-escaping) **in the same round**, and the security lens re-runs on that file | `run-plan` § one round; `implementer.md` | F-27-type regressions caught inside the round | F-27 (CRITICAL from fix 4) |
| 3 | Spawn `spec-creator` and `implementation-planner` in the **foreground** (or tell the coordinator to ask the user directly) so `AskUserQuestion` works | `AGENTS.md` § Agents; `.claude/agents/README.md` | no relayed question rounds | 3 relay rounds; both hand-backs say "AskUserQuestion was not available" |
| 4 | `implementation-planner` assigns `e2e/` steps to `implementer`, never `test-writer` | `.claude/agents/implementation-planner.md` § Execution | no blocked step 23 | F-05 |
| 5 | Route `server/test/**` and `reviewer-core/test/**` in the gate | `.claude/skills/pr-self-review/scripts/lib/routing.mjs:32`, `references/routing.md` | test-writer stops guessing lenses | 4 test-writer reports |
| 6 | Spawn a **fresh** implementer per fix round after round 2 (plan path + findings path) instead of resuming | `run-plan` § one round | stops the ever-growing context (55.9M input) | implementer 225 requests / 8 follow-ups |
| 7 | Pass the previous `plan-verifier` report **as a file** to the final pass; re-run a per-item pass after pre-PR fix rounds | `run-plan` § tests / pr | final verdict covers the shipped code | final pass could not map rows; rounds 4–6 not re-graded |
| 8 | Check external tooling (`agent-browser`, Docker) in `/run-plan` preflight and ask the user to install it up front | `run-plan` § 0 Preflight | e2e actually runs | classifier denial, R-58 unverified |
| 9 | `session-stats.mjs`: compute parallelism from active windows, count `attachment`-delivered follow-ups | `.claude/skills/workflow-retro/scripts/session-stats.mjs` (`timing`, `followUps`) | accurate timeline | "implementer parallel with everything"; spec-creator follow-ups 1 instead of 2 |
| 10 | Fix the "25 vs 21 grandfathered violations" drift once | `pr-self-review/references/{do-not-flag,gates,severity-map}.md` | stops the repeated note | 4 architecture-reviewer reports |
