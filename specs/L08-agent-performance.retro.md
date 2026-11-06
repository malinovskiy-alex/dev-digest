# Retro — L08 Agent Performance (spec → plan → /run-plan) · 2026-11-05
Session(s) `fd36c3e3-f498-4a64-b3c1-f6df54f02720` · Branch `lesson/L08-homework`

## Numbers
**Total:** 97.14M input (93.10M cache read, 4.04M cache write, 1.3k uncached) · 667.9k output · 592 API requests · cache hit 96% · 17 subagent(s)

| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| main | — | claude-opus-5-5 | 28.25M | 118.5k | 98% | 135 | 73.9 min | 33 | 5 |
| spec-creator | Spec for L08 Agent Performance | claude-opus-5-5 | 3.78M | 59.9k | 88% | 31 | 12.4 min | 4 | 1 |
| implementation-planner | Plan L08 Agent Performance | claude-opus-5-5 | 13.82M | 127.0k | 98% | 66 | 23.0 min | 4 | 0 |
| implementer | L08 phase 0+1a baseline+contract | claude-opus-5-5 | 738.0k | 8.8k | 91% | 13 | 6.1 min | 0 | 2 |
| implementer | L08 phase 1b server stream | claude-opus-5-5 | 6.90M | 62.7k | 93% | 54 | 22.2 min | 2 | 2 |
| implementer | L08 phase 1c client stream | claude-opus-5-5 | 28.72M | 152.4k | 97% | 132 | 30.4 min | 3 | 4 |
| plan-verifier | L08 full plan verification | claude-sonnet-5-5 | 2.45M | 19.5k | 94% | 23 | 4.7 min | 0 | 2 |
| architecture-reviewer | L08 architecture review | claude-sonnet-5-5 | 271.9k | 5.1k | 81% | 6 | 0.8 min | 0 | 0 |
| general-purpose | L08 frontend lenses + perf rubric | claude-opus-5-5 | 3.47M | 22.1k | 87% | 30 | 4.5 min | 2 | 0 |
| architecture-reviewer | L08 arch re-review iter 2 | claude-sonnet-5-5 | 160.2k | 2.6k | 73% | 4 | 0.3 min | 0 | 0 |
| plan-verifier | L08 re-grade D7, D11, R-42 | claude-sonnet-5-5 | 88.6k | 2.3k | 71% | 4 | 1.0 min | 0 | 0 |
| general-purpose | L08 security/zod/backend lenses | claude-opus-5-5 | 1.02M | 11.5k | 90% | 13 | 2.2 min | 0 | 0 |
| general-purpose | L08 /code-review bug pass | claude-opus-5-5 | 270.0k | 3.8k | 67% | 5 | 0.7 min | 1 | 0 |
| general-purpose | /code-review high | claude-opus-5-5 | 5.04M | 33.3k | 97% | 40 | 6.5 min | 0 | 1 |
| implementer | L08 fix round 3: F-09 tz probe | claude-opus-5-5 | 504.0k | 6.1k | 92% | 11 | 3.9 min | 0 | 0 |
| architecture-reviewer | L08 arch re-review iter 3 (client) | claude-sonnet-5-5 | 228.1k | 3.9k | 76% | 5 | 0.6 min | 0 | 0 |
| architecture-reviewer | L08 arch re-review F-09 probe | claude-sonnet-5-5 | 175.4k | 2.4k | 78% | 4 | 0.6 min | 0 | 0 |
| plan-verifier | L08 final plan verification | claude-sonnet-5-5 | 1.25M | 26.1k | 92% | 16 | 6.4 min | 0 | 0 |

Token totals are what the transcripts record; harness-side cost (hooks, MCP servers) is not included.

## Timeline
1. spec-creator — requirements; user answered BQ-1…BQ-8 in two `AskUserQuestion` batches (relayed), approved the spec.
2. implementation-planner — plan; user answered OQ-1, UX batch, Q-07, Q batch, then Q-11 (raised by spec-creator, which was resumed **in parallel** with the planner).
3. spec-creator (R-106…R-112) ∥ planner resume — planner missed the new IDs → one extra planner resume.
4. `/run-plan`: implementer 0+1a → server ∥ client implementers (disjoint ownership table) → plan-verifier ∥ architecture-reviewer ∥ frontend lens → fix 1 (both streams resumed) → scoped re-review → browser smoke (user OK to kill their `next dev`) + in-place build.
5. User mid-run: shared a Skill-Stats screenshot and asked why the findings widget is missing → new follow-up cycle `L08-skill-stats` (brief in `.devdigest/cache/sdd/L08-skill-stats/brief.md`); UX-07 had been silently deferred by the coordinator's relay.
6. `/pr-self-review`: gates clean; security lens + `/code-review high` found 5 WARNING + 3 SUGGESTION → fix 2 (both streams resumed) → user decided the tz probe → fix 3 (fresh implementer) → scoped re-reviews → smoke 2 → clean build → final plan-verifier (176 done, 1 partial V8, 3 cannot verify).

## Per agent

### spec-creator
- Hard: no `AskUserQuestion` in a background run — 8 blocking questions came back in the hand-back and needed 4 follow-ups (record answers, record UX/Q decisions, Q-11). One tool error: grep on a non-existent `server/src/db/seed` path.
- Easy: first pass produced 89 EARS requirements, caught that the mockup's by-agent breakdown ($10.75) does not add up to its total ($8.74), and that the Stats tab and `GET /agents/:id/stats` did not exist.
- Duplicated: read ~20 of the same files the planner read afterwards (script list) — expected for two cold agents.
- Missed: raised Q-11 *after* the planner had already decided the same point, producing a spec/plan disagreement the coordinator had to resolve.

### implementation-planner
- Hard: 4 follow-ups; the third one happened because it re-read the requirements while spec-creator was still adding R-106…R-112 (its report: "Q-11's own R-IDs after R-105 aren't in the requirements file yet").
- Easy: correct recommendation set (no new dependency, recharts already present, HoverNote promotion), ownership table that allowed zero-collision parallel streams.
- Missed: nothing material; the UX batch it produced was complete — the omission was in the coordinator's relay (below).

### implementer (phase 0+1a)
- Easy: baselines + verbatim contract + empty `diff -r` in 6 min, no correction.
- Hard: 2 tool errors, both a `verify --related` "No test files found" crash and an exit code from a trailing `ls` — noise, not failures.

### implementer (server stream)
- Easy: all server steps + tests green first pass (765 + 159), safer-than-plan SQL (no `sql.raw`, numeric sum).
- Missed: F-01 (route built the repository) and the tz / far-past-date 500s (F-08, F-09) — the latter only surfaced at the pr gate.

### implementer (client stream)
- Hard: most expensive writer — 28.72M input over 132 requests; resumed for two fix rounds, so every round re-paid the accumulated context. 4 tool errors (a heredoc quoting EOF, one transient typecheck error, `ls` exit codes).
- Easy: 13 steps + 47 tests first pass; `next build` proven in a scratch copy when :3000 was occupied.
- Missed: F-02 (stray fetch), F-12, F-13 — behavioural React/router issues found only by later lenses.

### plan-verifier
- Hard: tried `sleep 60` + `cat` to wait on a background run (blocked) and `Monitor` (not available to it) — 2 tool errors in the first pass.
- Easy: per-item verdicts with citations; correctly kept browser-only items `cannot verify` instead of guessing.

### architecture-reviewer (×4)
- Easy: cheap (0.3–0.8 min each), every pass ran `pnpm arch` first; F-01 was the only boundary finding and it was right.
- Duplicated: noted three times that `do-not-flag.md` / `gates.md` / `severity-map.md` say 25 grandfathered entries while the file has 21.

### general-purpose lenses (frontend+perf, security/zod/backend, /code-review)
- Easy: frontend lens found F-02 with a precise mechanism (Next wraps `router.replace` in `startTransition`); security lens verified claims against live node + psql instead of asserting.
- Hard: the `/code-review` skill spawned its own nested agent (5.04M input) on top of the wrapper.
- Missed / late: the security lens and `/code-review` ran only at the pr gate, so F-08, F-09, F-11, F-12, F-13 (5 WARNING) arrived after the review loop had already exited — two extra fix rounds.

### main (coordinator)
- Missed: relayed the planner's UX batch with only 6 of 9 items as selectable options; UX-07 (findings widget) became "deferred" without the user choosing it — the user later asked "why don't I see a separate findings widget?" (saved as feedback memory `relay-every-option`).
- Missed: ran spec-creator and the planner in parallel on the same requirement IDs (extra resume).
- Hard: `TaskStop` on the backgrounded `pnpm dev` stopped the bash wrapper only; `next dev` (PID 828) kept :3000, so the first in-place build overlapped a live dev server and had to be redone.

## Workflow
- **Parallelism worked where ownership was explicit:** server ∥ client writers had zero collisions; read-only reviewers ran in parallel every iteration.
- **Hand-overs were by path** (brief, requirements, plan, findings ledger, state log); retold content was limited to the implementer's deviations passed to reviewers.
- **Where the tokens went:** main 28.25M and the client stream 28.72M together are ~59% of input. The client stream's cost is mostly context re-paid across two resumed fix rounds, not new output.
- **Questions to the user:** 13 `AskUserQuestion` calls. Avoidable ones: the Q-11 round (spec-creator ∥ planner race) and the UX-07 follow-up (relay omission). The SUGGESTION batches and the tz-probe decision were genuine user calls.
- **Review coverage gap:** the phase-2 review had architecture + React/Next + perf but not security or a bug-hunting pass; everything those found was WARNING-level and fixable, but it cost two fix rounds and a second smoke/build cycle.

## Recommendations
| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Run the `security` lens (skill + `security-reviewer.md`) and `/code-review` in the phase-2 review, in parallel with plan-verifier and architecture-reviewer — not only at the pr gate | `.claude/skills/run-plan/SKILL.md` § review | pr gate becomes confirmation; saves the extra fix rounds | F-08, F-09, F-11, F-12, F-13 all first found at iter 3 (pr gate) |
| 2 | Never run spec-creator and implementation-planner concurrently; when a spec change is relayed mid-planning, finish the spec edit first, then resume the planner with the new IDs | `.claude/agents/README.md` § The chain | removes the R-ID race and one planner resume | planner report: "Q-11's own R-IDs after R-105 aren't in the requirements file yet" |
| 3 | When relaying a planner/spec include-defer batch, every item is its own selectable option (split across questions if > 4) | `.claude/skills/run-plan/SKILL.md` preamble (next to the "list every visible element" rule) | no silently deferred proposals | UX-07 omitted; user: "почему я не вижу отдельного виджета с файндингами?" |
| 4 | From fix round 2 on, spawn a fresh implementer with the plan + findings paths whenever the stream's context is large, not only for 1–2 findings | `.claude/skills/run-plan/SKILL.md` § One round, "small late round" | caps re-paid context | client stream 28.72M input / 132 requests after two resumes |
| 5 | plan-verifier: run `verify.mjs --it` in the foreground with a long timeout; never `sleep`/poll and do not expect `Monitor` | `.claude/agents/plan-verifier.md` § verification commands | removes recurring tool errors | 2 tool errors: `sleep 60` blocked, `Monitor` unavailable |
| 6 | Smoke step: stop a dev server by the PID listening on the port (`netstat -ano` → `taskkill /PID`), not by `TaskStop` on the shell, and re-check the port before `pnpm build` | `.claude/skills/run-plan/SKILL.md` § smoke | build never overlaps a live `next dev` | leftover PID 828 after `TaskStop`; first build had to be redone |
| 7 | Fix the grandfathered-violation count (25 → 21) in the pr-self-review references | `.claude/skills/pr-self-review/references/{do-not-flag,gates,severity-map}.md` | stops reviewers re-reporting the drift | flagged by architecture-reviewer in 3 of 4 passes |
