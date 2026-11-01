# Retro — L05 Onboarding Generator (spec → plan → cross-model review → /run-plan) · 2026-11-01
Session `523573a1-05b7-4a1a-bd07-5857cddc087e` (continued after a compaction) · Branch `lesson/L05-onboarding-generator` · Verification: [`L05-onboarding-generator.verification.md`](L05-onboarding-generator.verification.md)

## Numbers

From `node .claude/skills/workflow-retro/scripts/session-stats.mjs --session latest` (and `--json`, summed over the 19 subagents launched from "Write Onboarding Generator spec" on).
The session also holds the whole L05 Project Context run ([its retro](L05-project-context.retro.md)), the R-74 change and PR #30; `main`'s share of this feature cannot be separated, so it is left out of the subtotal.

**Session total:** 327.19M input (314.48M cache read, 12.70M cache write, 3.7k uncached) · 1.68M output · 1721 API requests · cache hit 96% · 40 subagent(s)

**This feature's subagents (19):** 119.90M input · 786.2k output · 712 requests · cache hit 96% · 13 tool errors

| Agent | Runs | Input | Output | Requests | Share of input |
|---|---|---|---|---|---|
| implementer | 3 (phase 1 + fix 1 + phase 5; fresh for fix 2; fresh for fix 3 + 4) | 42.99M | 210.7k | 240 | 36% |
| test-writer | 2 (phase 4; regression rounds 2–4) | 27.50M | 167.2k | 153 | 23% |
| implementation-planner | 1 (+2 follow-ups: rev 2, rev 3) | 26.11M | 169.4k | 80 | 22% |
| general-purpose | 5 (cross-model review, 2 lenses, /code-review, security re-checks) | 12.34M | 107.7k | 119 | 10% |
| spec-creator | 1 (+4 follow-ups) | 4.80M | 64.8k | 42 | 4% |
| plan-verifier | 3 (gap, re-grade, final matrix) | 4.30M | 37.0k | 48 | 4% |
| doc-writer | 1 | 0.98M | 12.7k | 12 | 1% |
| architecture-reviewer | 3 | 0.88M | 16.7k | 18 | 1% |

## Timeline

1. User: five-part tour, full SDD pipeline, one commit per stage, designs `lab5.5-1/2.png`.
2. main asked 4 blocking questions **before** spawning (Share link, no clone, first tasks, cross-model reviewer) — per the L05 retro.
3. `spec-creator` → 82 ACs + 8 blocking questions (Q-01…Q-08) → relayed in 2 batches → Approved, 85 ACs → **commit `c35c6d7`**.
4. `implementation-planner` → plan rev 1 + REC-1…4 → user answers → `spec-creator` amends to 88 ACs (`3bf8350`).
5. **Cross-model review (Sonnet)**: "approve with changes", 1 BLOCKER, 7 MAJOR → planner rev 2 → **commit `993081a`**.
6. `/run-plan --test-writer --docs`: implementer steps 1–22 → architecture-reviewer ∥ plan-verifier (3 SUGG, 1 gap) → user picks all 3 SUGG (incl. F-03 JobRunner) → fix 1 → re-review → planner rev 3 → **commit `364fd75`**.
7. `test-writer` (tests from the ACs) → found product bug F-06 → implementer fix + flow 09 → **commits `6e82529`, `bf56712`**.
8. plan-verifier final matrix: 85/88 done, 2 e2e cannot verify; `pnpm build` run by main in a clean copy; doc-writer → **`43d51d8`**.
9. `/pr-self-review`: gates 0/0/0; 2 lenses + `/code-review` → 9 WARNING, 11 SUGGESTION → fix 2 (fresh implementer) + regression tests → **`8f3a4c6`, `992d05e`**.
10. Security re-check: scrub bypasses + a **deleting** escape (F-29, F-30) → fix 3 + round-trip tests → security re-check clean → **`ed61200`, `9ca3c38`**.
11. Last 2 SUGGESTIONs → fix 4 → **`7393492`, `93b8f88`**. Ledger: 33 fixed, 2 accepted, 1 wontfix.

## Per agent

### spec-creator
- **Hard:** still no `AskUserQuestion` in the background — 8 questions came back in the hand-back and went through main (2 batches, 2 follow-ups); a third and fourth follow-up applied the planner's REC answers.
- **Easy:** found the real design gaps from code, not the PNGs: "12,450 files" is impossible with a 5,000-file index cap, `getCriticalPaths` returns chains not files, no diagram renderer exists, `/onboarding` is taken by flow 06.
- **Missed:** picked the AC-40 script allow-list itself and said so — correctly surfaced, not decided silently.

### implementation-planner
- **Hard:** 26.1M input for 80 requests (106 Edits); two revisions after the plan was "done" — rev 2 for the cross-model review + 3 new ACs, rev 3 for drift after fix round 1 (D-3 said "not JobRunner" after the user chose JobRunner).
- **Easy:** an 88-row AC → step → test → commit matrix and 17 invariants each with a grep/arch check; plan-verifier and architecture-reviewer used them directly.
- **Missed (caught by the Sonnet reviewer):** a racy 409 lock (check, `await`, then set), shell injection through repo-controlled directory names in `cd`/`cp` commands, wrong retry counts, an invented `npm install` default.

### cross-model reviewer (Sonnet, general-purpose)
- **Easy:** 1.55M input, 3.2 min — the cheapest agent with the highest yield before any code: the BLOCKER (AC-86…88 absent from the plan), the lock race and the shell-safe-dirs rule all became INV-15/INV-17 and held through every later review.

### implementer
- **Hard:** phase 1 ran 38.5 min / 149 requests; `pnpm build` could not run next to a foreign `pnpm dev` on :3000 (built a scratch copy). 9 documented deviations, all accepted by plan-verifier.
- **Easy:** steps 1–22 with 0 new failures on the first pass; every INV held at the first architecture review.
- **Missed:** the server scrub (F-17) — fixed with more regex in round 2, which a security re-check broke again (F-29) and which **deleted prose** (F-30, the same class as L05's F-27). The render-level guard came only in round 3.
- **Fresh per round worked:** fix 2 cost 7.60M and fix 3+4 1.85M, against 33.5M for the long-lived phase-1 agent (L05 retro rec #6 applied).

### test-writer
- **Easy:** tests written from the ACs found a real product bug (F-06, unformatted header counts) and it refused to loosen the assertions; an "assertion strength" table in every report.
- **Hard:** `server/test/**` is still not routed by the gate (`routing.mjs:32`) — it picked lenses by hand in all three runs (L05 retro rec #5, not applied); Git Bash heredocs turned `\\` into `\` in test code and broke two writes.
- **Missed:** nothing material; it corrected two wrong expected values main had written into its prompt (a bare URL after a code span must be code-wrapped; `_https://…_` is client-only).

### plan-verifier
- **Easy:** gap pass found the only gap (AC-07 titles); the final pass built the full matrix and opened test bodies for ~30 ACs instead of trusting titles.
- **Hard:** `verify.mjs` reported a pnpm install log as a client typecheck failure; it re-ran `tsc` to prove it green.

### architecture-reviewer
- **Easy:** 3 runs, 0.88M input total; 0 CRITICAL/WARNING; caught the only structural smell (child importing parent helpers, F-01).

### PR lenses, /code-review, security re-checks (general-purpose)
- **Easy:** found 20 of the 36 findings, including correctness bugs no earlier agent saw (F-08 truncated `package.json`, F-09/F-10 coverage drift, F-12 permanent "Outdated").
- **Security re-check** (rec #2 of the L05 retro, applied) was decisive: it built a remark-gfm harness, found 30+ bypasses and the deletion regression, then verified the fix with 314 renders.

### doc-writer
- **Easy:** one page with a claim → `file:line` table; nothing to correct.

## Workflow

- **Where the defects were found.** In-loop (arch + plan-verifier + test-writer): 6 rows (F-01…F-06). Pre-PR gate and its re-checks: 30 rows (F-08…F-36), 4 extra fix rounds and 6 extra commits. Same pattern as L05 Project Context (23 of 29 at the gate): the in-loop reviewers by design do not look at security, performance or correctness — L05 retro rec #1 is still not applied, and it is again the largest cost.
- **Order and parallelism.** Read-only reviewers ran in parallel each round; in round 2 test-writer ran alongside the architecture and security re-checks safely (writers never overlapped). The script's "parallel with" for resumed agents spans their first-to-last record (L05 rec #9, still open).
- **Hand-overs.** Paths everywhere, with two improvements over L05: the implementer's deviations went to reviewers as a file (`phase1-implementer.md`), and the final plan-verifier got the previous verdicts. Two weak spots: main wrote expected values into a test-writer prompt (two were wrong), and the findings ledger was edited with ad-hoc `sed`/`node -e` regex — two edits silently matched nothing.
- **Where the tokens went.** implementer 36%, test-writer 23%, planner 22%. The planner's cost bought the matrix and invariants the later agents used directly; the long-lived phase-1 implementer and test-writer contexts are the waste (both resumed several times).
- **Questions to the user.** 20 `AskUserQuestion` calls from main (the session total includes L05 Project Context). For this feature about 12: 4 up front, 8 relayed spec questions, 1 REC batch, SUGGESTION picks after each review (4), disputes (1). The SUGGESTION picks were worth asking — the user chose differently from the default twice (F-03, all of round 3).

## Recommendations

| # | Change | Where | Expected effect | Evidence |
|---|---|---|---|---|
| 1 | Run the `security` + `perf-prompt` + `/code-review` passes in the **review** phase, next to architecture-reviewer, not only at the pre-PR gate | `.claude/skills/run-plan/SKILL.md` § review | defects found before the implementation commit; fewer late rounds and commits | 30 of 36 findings came after the gate; 4 extra rounds (state.md); same as L05 retro rec #1 |
| 2 | Make the cross-model plan review a standard phase 0 of `/run-plan` (or the planner's hand-back) with the Sonnet prompt saved as a template | `run-plan/SKILL.md` § 0, `.claude/agents/implementation-planner.md` | the lock race / injection / missing-AC class caught before code, for ~1.5M tokens | `specs/L05-onboarding-generator.plan-review.md`: 1 BLOCKER + 7 MAJOR, all held through later reviews |
| 3 | A plan that sanitises untrusted output must name **where the guarantee lives** (render/AST), and the server-side scrub is declared best effort and insertion-only from the start | `implementation-planner.md` § Constraints / Risks; `security` lens prompt | no regex arms race | F-17 → F-29/F-30 took 2 rounds; F-30 repeated L05's F-27 deletion class |
| 4 | A ledger helper: `node .claude/skills/run-plan/scripts/ledger.mjs add|set <id> <status> "<resolution>"` | `run-plan/scripts/` | no silent no-op edits of `findings.md` | two `sed`/regex edits matched nothing and had to be redone |
| 5 | Coordinator never writes expected values into a test-writer prompt — only finding IDs + "derive from the AC/finding" | `run-plan/SKILL.md` § tests | tests stay spec-derived | test-writer corrected two of main's expected values |
| 6 | `verify.mjs`: run `tsc` via `pnpm exec` without triggering an install, and delete/ignore a generated `client/pnpm-workspace.yaml` | `scripts/verify.mjs` | no false ❌ typecheck, no stray file in `git status` | plan-verifier and implementer both hit `ERR_PNPM_IGNORED_BUILDS`; stray file removed before commit `364fd75` |
| 7 | Route `server/test/**` and `reviewer-core/test/**` in the gate (L05 rec #5, still open) | `.claude/skills/pr-self-review/scripts/lib/routing.mjs:32` | test-writer stops picking lenses by hand | 3 test-writer reports say "unrouted" |
| 8 | Preflight check for `agent-browser` with a one-line install prompt to the user (L05 rec #8, still open) | `run-plan/SKILL.md` § 0 | e2e runs before the PR, not first in CI | AC-03 / AC-82 `cannot verify` |
