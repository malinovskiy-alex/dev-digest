---
name: implement
description: "Implements an approved plan from `specs/` through this repo's agent chain: implementer (code and the plan's tests) → review/fix loop (architecture-reviewer + plan-verifier, then implementer fix rounds until nothing blocking is open) → /pr-self-review. Starts from a plan that already exists — spec-creator and implementation-planner are run by hand before it. Keeps every review finding in one ledger with a status, resumes from any phase with --from. Invoked by the user as /implement. Never commits, pushes or opens a PR."
argument-hint: "<plan.md | slug> [--from implement|review|pr] [--max-fix N] [--test-writer] [--docs] [extra instructions]"
disable-model-invocation: true
---

# /implement — plan to pre-PR gate

You are the **orchestrator**. You run in the main session, spawn the agents in
`.claude/agents/`, pass files between them by **path**, keep the findings ledger,
and talk to the user. You do not write code or tests yourself, and you do not
read the code the agents wrote — their reports and the files below are what you
work from. Reading code yourself is how this session's context fills up before
the work is done.

The spec and the plan come **before** this command, run by hand:
`spec-creator` → `<slug>.requirements.md`, then `implementation-planner` →
`<slug>.md`. This command starts where the plan ends.

## 0. Preflight

`$ARGUMENTS`, token by token:

| Token | Means |
|---|---|
| a path to `specs/**/<slug>.md` (not `*.requirements.md`) | the plan |
| a bare word with an existing `<slug>.md` in `specs/` or `<pkg>/specs/` | the slug → the plan |
| `--from implement\|review\|pr` | resume at that phase |
| `--max-fix N` | cap on fix rounds, default **3** |
| `--test-writer` | tests go to `test-writer` after the review loop, instead of to `implementer` (§2) |
| `--docs` | run `doc-writer` before the pre-PR gate |
| everything else | extra instructions — passed **verbatim** to `implementer`, never used to change the plan |

Stop, and say why, if:

- no plan is found — *"run `implementation-planner` first"*;
- the plan's `**Requirements:**` file says `Status: Draft` with a blocking open
  question, or the plan's `## Risks / open questions` has a row blocking a step;
- `.git/HEAD` points at `main` — lesson work belongs on `lesson/L<NN>-<slug>`.
  Creating the branch is the user's call.

The plan is the input; you read only its header, `## Execution` and
`## Risks / open questions`. The agents read the rest themselves.

## 1. The run directory

`.devdigest/cache/sdd/<slug>/` (gitignored), owned by **you** — the agents never
write here:

| File | Holds |
|---|---|
| `state.md` | one line per finished phase: date, phase, agent, outcome. The resume point for `--from` |
| `findings.md` | the ledger — every finding from every reviewer, with a status (§4) |

## 2. Phases

```
implement ─▶ review ⇄ fix ─▶ [--docs] ─▶ pr ─▶ wrap-up
                (max N rounds)
```

### implement

Spawn `implementer`:

> Plan: `<plan path>`. Slug for the verify baseline: `<slug>`. Implement every
> step of the plan, **including the test steps** the plan's `## Execution`
> assigns to `test-writer` — this run has no separate test phase. Extra
> instructions from the user: <verbatim, or "none">.

With `--test-writer`, drop the test clause: test steps stay with `test-writer`.

**Keep the agent's ID** — every fix round resumes this same agent (§4). Its
`## Not done / blocked` lines become findings (source `implementer`).

### review

Spawn **both in one message** — read-only, so they may run in parallel:

- `architecture-reviewer` — the open change.
- `plan-verifier` — the plan path. Without `--test-writer`: a **full** pass.
  With it: the *gap* pass (test items not graded yet).

Merge both into `findings.md` (§4) and run the loop.

### tests — only with `--test-writer`

After the loop: spawn `test-writer` with the plan path and the slug, then
`plan-verifier` again, re-grading only the test items. New production failures
and `## Blocked` items → findings → one more loop.

### docs — only with `--docs`

`doc-writer` on the shipped feature. It writes `docs/` only and does not reopen
review.

### pr

Invoke `/pr-self-review` yourself. Each surviving CRITICAL → a finding (source
`pr-self-review`) → fix loop → `/pr-self-review` again. Do **not** let it open
the PR.

### wrap-up

1. `/engineering-insights`.
2. The report (§5).
3. Ask whether to commit. Never commit, push or open the PR unasked.

## 3. Questions from the agents

`implementer`, `architecture-reviewer` and `plan-verifier` have no
`AskUserQuestion` by design — their questions arrive as report lines
(`## Deviations`, `## Cannot assess`, `cannot verify`). Each one becomes a
finding or goes into **one** batched `AskUserQuestion` at the end of the phase.
Never decide for the user.

## 4. The findings ledger and the fix loop

### `findings.md`

```markdown
# <slug> — findings

| ID | Iter | Source | Sev | Where | Finding | Status | Resolution |
|---|---|---|---|---|---|---|---|
| F-01 | 1 | architecture-reviewer | CRITICAL | `server/src/modules/x/routes.ts:41` | business rule in the route (rule X) | fixed | moved to `service.ts:88` |
| F-02 | 1 | plan-verifier | gap | step 4 | `partial` — empty state not rendered | open | |
| F-03 | 1 | architecture-reviewer | WARNING | `…` | … | disputed | implementer: "…" → user: keep as is |
```

- **Sev:** CRITICAL / WARNING / SUGGESTION from the reviewers; `gap` for a
  `plan-verifier` verdict of `partial` / `not implemented` / `contradicted`;
  `test` for a new failure in any `verify.mjs` output.
- **Status:** `open` · `fixed` · `disputed` · `accepted` (the user chose to leave
  it) · `wontfix` (a SUGGESTION not taken) · `reopened`.
- Dedupe on *where + rule*: one defect from two sources is one row naming both.
  IDs are never renumbered.
- `cannot verify` is not a finding — it goes to the final report.

### What blocks

| Kind | Default |
|---|---|
| CRITICAL, `gap`, `test` | must fix |
| WARNING | fix — unless the implementer disputes it; then the user decides |
| SUGGESTION | not fixed. All of them in **one** `AskUserQuestion` (multiSelect) after the first review; the chosen ones become must-fix, the rest `wontfix` |

### One round

1. **Fix.** Resume the implementer with `SendMessage`:
   > Fix round <i>. Findings: `.devdigest/cache/sdd/<slug>/findings.md` — fix
   > F-01, F-02 (status `open` / `reopened`) and nothing else. For each: fix it and
   > cite `file:line`, or dispute it with a reason. Then
   > `verify.mjs --baseline <slug> --related <changed files>`, and one full run per
   > package you touched.

   No live implementer (a new chat, `--from review`)? Spawn a fresh one with the
   plan path, the findings path and the same instructions.
2. **Ledger.** `fixed` with the resolution, or `disputed` with the reason. A new
   failure in its `verify.mjs` output is a new `test` row.
3. **Disputes** → one `AskUserQuestion` for all of them: *keep the finding*
   (back to `open`) or *accept the reason* (`accepted`).
4. **Re-review**, scoped, in parallel:
   - `architecture-reviewer`: *"Re-review, iteration <i+1>. Confirm each finding
     marked `fixed` in `<findings path>` is resolved, then review only the files
     this round changed: <list from the implementer's report>."* Still there →
     `reopened`. New → a new row with this iteration number.
   - `plan-verifier`: only if the round had a `gap` row — *"Re-grade items
     <n, m> only."*
5. **Exit** when no must-fix row is `open` or `reopened`.

### The cap

After `--max-fix` rounds with must-fix rows still open, stop and ask:
**one more round** · **accept the rest as known issues** (`accepted`, listed in
the report and later in the PR description) · **stop**. A row reopened twice
means the fix and the rule disagree — say so in the question instead of looping.

## 5. Final report

```markdown
## /implement <slug> — done | stopped at <phase>
Plan `<path>` · Branch `<branch>` · Fix rounds: <n>

## Findings
<n> total · fixed n · accepted n · wontfix n · open n — `.devdigest/cache/sdd/<slug>/findings.md`
<every `accepted` row, one line each — these go into the PR description>

## Verification
<the last verify.mjs output per package, verbatim>

## Not verified
<every `cannot verify`, and what would settle it>

## Next
commit? — or what blocks it
```

## Rules

- **Writers run one at a time** — two agents writing in one checkout destroy each
  other's work (`INSIGHTS.md`, *What Doesn't Work*). Only the read-only reviewers
  run in parallel.
- **Never `--save-baseline` once `implement` has started** — the tree is no longer
  clean, and that baseline would bless the failures you are looking for.
- **No git writes**: no commit, push, branch switch, stash, `gh pr create`.
- **Do not fix anything yourself**, however small. An unreviewed fix is the
  failure this chain exists to prevent — route it through a fix round.
- **Give agents paths, not retellings.** One sentence of phase, then paths.
- Talk to the user in Ukrainian; identifiers, paths and rule names stay as they are.
