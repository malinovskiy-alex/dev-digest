# Agents

Subagents for this repo, one file per agent. Each is loaded by Claude Code from
its frontmatter; nothing here needs registering anywhere else.

This file is the **map**. Every rule, hard limit and report template lives in the
agent's own file — read that before you use or change one.

## Why they exist at all

A subagent starts with an **empty context window**. It does not see this
conversation, what the main session already read, or which skills it already
loaded. That cuts both ways:

- **The win** — a long investigation or a wide implementation does not bloat the
  main session. Only the final report comes back.
- **The cost** — every repo rule has to be re-established inside the agent, and
  nothing can be "handed over" by being mentioned. So **state passes as files**,
  never as a retold summary: `specs/<plan>.md` for a plan, the working tree for
  an implementation.

That single constraint explains most of the design below.

## The roster

| Agent | Model | Writes | Reach for it when |
|---|---|---|---|
| [`researcher`](researcher.md) | `sonnet` | nothing | a fact has to be looked up and cited — in this repo's files and history, or in external docs and specs |
| [`spec-creator`](spec-creator.md) | `opus` | `<pkg>/specs/*.requirements.md`, or `specs/` when cross-package | a feature is described but has no requirements yet — EARS requirements, design gaps, module interaction, UX proposals the user accepts or rejects |
| [`implementation-planner`](implementation-planner.md) | `opus` | the plan `<specs-dir>/<slug>.md` only — never a `*.requirements.md` | requirements exist and need an implementation plan another agent can execute cold; checks them, asks, recommends, and asks multi- vs single-agent |
| [`implementer`](implementer.md) | `opus` | product code | a plan exists, or the task is a concrete change in `server/` / `client/` / `reviewer-core/` / `e2e/` / `mcp/` |
| [`test-writer`](test-writer.md) | `opus` | test files only | a change needs tests, or a plan's `Done when` names a suite |
| [`plan-verifier`](plan-verifier.md) | `sonnet` | nothing | code is finished and the question is whether the plan is actually done |
| [`architecture-reviewer`](architecture-reviewer.md) | `sonnet` | nothing | the change leans on a boundary — a ring, an import direction, a module reaching sideways |
| [`doc-writer`](doc-writer.md) | `sonnet` | `docs/**` only | a feature works and its lasting explanation needs a home |

## The chain

```
researcher            →  facts, quotes, "could not establish"
     ↓
spec-creator          →  specs/L<NN>-<slug>.requirements.md   ← what, in EARS
     ↓
implementation-planner →  specs/L<NN>-<slug>.md                ← how: the plan
     ↓
implementer           →  baseline file + code + verify.mjs output
     ↓
plan-verifier (gap)   →  verdict per item, test items left for later   ┐ parallel,
architecture-reviewer →  boundary findings, CRITICAL/WARNING/SUGGESTION ┘ read-only
     ↓  main session merges both into .devdigest/cache/sdd/<slug>/findings.md
implementer (fix)     →  resumed via SendMessage, not a fresh spawn — skipped if nothing to fix
     ↓
test-writer           →  tests + verify.mjs output vs baseline
     ↓
plan-verifier (final) →  re-grades only what was not `done`, plus the test items
     ↓
doc-writer            →  docs/ page for what actually shipped
     ↓
/pr-self-review                                ← the pre-PR gate (a skill): routes the
                                                  security lens, runs /code-review for bugs
```

**Why reviewers run before the tests.** A missing step or a file in the wrong ring
found *after* `test-writer` means rewriting tests against code that then moves. Both
reviewers are read-only, so they can run in parallel on the same tree.

**Why the fix round resumes instead of respawning.** A fresh `implementer` re-reads
the plan, the package rules and the code it just wrote. Resuming it with
`SendMessage` and the findings file costs only the fixes.

**One verification script.** Every agent that runs tests goes through
[`scripts/verify.mjs`](../../scripts/verify.mjs), from inside the package directory.
It owns the per-package commands, prints a few lines instead of the runner's output,
and labels each failure `baseline` or `new` against
`.devdigest/cache/verify/<slug>.<pkg>.json`, which `implementer` writes once before
the first edit. Only `implementer` passes `--save-baseline`.

**`/implement <plan>` runs everything after the plan**
([`../skills/implement/SKILL.md`](../skills/implement/SKILL.md)). `spec-creator` and
`implementation-planner` are run by hand first. By default `implementer` also writes
the plan's tests (one agent that already holds the code is cheaper than a second
one re-reading it) — `--test-writer` brings `test-writer` back, `--docs` adds
`doc-writer`. It keeps the findings ledger and the review → fix loop, and resumes
with `--from`.

Sequencing is the **main session's** job, not the agents'. **None of the eight**
spawns a subagent of its own, and none of them commits, pushes or opens a PR —
that stays with you, after [`pr-self-review`](../skills/pr-self-review/SKILL.md).

Two distinctions a reader will otherwise guess at:

- `plan-verifier` asks *is the plan done?*, against `specs/<plan>.md` item by item.
  `/pr-self-review` asks *can this ship?*, against routing, G1–G12 and the block
  rule. Neither replaces the other.
- `architecture-reviewer` is **one lens in depth**, with a counted baseline and an
  explicit `Not flagged` section. `/pr-self-review` is the **router and the gate**
  over the whole diff.

## Artifacts in and out

| Agent | Takes | Produces | Where it lands |
|---|---|---|---|
| `researcher` | one concrete question | Report A (repo) or Report B (external) — findings with evidence, sources, and an explicit *Could not establish* section | the hand-back report only |
| `spec-creator` | a request, plus the design sources the user supplies — text, Figma exports, existing code, a reference repo | EARS requirements with stable `R-NN` IDs, a design-gap table, a module-interaction diagram, UX proposals and open questions — blocking questions asked first (≤8), the rest inline in the file | **a file** `<specs-dir>/<slug>.requirements.md`, `Draft` until the user approves, plus a short hand-back |
| `implementation-planner` | a `<slug>.requirements.md` (or a concrete, bounded task), plus the user's answers — ≤8 questions, the multi- vs single-agent question always among them | a plan traced to requirement IDs: `Requirements check`, `Decisions`, `Recommendations`, `Skill map`, `Constraints`, `Steps`, `Execution` (per the chosen mode), `Verification`, `Done when`, `Left to reviewers` | **a file** in `specs/` or `<pkg>/specs/`, plus a short hand-back that names the path and does *not* repeat the plan |
| `implementer` | a path to a plan in `specs/` (or a concrete task) | changed files, plus a report: changes per file with the skill applied, verbatim command results, baseline comparison, deviations, what is left to reviewers | **the working tree**, uncommitted |
| `test-writer` | the code under test, plus a plan's `Done when` when there is one | test files, plus a report: files written, the behaviour each pins down, what must break for each to fail, verbatim command output, baseline comparison, what it deliberately did not test | **the working tree**, uncommitted |
| `plan-verifier` | a path to a plan in `specs/`, plus the working tree | one verdict per extracted item from a five-value vocabulary, each with a `file:line`; outcome-check command output; deviations; out-of-scope changes | the hand-back report only |
| `architecture-reviewer` | the open change | `pnpm arch` result and the counted baseline, then findings with `file:line`, rule name and severity, plus `Not flagged` and `Cannot assess` | the hand-back report only |
| `doc-writer` | a shipped feature, and the code that implements it | one `docs/` page, plus a report naming the path, the section rule that put it there, a claim → `file:line` table, and what belongs elsewhere | **a file** in `docs/` or `<pkg>/docs/`, plus the index line |

## Permissions at a glance

What is *absent* is as deliberate as what is present.

| Agent | `tools` | Notably absent | Why |
|---|---|---|---|
| `researcher` | `Read, Glob, Grep, Bash, WebSearch, WebFetch, AskUserQuestion, TodoWrite` | `Write`, `Edit` | read-only by construction; `Bash` is for reading only |
| `spec-creator` | `Read, Glob, Grep, Write, Edit, AskUserQuestion, TodoWrite` | `Bash`, `WebSearch`, `WebFetch`, `Skill` (its one skill, `mermaid-diagram`, comes via `skills:`) | `Write`/`Edit` confined to `*.requirements.md` in a `specs/` folder by prose; no `Bash`, so the shell is no way around that rule. External facts go to `researcher` |
| `implementation-planner` | `Read, Glob, Grep, Write, Edit, AskUserQuestion, Skill, TodoWrite` | `Bash`, `WebSearch`, `WebFetch` | `Write`/`Edit` confined by prose to the plan `<specs-dir>/<slug>.md` — never a `*.requirements.md`; no `Bash`, so the shell is no way around that rule. External facts and git history go to `researcher` |
| `implementer` | `Read, Write, Edit, Glob, Grep, Bash, Skill, TodoWrite` | `AskUserQuestion` | the plan is the contract; an unanswerable question becomes a line in `## Deviations`, not a pause |
| `test-writer` | `Read, Write, Edit, Glob, Grep, Bash, Skill, TodoWrite` | `Agent`, `AskUserQuestion`, `WebSearch`/`WebFetch` | writes tests, runs them, reports the output. `Write`/`Edit` are confined to test files by prose |
| `plan-verifier` | `Read, Glob, Grep, Bash, TodoWrite` | `Write`, `Edit`, `Skill`, `skills:`, `Agent`, `AskUserQuestion` | read-only by construction; **no skill list on purpose** — a loaded best-practices skill is how a per-item verdict degenerates into generic advice |
| `architecture-reviewer` | `Read, Glob, Grep, Bash, Skill, TodoWrite` | `Write`, `Edit`, `Agent`, `AskUserQuestion` | read-only; `Bash` runs `pnpm arch` and reads git. Never `arch:baseline` |
| `doc-writer` | `Read, Glob, Grep, Bash, Write, Edit, Skill, TodoWrite` | `Agent`, `AskUserQuestion`, `WebSearch`/`WebFetch` | `Write`/`Edit` confined to `docs/**` by prose |

**`skills:` is a token budget, not a reading list.** Every skill named there is
injected **whole** into the agent's context at startup — before it has read the
plan. So a skill is preloaded only when nearly every run of that agent needs it;
everything else is loaded with the `Skill` tool when a step actually hits it.
Today: `implementer`, `implementation-planner` and `architecture-reviewer` preload
only `onion-architecture` + `frontend-ui-architecture` (they decide where every
file goes), `spec-creator` and `doc-writer` only `mermaid-diagram`, `test-writer` nothing (its
skill depends on which package it is testing). Before this rule `implementer`
preloaded twelve skills, ≈128 KB, on every spawn.

`plan-verifier` deliberately declares **none**, and that absence is itself a rule: a loaded
best-practices skill is exactly how a per-item verdict turns into generic advice,
so it has no `Skill` tool either. The *mapping* — which skill covers which file —
stays in each agent's body, because knowing a skill is loaded is not knowing when
to apply it.

`Agent` is absent from all eight `tools:` lists. Omitting it is the documented way
to stop a subagent spawning helpers, and each file says so in one line under its
own `## Hard rules` so that a later editor does not "restore" it.

### Path and command limits are prose, not config

`implementation-planner` may only write a plan into `specs/`, never a requirements spec; `implementer` may not run
`git commit`/`push`/`checkout`/`stash`, rewrite a lockfile, or touch
`.claude/skills/**`. The same shape holds for the four newer agents:
`test-writer` writes **test files only** and never production code,
`doc-writer` writes **`docs/**` pages plus the index line that points at a new
one** and nothing else, and `plan-verifier` and `architecture-reviewer` write
**nothing at all**. **None of that is expressible in the frontmatter.**

- `tools:` supports command specifiers for `Bash` (`Bash(git diff:*)`) but cannot
  scope `Write` to a path.
- `disallowedTools:` with a specifier — `Bash(git push *)` — removes the **whole**
  Bash tool, not the one command.
- Only `permissions.deny` in `settings.json` scopes a single command while keeping
  the tool, and that applies to the main session too, which would break it.

So the limits live in each agent's `## Hard rules`, and `settings.json` is
untouched. If you want them machine-enforced, the lever is a `hooks:` block in the
agent's frontmatter plus a guard script — the same shape as the existing
`gh pr create` guard in [`settings.json`](../settings.json).

## Where the agents' rules come from

Every agent here encodes rules rather than invents them. The two sources of truth:

### Anthropic documentation

| Rule it produced | Source |
|---|---|
| only `name` + `description` are required; a missing `description` makes the file skipped | [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| an omitted `tools:` inherits every tool — so every agent here enumerates its own | " |
| `disallowedTools` with a specifier removes the whole tool → limits are prose | " |
| `"use proactively"` in `description` encourages delegation; keep descriptions short (combined >15k tokens warns at startup) | " |
| one agent, one responsibility (✓ *"Reviews code for quality"* vs ✗ *"Handles all code analysis…"*) | sub-agents quickstart |
| a subagent sees neither the conversation, the read files, nor the invoked skills → the read-first tables and the file-based handoff | sub-agents, [features-overview](https://code.claude.com/docs/en/features-overview) |
| the parent receives only the final report → `implementation-planner`'s hand-back names the path instead of repeating the plan | " |
| skills and subagents compose via the `skills:` field | features-overview |
| *"trust-then-verify gap"* — always give the agent a way to verify → the verification tables | [best-practices](https://code.claude.com/docs/en/best-practices) |
| *"infinite exploration"* — scope it or delegate it → `implementation-planner`'s ≤8 questions and the requirements' `Не в скоупі` | " |
| progressive disclosure: metadata first, instructions on trigger → the skill tables in each body | [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) |
| omitting `Agent` from `tools:` is the documented way to stop a subagent spawning helpers | [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| `tools:` cannot be scoped to a path; a specifier in `disallowedTools` removes the whole tool → the write-path limits are prose, and `permissions.deny` is rejected because it would bind the main session too | " |
| `claude plugin validate .claude/agents` is the only pre-session check — an invalid file is skipped silently (requires Claude Code ≥ v2.1.233) | " |
| combined agent `description`s over 15,000 tokens warn at startup → the description budget is measured, not assumed | " |
| a read-only reviewer's tool set is `Read, Glob, Grep` (+ `Bash`) — the docs' own worked examples omit `Edit`/`Write` | [best-practices](https://code.claude.com/docs/en/best-practices) |
| *"Report gaps, not style preferences"*, and *"review the diff against PLAN.md… every requirement implemented"* → `plan-verifier`'s whole remit | " |
| *"Always provide verification… If you can't verify it, don't ship it"* and *"show evidence rather than asserting success"* → `test-writer` runs what it writes and pastes the output | " |
| a reviewer told to find gaps will report some even when the work is sound → the `Not flagged` / `Noticed, not my call` sections | " |
| a fresh subagent *"evaluates the result on its own terms"* → why verification is a separate agent | " |
| a standalone skeptical evaluator beats self-review; grade against stated principles, not beauty | [harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| rules-based feedback first, LLM-as-judge last → `architecture-reviewer` runs `pnpm arch` before any judgement | [building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) |
| grade outcomes, not the sequence of steps; deterministic graders for coding agents → `plan-verifier` checks outcomes and runs the suites | [demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| a `file:line` verification bar cuts false positives | [code review](https://code.claude.com/docs/en/code-review) |

Two claims were **not** taken at face value. The blog figure that multi-agent work
costs 3–10× the tokens is single-source and unverified, so only its direction was
used (pass a file, not a retelling) — nothing depends on the number. And nesting
depth is documented as 3 layers in the reference doc but 5 in a blog post; the
conflict is sidestepped because no agent here spawns subagents.

### This repo

Every entry below already cost someone time here, which makes it as load-bearing
as anything upstream.

| Rule it produced | Source |
|---|---|
| `@devdigest/shared` is vendored twice — both copies, one commit | [`AGENTS.md`](../../AGENTS.md) |
| lockfiles are load-bearing; `main` is the course starter; commands run from inside the package | " |
| two agents in one checkout destroy each other's work → no `checkout`/`stash`, and no stashing to find a baseline | [`INSIGHTS.md:42`](../../INSIGHTS.md) |
| a DB test must be `*.it.test.ts`, or it poisons the unit suite | [`server/INSIGHTS.md:91`](../../server/INSIGHTS.md) |
| a service resolves its model through the container, never by importing `settings` | `server/INSIGHTS.md:110` |
| `pnpm typecheck` does not cover `test/` → run the suite too | [`server/AGENTS.md`](../../server/AGENTS.md) |
| no `@testing-library/user-event` here — use `fireEvent` | [`client/INSIGHTS.md:175`](../../client/INSIGHTS.md) |
| 6 of 11 tests in `indexer-pipeline.test.ts` fail on a clean tree → failures are compared, not counted | [`pr-self-review`](../skills/pr-self-review/SKILL.md) §2 |
| the path → lens table, and that `perf-prompt` is a rubric (`docs/agent-prompts/performance-reviewer.md`), not a loadable skill | [`routing.md:97`](../skills/pr-self-review/references/routing.md) |
| the severity vocabulary and the per-lens mapping are cited, never invented | `contracts/findings.ts:11`, `severity-map.md`, `general-reviewer.md:53-73` |
| a new `pnpm arch` failure is CRITICAL and machine-verified; a grandfathered entry is not a finding | `severity-map.md`, `do-not-flag.md` |
| the known-violations file must be **counted** — it holds 21 entries while three reference files say 25 | `server/.dependency-cruiser-known-violations.json` |
| `routing.md` routes no `server/test/**` or `reviewer-core/test/**` path → `test-writer` picks from the reconciled skill list and says which | `routing.md`, `scripts/lib/routing.mjs:32,45,60` |
| a generator is not a lens → `mermaid-diagram` is never routed | `routing.md`, *Adding a skill to the routing* |
| the integration suite silently skips itself; counts, not exit codes | `server/INSIGHTS.md:72`, `:265` |
| `pnpm typecheck` does not cover `server/test/` | `server/INSIGHTS.md:128` |
| `findByRole` hides a duplicate accessible name; a new `common` namespace breaks colocated tests silently while staying green | `client/INSIGHTS.md:44`, `:117` |
| a test's own rubric: what would have to change in production for it to fail | `docs/agent-prompts/test-quality-reviewer.md` |
| where a doc page goes, and what each `docs/` directory refuses | `docs/README.md`, `<pkg>/docs/README.md`, root `AGENTS.md` *Where to write what* |
| a spec stays the record of intent once it ships | [`specs/README.md`](../../specs/README.md) |
| server tests live in `server/test/`, reviewer-core's and mcp's in `test/`, client tests are colocated — not uniform | `server/AGENTS.md`, `reviewer-core/AGENTS.md`, `mcp/AGENTS.md`, `client/AGENTS.md` |

One design decision is **not** from a source: `implementation-planner` derives its `Skill map`
from the same `routing.md` that `implementer` consults. Nothing upstream suggests
it — it is the answer to the isolated-context problem. Both sides reading one
table is why a plan cannot quietly contradict the implementation rules, and it is
checkable rather than taken on trust.

## Adding an agent

1. One file, `<name>.md`, `name` matching the filename.
2. Write the `description` for the *caller*: the trigger, the boundary, and what
   the agent refuses to do. It is the only thing the main session reads when
   deciding whether to delegate.
3. Enumerate `tools:`. Leaving it out grants everything.
4. Assume **nothing** is loaded: name the files the agent must read, because no
   `AGENTS.md` or `INSIGHTS.md` arrives on its own.
5. Give it an output template. A report with a fixed shape is what makes the
   agent composable; prose is not.
6. `claude plugin validate .claude/agents` — an invalid file is skipped silently,
   not reported at runtime. The subcommand needs Claude Code **≥ v2.1.233**; on an
   older CLI there is no pre-session check at all.
7. Add a row to the roster above. The *Artifacts in and out* and *Permissions at a
   glance* tables grow per agent too — a roster row on its own leaves a reader
   guessing what the agent takes and what it is not allowed to do.
