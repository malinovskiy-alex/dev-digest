# Four new subagents — `test-writer`, `architecture-reviewer`, `plan-verifier`, `doc-writer`

**Goal:** the main session can delegate four jobs it currently does inline — writing
tests, judging architectural boundaries, checking finished code against the plan it
came from, and documenting a shipped feature — each to a subagent with enumerated
tools, a fixed report shape and prose limits it cannot talk itself out of.

**Not in scope:** any change under `server/`, `client/`, `reviewer-core/` or `e2e/`;
a security-review agent; new lenses in `pr-self-review`; machine enforcement via
hooks. See [`## Not in scope`](#not-in-scope) for the full list and the reasons.

**Branch:** `lesson/L04-researcher-agent` — the branch `.claude/agents/` was created
on and where it is still untracked. Never `main` (`AGENTS.md`, *Hard rules*).

This is a **repo-tooling** plan. The product sections of the
[`specs/` template](README.md) (`Touches`, `Contract`) do not apply and are replaced
by [`## What this touches`](#what-this-touches); there is no Zod contract and
`@devdigest/shared` is not involved at all — see
[`## Explicitly untouched`](#explicitly-untouched).

---

## What this touches

| Path | Change |
|---|---|
| `.claude/agents/test-writer.md` | **new** |
| `.claude/agents/architecture-reviewer.md` | **new** |
| `.claude/agents/plan-verifier.md` | **new** |
| `.claude/agents/doc-writer.md` | **new** |
| `.claude/agents/README.md` | roster, chain, artifacts, permissions, two sourcing tables |
| `AGENTS.md` | the four prose lines under `## Agents` |
| `.claude/skills/README.md` | the `## Agents` paragraph (note: this file already carries uncommitted changes — `git status` shows it as `M`) |

Seven files, no source file in any of the four packages.

---

## Decisions made for you

No `AskUserQuestion` was used; the user asked to read the finished plan. Each of
these is a call the files supported but did not force. Overrule any of them in the
spec before step 1 and the rest of the plan still stands.

| Decision | Why | Where it would change |
|---|---|---|
| All four land on `lesson/L04-researcher-agent`, in one commit per agent file plus one for the README edits | `.claude/agents/` is untracked on this branch; splitting it across branches would leave a roster row pointing at a file that is not there | `## Steps` |
| `model:` — `opus` for `test-writer`, `architecture-reviewer`, `plan-verifier`; `sonnet` for `doc-writer` | the repo's existing split is judgement→`opus`, retrieval→`sonnet` (`.claude/agents/README.md` roster). `doc-writer` reads and restates; the other three judge | each frontmatter |
| `fable` is not used anywhere | the briefing marks it **medium confidence, uncorroborated** [1] | — |
| `plan-verifier` gets **no** `skills:` list and **no** `Skill` tool | loading a best-practices skill is the exact mechanism by which it would start returning generic advice instead of per-item verdicts. Withholding the tool makes the anti-degeneration rule partly mechanical instead of purely prose | `plan-verifier` frontmatter |
| `test-writer` does not touch `e2e/` | an e2e flow needs the whole stack plus the `agent-browser` CLI and is data, not code (`e2e/AGENTS.md`, `TESTING.md` suite map) | `test-writer` hard rules |
| `doc-writer` may also edit the `## Index` / *candidates* list of the `docs/README.md` it writes into | a page nobody links to is a page nobody finds; `docs/README.md` carries that index | `doc-writer` hard rules |
| No `hooks:` block on any of the four | consistent with the existing three; the README already documents hooks as the lever *if* machine enforcement is wanted | `## Open questions` |
| `plan-verifier` runs the package commands | A11: deterministic graders — "does the code run and do the tests pass?" [7]. An outcome check that never executes anything is an opinion | `plan-verifier` tools |

---

## Shared design rules — all four files

Write these into each file rather than assuming them; a subagent starts with an
**empty context window** (`.claude/agents/README.md`, *Why they exist at all*).

### 1. The severity vocabulary is the repo's

Both review agents use `CRITICAL` / `WARNING` / `SUGGESTION` from `Severity`,
`server/src/vendor/shared/contracts/findings.ts:11`, and `request_changes` /
`comment` / `approve` from `Verdict`, same file `:26`. The definition of CRITICAL is
`docs/agent-prompts/general-reviewer.md:53-73`, read verbatim, including its rule
that *"I would have done it differently"* is at most a WARNING. The per-lens mapping
is `.claude/skills/pr-self-review/references/severity-map.md` — **cited, never
copied**, so it cannot drift.

Upstream backs the shape but not the words: the hosted product ships its own
severities (Important / Nit / Pre-existing) and that machinery is native to it, not
a frontmatter feature — a hand-written agent restates the convention in its body
(*medium confidence on transfer* [4]).

### 2. Evidence bar: a `file:line` or it is not a finding

Verbatim from the code-review docs: *"behaviour claims need a `file:line` citation
in the source, not an inference from naming"* [4]. Each review agent states this as
its own admission rule, and each carries a `## Not flagged` section so a reader can
see what was considered and dropped — the mitigation shape the repo already has in
`references/do-not-flag.md`, and the fix a third-party team reported for a reviewer
that produced *"a flood of vague suggestions, hallucinated syntax errors, and
helpful advice to 'consider adding error handling' on functions that already had
it"* (**third party, single source** [8]).

### 3. Rules before judgement

*"The best form of feedback is providing clearly defined rules for an output, then
explaining which rules failed and why"*; LLM-as-judge *"is generally not a very
robust method"* [6]. (The label "verify hierarchy" is a community paraphrase, not an
Anthropic term — the ordering is the article's own.) And a separate judge beats
self-review: *"separating the agent doing the work from the agent judging it proves
to be a strong lever"* [5]. So: machine check first, judgement second, and never a
verdict on taste alone.

### 4. Over-reporting is a failure, not thoroughness

A reviewer told to find gaps *"will usually report some, even when the work is
sound"*, and *"Chasing every finding leads to over-engineering… Tell the reviewer to
flag only gaps that affect correctness or the stated requirements"* [3]. Every one of
the four inherits `references/do-not-flag.md` as written.

### 5. Limits are prose, because they cannot be config

Verbatim: *"Tools **cannot be scoped to a path or directory**… An entry with a
specifier, such as `Bash(git push *)`, still removes the whole tool… To block
specific commands while keeping Bash, add a Bash deny rule to `permissions.deny` in
settings instead."* [1] — which confirms the decision already recorded in
`.claude/agents/README.md` (*"Path and command limits are prose, not config"*).
`.claude/settings.json` stays untouched: a deny rule there would apply to the main
session too.

### 6. `Agent` is withheld from all four

`tools:` is enumerated in every file and `Agent` is absent from every one. The docs
name exactly this as the way to stop an agent spawning helpers: *"omit `Agent` from
its `tools` list or add it to `disallowedTools`"* [2]. `disallowedTools` is not used —
a specifier there removes the whole tool [1], and omission is sufficient. Each file
says so in one line under `## Hard rules`, so a later editor does not "restore" it.
(A community claim of 5 nesting layers is **unverified** and not cited [2].)

### 7. Nothing here commits

No `git commit`, `push`, `gh pr create`, `checkout`, `switch`, `stash`, `restore` —
two agents in one checkout destroy each other's work (`INSIGHTS.md:42`). No
`pnpm add` / `npm i` / anything that rewrites one of the four lockfiles. No edits
under `.claude/skills/**` (most are upstream via `skills-lock.json`).

---

## Agent 1 — `test-writer`

### Frontmatter, exactly as it will be written

```yaml
---
name: test-writer
description: "Writes tests for this repo's suites — client components (vitest + RTL + jsdom), server unit, server integration (`*.it.test.ts`) and reviewer-core — loading the project skill that matches the code under test, then runs the package's own commands and reports their output verbatim against the known baseline. Use proactively when a change needs tests, when a plan's `Done when` names a suite, or when a seam (route, adapter, contract, pipeline, rendered component) changed with nothing covering it. Writes test files only, never production code, and never weakens an assertion or skips a case to make a suite green — a red suite is reported red. Does not touch `e2e/`."
tools: Read, Write, Edit, Glob, Grep, Bash, Skill, TodoWrite
model: opus
skills:
  - react-testing-library
  - frontend-ui-architecture
  - react-best-practices
  - onion-architecture
  - fastify-best-practices
  - drizzle-orm-patterns
  - typescript-expert
---
```

**Tool justification**

| Tool | Present because | |
|---|---|---|
| `Read`, `Glob`, `Grep` | it must read the code under test before writing a line | |
| `Write`, `Edit` | test files. The *path* limit is prose — it cannot be expressed here [1] | |
| `Bash` | runs the suite. Writing a test without running it is the trust-then-verify gap: *"Always provide verification (tests, scripts, screenshots). If you can't verify it, don't ship it."* [3] | |
| `Skill` | loads the matching skill per file, as `implementer` does | |
| `TodoWrite` | one todo per test file keeps a multi-suite job from losing a file | |

| Notably absent | Why |
|---|---|
| `Agent` | see shared rule 6 |
| `AskUserQuestion` | `implementer`'s precedent: an unanswerable question becomes a report line, not a pause |
| `WebSearch`, `WebFetch` | an external fact goes to `researcher` and gets cited (`planner`'s precedent) |

### Read-first table (goes in the file)

| Read | Why |
|---|---|
| `TESTING.md` | the suite map, and *"typological, not exhaustive"* — the repo's own answer to "how many tests" |
| `<pkg>/AGENTS.md` for every package touched | the real commands, and where a test file lives — which differs per package (below) |
| `<pkg>/INSIGHTS.md` for every package touched | every entry already cost someone time |
| the code under test, and one existing test beside it | the house style is in the neighbours, not in a doc |
| the plan's `Done when`, when there is a plan | which suite was promised |
| `docs/agent-prompts/test-quality-reviewer.md` | the repo's own rubric for whether a test proves anything |

### Skill map

Derived from `.claude/skills/pr-self-review/references/routing.md` and reconciled
against the skill list in `.claude/agents/planner.md`.

| Path | Skills | Source |
|---|---|---|
| `client/src/**/*.test.tsx` | `react-testing-library` | `routing.md` row 3 — the only test row in the table |
| placing a new `client/` test file | `frontend-ui-architecture` (colocation), `react-best-practices` when the test drives a hook | reconciled from `planner.md` |
| `server/test/**/*.test.ts` | **not in `routing.md`** — see the gap below. Pick by the code under test: `onion-architecture` (which ring → which suite), `fastify-best-practices` for an `app.inject()` route test, `drizzle-orm-patterns` for a repository test | — |
| `server/test/**/*.it.test.ts` | same, plus `TESTING.md`'s integration rules | — |
| `reviewer-core/test/**` | **not in `routing.md`** (it routes `reviewer-core/src/**` → `onion-architecture`, `typescript-expert`) | — |
| `e2e/**` | crosscutting, no lens — and out of scope for this agent | `routing.md` |

**The gap, verified:** `routing.md` and its machine twin route
`client/src/**/*.test.tsx` and nothing else test-shaped. `server/test/**` and
`reviewer-core/test/**` match no rule at all —
`scripts/lib/routing.mjs:32` is `/^server\/src\/.*\.ts$/`, `:41` is
`/\.(md|ya?ml|json)$/`, and `:56` is `if (!rule) continue;`. So a server test file
is unrouted by the gate today. The file must say this out loud and pick a skill
from the reconciled list. **Fixing `routing.md` is out of scope** — `routing.md`'s
own *Adding a skill to the routing* requires a prose row, a `routing.mjs` rule, a
`severity-map.md` entry and an eval case, which is its own change.

### Where a test file goes — per package, and it is not uniform

| Package | Location | Source |
|---|---|---|
| `client/` | colocated: `<Name>.test.tsx` beside `<Name>.tsx` inside the component folder | `client/AGENTS.md`, *Naming* |
| `server/` | `server/test/`, **not** beside the source | `server/AGENTS.md`, *Naming* |
| `reviewer-core/` | `reviewer-core/test/`, **not** beside the source; no integration suffix exists here | `reviewer-core/AGENTS.md`, *Naming* |

### Constraints (the table that goes in the file)

| Constraint | Source |
|---|---|
| a test touching Postgres is `*.it.test.ts`. No exceptions | `server/INSIGHTS.md:91` |
| the integration suite **silently skips itself** under parallelism — read the passed/skipped counts, not the exit code, and re-run a skipped file alone; `--no-file-parallelism` is the fix | `server/INSIGHTS.md:72`, `:265` |
| `pnpm typecheck` does not cover `server/test/` — a test file with a real type error passes it clean | `server/INSIGHTS.md:128` |
| there is no `@testing-library/user-event`; use `fireEvent`, and `vi.useFakeTimers()` + `act()` for hover timing. Installing it would rewrite `client/pnpm-lock.yaml` | `client/INSIGHTS.md:175` |
| never `findByRole` for an element whose accessible name is not unique once the screen settles — await a final-state element, then `getAllByRole(...)[n]` deliberately | `client/INSIGHTS.md:44` |
| a shared component translating a new namespace makes **every** existing colocated test provider render the raw key while staying green — add the namespace and assert the rendered string; watch stderr, not just the exit code | `client/INSIGHTS.md:117` |
| query by role, label or text — never by class or test id | `client/AGENTS.md`; and `getByTestId` is last-resort upstream: *"only recommended for cases where you can't match by role or text"* because *"the user cannot see (or hear) test ids"* [10] |
| mock the outside world through `server/src/adapters/mocks.ts`; hermetic by default | `TESTING.md`, *Conventions* |
| "this function has no test" is not a finding; "this changed a seam and the suite that owns it has nothing for it" is | `do-not-flag.md`, *Test coverage* |
| 6 of 11 tests in `server/src/modules/repo-intel/indexer-pipeline.test.ts` fail on a clean tree — `baseline`, not a regression, not to be fixed | `pr-self-review/SKILL.md` §2 |

### The anti-degeneration rule

Three sentences, in `## Hard rules`, unsoftened:

1. **Run what you write, and paste what it said.** *"Have Claude show evidence
   rather than asserting success: the test output, the command it ran and what it
   returned"* [9]. A test that was written but not run is reported as not run.
2. **Never weaken an assertion, loosen a matcher, add a `skip`/`only`, widen a
   snapshot or special-case production code to reach green.** If the test cannot
   pass honestly, the report says so and stays red. (This directive is **adopted as
   a repo rule**: the only source for the failure mode is a single third-party blog
   whose own directives are *"Report exactly what you observe"* and *"Do not mark a
   scenario as passed if not all assertions have been explicitly verified"* —
   **low confidence, not Anthropic guidance** [11]. What *is* upstream and citable
   for the same goal is [9] plus the separate-judge argument [5].)
3. **Per test, state what would have to break in production for it to fail.** The
   repo's own rubric: *"For each test, ask what would have to change in the
   production code for this test to fail. If the honest answer is 'almost nothing',
   the assertion is too weak"* — `docs/agent-prompts/test-quality-reviewer.md`. This
   is a **required column** in the report, which is what makes a weak test visible
   instead of merely present.

Also in the file: **do not write production code.** If a behaviour cannot be tested
without a change to the code under test, that goes in `## Blocked`, not into an
edit. (No Anthropic statement was found saying a test-writing agent must not write
implementation code [12]; this is a repo rule so the division of labour with
`implementer` stays clean.)

And: **how many tests is a judgement call with no documented threshold.** Bind it to
`TESTING.md` — *"typological, not exhaustive… If a test wouldn't catch a class of
regression we care about, we don't write it"* — and to the upstream warning against
writing *"tests for cases that can't happen"* [3]. One preprint reports agentic
**under**-testing (test changes in 49.6% of PRs touching test files; *"64.8% of PRs
have no changed line executed by any existing test"*) — **preprint, not
peer-reviewed, descriptive not prescriptive** [13].

### Report template

````markdown
## Tests written
| File | Suite | Behaviour it pins down | Skill applied |
|---|---|---|---|
| `client/src/.../FindingsPanel/FindingsPanel.test.tsx` | client | low-confidence rows hide behind the toggle | `react-testing-library` |

## Assertion strength
| Test | What must change in production for this to fail |
|---|---|
| "hides low-confidence findings" | the threshold constant, or the filter in `helpers.ts` |

## Commands
| Command | Directory | Result |
|---|---|---|
| `pnpm test` | `client/` | ✅ 36 passed |
| `pnpm exec vitest run --exclude '**/*.it.test.ts'` | `server/` | ❌ 6 failed — all `indexer-pipeline.test.ts`, baseline |

Verbatim output, trimmed to the assertion — never a summary of a failure:

```
FAIL  src/modules/repo-intel/indexer-pipeline.test.ts > ranks symbols
AssertionError: expected 3 to be 5
```

For an integration run, quote the **passed/skipped counts** (`server/INSIGHTS.md:72`):
`3 passed, 6 skipped` is not a green run.

## vs baseline
<what failed before these tests existed, and therefore does not count>

## Not tested, deliberately
| Behaviour | Why | Which suite would own it |
|---|---|---|

## Blocked
<anything untestable without a production change — named, not fixed. "none" if none>

## Left to reviewers
- test quality: <the assertion a reviewer should push on>
- architecture: <a test that needed Postgres to reach a service, if any>
````

### Chain position

After `implementer`, or standalone when only tests are missing. Before
`plan-verifier` — a plan item whose `Done when` names a suite cannot be graded
`done` until that suite exists.

---

## Agent 2 — `architecture-reviewer`

### Frontmatter, exactly as it will be written

```yaml
---
name: architecture-reviewer
description: "Read-only architecture review of the open change: runs `pnpm arch` first, then judges the boundaries dependency-cruiser cannot see — which ring a file belongs in, an import that points outward, a module reaching into a sibling's folder, a service that could only be unit-tested with Postgres, and the `client/` module-boundary rules. Returns findings in this repo's own vocabulary (CRITICAL / WARNING / SUGGESTION) with a `file:line` citation and the rule name behind each one, plus an explicit list of what it did not flag and why. Use after an implementation and before the PR. Writes nothing, fixes nothing, and does not review security, performance or correctness."
tools: Read, Glob, Grep, Bash, Skill, TodoWrite
model: opus
skills:
  - onion-architecture
  - frontend-ui-architecture
  - typescript-expert
---
```

**Tool justification**

| Tool | Present because |
|---|---|
| `Read`, `Glob`, `Grep` | a boundary claim needs the file read, not a grep hit — `researcher`'s rule, and the `file:line` bar [4] |
| `Bash` | `pnpm arch` from inside `server/`, `git diff` to see what is open, `node -e` to count the baseline file. Read-only. The docs' own worked security-reviewer tool set is `Read, Grep, Glob, Bash` [3] |
| `Skill` | loads `onion-architecture` for the ring decision |
| `TodoWrite` | one todo per changed file; a reviewer that loses a file reports clean |

| Notably absent | Why |
|---|---|
| `Write`, `Edit` | read-only by construction. The docs' own review agents omit both [3]; a reviewer that can edit will fix instead of report, and then nobody reviewed the fix |
| `Agent` | see shared rule 6 |
| `AskUserQuestion` | a question it cannot answer from the diff becomes a `cannot assess` line |
| `WebSearch`, `WebFetch` | the rubric is in this repo |

### Read-first table (goes in the file)

| Read | Why |
|---|---|
| `server/.dependency-cruiser.cjs` | the rules `pnpm arch` enforces, by name. A finding names the rule |
| `server/.dependency-cruiser-known-violations.json` | the grandfathered set. **Count it, do not trust prose** — see the drift note below |
| `server/specs/onion-debt.md` | why each grandfathered entry is still there |
| `.claude/skills/pr-self-review/references/severity-map.md` | the `onion-architecture` rows: what maps to CRITICAL vs WARNING vs SUGGESTION |
| `.claude/skills/pr-self-review/references/do-not-flag.md` | inherited as written |
| `docs/agent-prompts/general-reviewer.md:53-73` | the definition of CRITICAL, verbatim |
| `server/AGENTS.md`, `client/AGENTS.md`, `reviewer-core/AGENTS.md` | the conventions, which outrank the skill when they disagree |
| `server/INSIGHTS.md`, `client/INSIGHTS.md` | the boundary entries listed below |

### Skill map

| Changed path | Lenses this agent owns | Source |
|---|---|---|
| `server/src/modules/*/routes.ts`, `server/src/app.ts`, `server/src/platform/**` | `onion-architecture` (of that row's four lenses; `fastify-best-practices` and `security` belong to other reviewers, `perf-prompt` is not a skill) | `routing.md` |
| `server/src/modules/*/{service,run-executor}.ts`, `*/pipeline/**` | `onion-architecture` | " |
| `server/src/modules/*/repository*.ts`, `server/src/db/**` | `onion-architecture` | " |
| `server/src/adapters/**` | `onion-architecture` | " |
| `reviewer-core/src/**` | `onion-architecture`, `typescript-expert` | " |
| any other `server/src/**/*.ts` | `onion-architecture` | " |
| `client/src/lib/**`, `client/src/{app,components}/**` | `frontend-ui-architecture` — the `vendor → lib → components → app` direction, a `_components/` folder imported across routes, a deep import past an `index.ts` | " |
| `.claude/**`, `*.md` | nothing. Never lens the tooling | " |

**`perf-prompt` is not a skill and must not appear in the file as one.**
`routing.md:71`: *"there is no perf skill in the repo; this is the only perf rubric
we have"* — it points at `docs/agent-prompts/performance-reviewer.md`. Performance is
not this agent's job; if it notices a mechanism, one line under
`## Noticed, not my call` naming that rubric file.

### The anti-degeneration rule

**Lead with the machine-checked rule, every time, before any judgement call.** The
order is mandatory and is step 1 of the procedure in the file:

```sh
cd server && pnpm arch        # fails ONLY on a new boundary violation
```

- A new violation is **CRITICAL, `category: bug`** — *"machine-verified, no
  judgement involved"* (`severity-map.md`, `onion-architecture` table). No model
  needed, found in seconds.
- Anything inside the grandfathered baseline is **not reported**
  (`do-not-flag.md`, *Already-decided architecture debt*).
- **Never run `pnpm arch:baseline`.** The baseline is rewritten only ever to
  *remove* entries (`onion-architecture` skill, *Enforcement*). Regenerating it to
  make a violation disappear is the failure this rule exists to prevent — and this
  agent has no write access anyway, which is the point.
- `pnpm arch:all` is allowed, read-only, to show the debt for context.

Judgement comes second and only in the categories the graph cannot see, each with
its own severity already mapped:

| Situation | Severity | Source |
|---|---|---|
| new `pnpm arch` failure | CRITICAL | `severity-map.md` |
| a business rule moved into `routes.ts` with no import to betray it | WARNING | " |
| a service that would need Postgres to unit-test | WARNING | " |
| a ring shape the skill would prefer, no rule broken | SUGGESTION | " |

Why this ordering and not a free-form opinion: *"Code linting is an excellent form
of rules-based feedback"*, and LLM-as-judge *"is generally not a very robust
method"* [6]; and *"'Is this design beautiful?' is hard to answer consistently, but
'does this follow our principles for good design?' gives Claude something concrete
to grade against"* [5].

**Inherited `do-not-flag` entries, restated in the file** so a cold agent has them:
the two `vendor/shared` copies are deliberate (never propose a workspace, `npm
link` or a published dependency — only G1 applies: they must stay identical); four
lockfiles are load-bearing; `server/clones/**` is not source; a missing lesson
feature is not an omission and an empty table is intentional; `// dd-ignore:` with a
stated reason is honoured for the named rule on the next line only.

**A counted drift the file must handle:** the known-violations file holds **21**
entries today (`node -e` over
`server/.dependency-cruiser-known-violations.json`), while `do-not-flag.md`,
`gates.md` and `severity-map.md` all say 25 and the `onion-architecture` skill says
21. The agent **counts the file** and reports the number it counted; it never
quotes a count from prose, and a mismatch with the docs is one line in
`## Noticed, not my call`. Do not "fix" those documents in this change.

### Report template

````markdown
## Verdict
`request_changes` | `comment` | `approve`   — `Verdict`, `contracts/findings.ts:26`
Rule: ≥ 1 surviving CRITICAL → `request_changes`.

## 1 · Machine-checked
| Check | Where | Result |
|---|---|---|
| `pnpm arch` | `server/` | ✅ no new violation |
| grandfathered entries | `.dependency-cruiser-known-violations.json` | 21, counted |
| `pnpm arch:all` (context only) | `server/` | 21 known |

## 2 · Findings
### CRITICAL — <title>
- **Where:** `server/src/modules/x/service.ts:42-47`
- **Rule:** `no-cross-module` (`server/.dependency-cruiser.cjs`) — or, for a
  judgement finding, the `onion-architecture` rule it breaks, named
- **Evidence:**
  ```ts
  <≤6 lines, verbatim from the file>
  ```
- **Why this severity:** `severity-map.md`, `onion-architecture` row: "<quote>"
- **Which ring it belongs in:** <the fix, one sentence>

### WARNING — … (same five fields)

## 3 · Not flagged, and why
| Looked like a finding | Why it is not | Source |
|---|---|---|
| `container.ts ⇄ repo-intel/service.ts` cycle | grandfathered entry | `do-not-flag.md` |
| no test for a new helper | "this function has no test" is not a finding | `do-not-flag.md` |

## 4 · Cannot assess
| What | Why |
|---|---|
| whether the new port needs a second implementation | no second consumer in the diff |

## Counts
CRITICAL n · WARNING n · SUGGESTION n

## Noticed, not my call
- security: <surface> — `security` review owns it
- performance: <mechanism> — `docs/agent-prompts/performance-reviewer.md` owns it
- correctness: <…> — `/code-review` owns it
````

### Hard rules (the file's own list)

Writes nothing — no `Write`, no `Edit`, and no `Bash` write either: no `>`/`>>`/
`tee`, no `sed -i`, no `pnpm arch:baseline`, no commit/checkout/stash, no install.
Does not judge security, performance or correctness. Does not spawn subagents. Does
not review `.claude/**` (*"A lens pointed at a document full of rules finds all of
them, everywhere"* — `do-not-flag.md`). Runs commands **from inside the package
directory**, never the root.

### Chain position

Replaces the *"architecture / security review ← separate agents, not built yet"*
row in the chain diagram — architecture is now built, security is not. Runs after
`implementer` (and after `test-writer`, if tests were part of the work), in parallel
with nothing else that writes, before `/pr-self-review`. It does not duplicate
`/pr-self-review`: that skill routes and gates the whole diff; this agent is the
single lens `pr-self-review` would otherwise run inline, at higher depth and with a
`## Not flagged` section.

---

## Agent 3 — `plan-verifier`

### Frontmatter, exactly as it will be written

```yaml
---
name: plan-verifier
description: "Read-only verification of finished code against the plan it was built from: extracts every item of `specs/<plan>.md` — steps, `Contract`, `Constraints`, `Done when` — plus any requirement stated in the task, and returns one verdict per item (`done` / `partial` / `not implemented` / `contradicted` / `cannot verify`) with a `file:line` citation for each, checking the observable outcome rather than whether the steps were followed in the planned order. Runs the package's own commands as the outcome check. Use after `implementer` and before `/pr-self-review`. Reports gaps only: it is forbidden from substituting general best-practice advice, style opinions or refactoring ideas for a per-item verdict, and it writes nothing."
tools: Read, Glob, Grep, Bash, TodoWrite
model: opus
---
```

No `skills:` list and no `Skill` tool — **deliberate, and the point of the agent.**
A loaded best-practices skill is exactly what turns a per-item verdict into generic
advice; withholding the tool makes the anti-degeneration rule partly mechanical
instead of purely prose. The file states this, so a later editor does not add one as
a favour.

**Tool justification**

| Tool | Present because |
|---|---|
| `Read`, `Glob`, `Grep` | the plan, then the code each item claims to have changed. A `done` verdict needs the file open, not a grep hit |
| `Bash` | `git diff` / `git status` for what is actually open, and the package commands as the outcome check: *"Deterministic graders are natural for coding agents because software is generally straightforward to evaluate: does the code run and do the tests pass?"* [7] |
| `TodoWrite` | **one todo per extracted plan item.** This is the anti-degeneration device made mechanical: an unchecked todo is a missing verdict |

| Notably absent | Why |
|---|---|
| `Write`, `Edit` | it verifies; it does not close a gap. A verifier that fixes has nothing left to verify |
| `Skill` / `skills:` | see above |
| `Agent` | see shared rule 6 |
| `AskUserQuestion` | an ambiguous plan item is graded `cannot verify` with the ambiguity quoted — not a pause |
| `WebSearch`, `WebFetch` | the plan is the contract |

### Read-first table (goes in the file)

| Read | Why |
|---|---|
| the plan at the given path, **whole** | `Goal`, `Not in scope`, `Contract`, `Skill map`, `Constraints`, `Steps`, `Verification`, `Done when`, `Left to reviewers`. Every one of those is a source of items |
| `git status` + `git diff $(git merge-base origin/main HEAD)` + untracked files | what is actually open. Untracked files count (`gates.md`, *What counts as "everything that is open"*) |
| `<pkg>/AGENTS.md` for every package in the plan's `Touches` | the real commands |
| `<pkg>/INSIGHTS.md` for every one | so a known baseline is not graded as a failure |
| `TESTING.md` | which suite a `Done when` line means |
| `.claude/skills/pr-self-review/references/do-not-flag.md` | the deliberate gaps it must not report as missing work |

### Skill map

**None, by construction.** Where a plan item names a skill in its `Skill map`, this
agent verifies the *outcome that skill was supposed to produce* (the file is in the
right folder; the contract is mirrored; the test carries the `.it.test.ts` suffix) —
not the skill's own catalogue of advice. That is the whole distinction the agent
exists to hold.

### The anti-degeneration rule — the sharpest one in this plan

Written in the file as `## The only thing you produce`, before anything else:

> Every item of the plan gets its own row, its own verdict and its own citation.
> You do not get to answer a different question. A report that discusses the code's
> quality instead of the plan's items has failed, whatever it found.

**1 · Item extraction is mechanical and complete.** Enumerate items from *all* of:
each numbered step; each row of `Contract`; each row of `Constraints`; each checkbox
of `Done when`; each command in `Verification`; and each requirement stated in the
task text if one was given. Quote each item verbatim in its row. Number them. State
the total before the table. **An item you did not list is a pass by silence, which
is the failure this agent exists to prevent.**

**2 · The verdict vocabulary is exactly five values. Nothing else is admissible:**

| Verdict | Means | Evidence required |
|---|---|---|
| `done` | the item's observable outcome exists | `file:line` — or a command and its output |
| `partial` | some of it exists | `file:line` for what exists **and** a sentence naming precisely what is missing |
| `not implemented` | it does not exist | the paths and patterns searched, so *not found* is distinguishable from *does not exist* |
| `contradicted` | the code does something the plan says it should not, or the opposite of what it says | `file:line` plus the quoted plan text |
| `cannot verify` | needs Docker, a key, a browser, a running stack, or the item is too vague to grade | which of those, and what would settle it |

**`done` without a citation is not `done` — it is `cannot verify`.** There is no
sixth value, no "probably", no "looks fine", no blank cell.

**3 · Grade the outcome, not the path.** Upstream, verbatim: *"There is a common
instinct to check that agents followed very specific steps like a sequence of tool
calls in the right order. We've found this approach too rigid and results in overly
brittle tests."* [7] So: a step done in a different file, in a different order, or
merged with another step is still `done` if the outcome is there — and the deviation
goes in `## Deviations observed`, not in the verdict. Conversely a step followed to
the letter with no working outcome is not `done`.

**4 · Report gaps, not style preferences.** Upstream states this agent's job almost
word for word: *"Use a subagent to review the rate limiter diff against PLAN.md.
Check that every requirement is implemented, the listed edge cases have tests, and
nothing outside the task's scope changed. **Report gaps, not style preferences.**"*
[3] And the over-reporting warning: a reviewer told to find gaps *"will usually
report some, even when the work is sound"* [3].

**5 · The forbidden output, listed so it cannot be produced by accident.** The file
names these explicitly as *not* sections of the report: general recommendations,
best-practice advice, refactoring ideas, naming opinions, "consider adding…",
performance musings, security musings, architecture verdicts, a coverage plea, or
any finding whose subject is not an item of the plan. If the agent genuinely notices
something outside the plan, it gets **one line** under `## Noticed, not my call`
naming the agent or skill that owns it (`architecture-reviewer`, the security
review, `/code-review`, `test-writer`) — and nothing more. Rationale, upstream:
*"Chasing every finding leads to over-engineering… Tell the reviewer to flag only
gaps that affect correctness or the stated requirements."* [3]

**6 · A separate grader is the reason this exists.** *"A reviewer running in a fresh
subagent context sees only the diff and the criteria you give it, not the reasoning
that produced the change, so it evaluates the result on its own terms."* [3] And:
*"tuning a standalone evaluator to be skeptical turns out to be far more tractable
than making a generator critical of its own work."* [5] The honest limit, worth
carrying: a reviewer *"doesn't have the full context of why a system was designed a
certain way"* (**third party, single source** [8]) — which is precisely why its
rubric is the plan and not its own taste.

**7 · The deliberate gaps are not gaps.** A plan's `Not in scope` line, a starter
feature the lesson table has not reached, an empty table, a `TODO` where a lesson
will land — none of these is `not implemented` (`do-not-flag.md`). Grade only what
the plan claimed.

### Report template

````markdown
## Plan
`specs/L0X-<slug>.md` — **N items** extracted: n steps · n contract rows ·
n constraints · n `Done when` boxes · n verification commands · n task requirements.

## Per-item verdicts
| # | Item, quoted from the plan | Verdict | Evidence | Note |
|---|---|---|---|---|
| 1 | "add `XSchema` to both vendored copies" | `done` | `server/src/vendor/shared/contracts/x.ts:12`, `client/src/vendor/shared/contracts/x.ts:12` — byte-identical | |
| 2 | "the badge hides below 0.65 confidence" | `partial` | `FindingsPanel/helpers.ts:18` | threshold is read but the empty state is not rendered |
| 3 | "a `*.it.test.ts` covers the run lifecycle" | `not implemented` | searched `server/test/**/*.it.test.ts`, grep `run lifecycle`, grep `runId` — no file | |
| 4 | "`pnpm arch` stays green" | `cannot verify` | — | not run: see Outcome checks |
| 5 | "never resolve the model by importing `settings`" | `contradicted` | `server/src/modules/x/service.ts:8` imports `../settings/feature-models.js`; plan quotes `server/INSIGHTS.md:110` | |

Five verdicts exist and no others. Every row carries a citation.

## Outcome checks
| Command | Directory | Result |
|---|---|---|
| `pnpm typecheck` | `server/` | ✅ |
| `pnpm arch` | `server/` | ✅ no new violation |
| `pnpm exec vitest run --exclude '**/*.it.test.ts'` | `server/` | ❌ 6 failed — `indexer-pipeline.test.ts`, baseline |

Verbatim output for every failure. A baseline failure is labelled `baseline`, never
counted against an item.

## Deviations observed
| Item | The plan said | The code does | Outcome still met? |
|---|---|---|---|

## Changed outside the plan
| File | No item asked for it | In the plan's `Not in scope`? |
|---|---|---|

## Summary
done n · partial n · not implemented n · contradicted n · cannot verify n
**Verdict:** complete | incomplete — incomplete if any item is `partial`,
`not implemented` or `contradicted`.

## Noticed, not my call
- <one line, naming the agent or skill that owns it. Or "nothing">
````

### Chain position

Strictly after `implementer` (and after `test-writer`, when the plan's `Done when`
names a suite), strictly before `/pr-self-review`. The two ask different questions
and neither replaces the other:

| | Question | Rubric |
|---|---|---|
| `plan-verifier` | is the plan **done**? | `specs/<plan>.md`, item by item |
| `/pr-self-review` | can this **ship**? | routing, G1–G12, severity, the block rule |

Sequencing stays the **main session's** job. `plan-verifier` never invokes
`/pr-self-review`, and `/pr-self-review` does not call it.

---

## Agent 4 — `doc-writer`

### Frontmatter, exactly as it will be written

```yaml
---
name: doc-writer
description: "Documents a feature that is already implemented: reads the code that shipped, then writes one page into `docs/` or `<pkg>/docs/` according to those directories' own rules, with Mermaid diagrams that render both on GitHub and in the client, and links to code by path instead of pasting it. Use once a feature works and its lasting explanation needs a home — the plan in `specs/` stays the record of intent, and setup instructions stay in the README. Documents what the code does, never what a spec said it would do, never pre-announces unbuilt behaviour, and never restates a README. Writes only `docs/` pages and the index line that points at a new one."
tools: Read, Glob, Grep, Bash, Write, Edit, Skill, TodoWrite
model: sonnet
skills:
  - mermaid-diagram
---
```

Only `mermaid-diagram` is declared. A best-practices skill would pull the agent
toward reviewing the code it is documenting; that is another agent's job.

**Tool justification**

| Tool | Present because |
|---|---|
| `Read`, `Glob`, `Grep` | the page is sourced from the code, so the code must be read |
| `Bash` | `git log`/`git show`/`git diff` to see what actually shipped, and `ls` to confirm the target directory. Read-only |
| `Write`, `Edit` | the page, plus the index line in the owning `docs/README.md`. The *path* limit is prose [1] |
| `Skill` | `mermaid-diagram` for diagram type and syntax |
| `TodoWrite` | a page has sections; a section skipped is a page half-written |

| Notably absent | Why |
|---|---|
| `Agent` | see shared rule 6 |
| `AskUserQuestion` | a question about intent goes in `## Open questions` at the end of the report, not to the user mid-write |
| `WebSearch`, `WebFetch` | an external fact in a doc must come from `researcher`, cited |

### Read-first table (goes in the file)

| Read | Why |
|---|---|
| `docs/README.md` | what cross-package docs hold and refuse, plus the writing rules and the `## Index` it must extend |
| `<pkg>/docs/README.md` for the target package | each one lists its own *candidates to write* and repeats the rules |
| `<pkg>/README.md` | so the page does not restate it. `server/README.md` is *"a map: stack, request/DI flow, API surface, env, testing"* |
| `specs/README.md` | *"Once a spec ships, its lasting explanation moves to `../docs/` and the spec stays as the record of intent"* |
| the root `AGENTS.md`, *Where to write what* | the four-way split, and *"Never restate README content… One fact, one home, links everywhere else"* |
| the shipped code, and the plan **only as a map of where to look** | see the anti-degeneration rule |
| `<pkg>/INSIGHTS.md` | a gotcha belongs there, not in the page |

### The routing rule — which directory, and what each one refuses

| The thing you have | Where it goes | Source |
|---|---|---|
| a durable explanation true across more than one package — an architecture decision, a subsystem deep-dive | `docs/` | root `AGENTS.md`; `docs/README.md` |
| a deep-dive into one package's subsystem | `<pkg>/docs/<topic>.md`, one topic per file, kebab-case | `<pkg>/docs/README.md` |
| a plan for something not built | `<pkg>/specs/` — **not this agent's output** | root `AGENTS.md` |
| a non-obvious fact that cost someone time | `<pkg>/INSIGHTS.md`, via the `engineering-insights` skill — **not this agent's output** | " |
| something a human needs to run the package | `<pkg>/README.md` — **not this agent's output** | " |
| a reviewer system prompt or the model choice | `docs/agent-prompts/` only | root `AGENTS.md` |

What each directory **refuses**, verbatim from `docs/README.md`: *"plans for unbuilt
features… hard-won gotchas… setup instructions."* And from every package's
`docs/README.md`: *"Plans go to `../specs/`, gotchas to `../INSIGHTS.md`."*

The vocabulary for *why* a page lands where it does is **Diátaxis** [14]: a
`<pkg>/docs/` page is **explanation** (*"a discursive treatment of a subject, that
permits reflection… understanding-oriented"*) and/or **reference** (*"technical
descriptions of the machinery and how to operate it… information-oriented"*); a
`README.md` is **how-to** (*"directions that guide the reader through a problem or
towards a result… goal-oriented"*). The anti-mixing rule is why this matters: *"When
these distinctions are allowed to blur, the different kinds of documentation bleed
into each other."* [14] Diátaxis is the reason a page goes where it goes — **it is
not a new directory layout, and this change does not restructure `docs/`.**

Existing pages, as the house style to imitate: `server/docs/pr-list-rollups.md`,
`client/docs/findings-surfaces.md`, `reviewer-core/docs/cost-and-token-accounting.md`,
`e2e/docs/flow-or-component-test.md`.

### Skill map

| Path | Skills | Source |
|---|---|---|
| `docs/**`, `<pkg>/docs/**` | **not routed by `routing.md`** — `*.md` is crosscutting, gates only. `mermaid-diagram` applies as a *generator*, and `routing.md`'s own *Adding a skill to the routing* excludes generators from being lenses: *"A generator (`mermaid-diagram`) or a post-process (`engineering-insights`) is not"* a lens | `routing.md` |
| the code being documented | read-only; do not load its lens. Reviewing it is another agent's job | — |

### Diagram rules

- Mermaid, because *"the client already renders them"* (`docs/README.md`). Concretely
  `mermaid@11.15.0` is present in `client/node_modules`, so a diagram must survive
  **two** renderers: the client's and GitHub's [16].
- GitHub renders Mermaid in Markdown files, issues, PRs and wikis, and pins its own
  version; its caveat, verbatim: *"You may observe errors if you run a third-party
  Mermaid plugin when using Mermaid syntax on GitHub."* The `info` command inside a
  mermaid block reveals which version [16].
- Pick the type from the `mermaid-diagram` skill's decision table. Prefer the
  conservative types — flowchart, sequence, state, class. **ER is marked
  experimental and C4 carries a warning upstream** [15]; the reported Mermaid version
  (12.0.0) and the 30+ type count are **time-sensitive — re-verify at writing
  time** [15].
- Escaping: *"It is possible to put text within quotes in order to render more
  troublesome characters"*, plus numeric entities (`#` as `#35;`) [17].
- Validate before shipping the page. No network here, so the check is: the diagram
  uses only syntax the `mermaid-diagram` skill documents, every arrow connects to a
  declared node id, and no node label carries an unquoted `(`, `#`, `:` or `"`. Say
  in the report that the check was static — do **not** claim it was rendered.

### The anti-degeneration rule

**1 · Document what the code does, not what a spec said it would do.** The plan is
a map of *where to look*, never a source of claims. Every statement in the page must
be traceable to a file the agent read; the report carries a
claim → `file:line` table proving it. Upstream support is partial and must not be
overstated: Google's handbook says *"Don't pre-announce anything in documentation"*
[19], and docs-as-code practice ties documentation to the merge of the feature [18] —
but **neither source says "source the docs from the diff, not the spec" in those
words; that framing is this repo's own rule**, derived from those two plus the
repo's `specs/` vs `docs/` split [20].

**2 · Never restate a README, and never paste code.** *"Never restate README content
inside a AGENTS.md. One fact, one home, links everywhere else"* (root `AGENTS.md`);
*"Link to code as `path/to/file.ts` rather than pasting it — pasted code goes stale,
paths do not"* (`docs/README.md`). Before writing a section, read the package README
and say in the report which section it deliberately did not repeat. (No upstream
guidance on documentation-agent failure modes was found [21], so these are this
repo's own rules — which is stronger here anyway, because both are already written
down.)

**3 · One topic per file, an H1, a one-sentence summary, kebab-case name**
(`docs/README.md`). A second topic is a second page.

**4 · A gotcha is not documentation.** It goes to `INSIGHTS.md` via
`engineering-insights`, which this agent does not invoke — it names the gotcha in
`## Belongs elsewhere` and moves on.

**5 · If the code does not do what the plan promised, the page documents the code
and the report says so.** It does not paper over the gap and it does not fix the
code. That divergence is `plan-verifier`'s finding; here it is one line in
`## Belongs elsewhere`.

### Report template

````markdown
## Page written
`server/docs/<topic>.md` — new · 1 topic · H1 + one-sentence summary present

## Why here, not there
| Rule | Quote / source | How it decided |
|---|---|---|
| cross-package vs package-local | `docs/README.md`: "anything true across more than one package" | only `server/` — so `server/docs/` |
| Diátaxis mode | explanation + reference | not how-to, so not the README |
| what this directory refuses | `server/docs/README.md`: "Plans go to `../specs/`, gotchas to `../INSIGHTS.md`" | 1 gotcha moved out — see Belongs elsewhere |

## Sourced from the code
| Claim in the page | Where it came from |
|---|---|
| "the reaper awaits in-flight runs before listening" | `server/src/app.ts:75` |

Every claim has a row. A claim taken from the plan rather than the code is not
written at all.

## Deliberately not repeated
| Already documented in | What |
|---|---|
| `server/README.md` | the env table, the API surface list |

## Diagrams
| # | Type | Why this type | Checked |
|---|---|---|---|
| 1 | `sequenceDiagram` | request → service → adapter over time | static check only — syntax, node ids, escaping. Not rendered here |

## Index updated
`server/docs/README.md` — one line added pointing at the new page.

## Belongs elsewhere
| What | Where it goes | Who does it |
|---|---|---|
| "`db:migrate` exits 0 without touching the DB on Windows" | `INSIGHTS.md` | `engineering-insights`, parent session |
| the plan's step 4 is not in the code | the verification report | `plan-verifier` |

## Open questions
<intent the code could not settle. "none" if none>
````

### Hard rules (the file's own list)

Writes **only** `docs/README.md` index lines and `docs/**` / `<pkg>/docs/**` pages.
Never `src/`, never a test, never `specs/`, never an `INSIGHTS.md`, never a
`README.md` outside `docs/`, never `.claude/**`, never a lockfile. No commit, push,
checkout, stash or install. Does not spawn subagents. Does not document an unbuilt
feature — if the code is not there, it says so and writes nothing.

### Chain position

Last of the four, and after the code works: `implementer` → `test-writer` →
`plan-verifier` / `architecture-reviewer` → `doc-writer` → `/pr-self-review`. A page
written before the tests pass documents a guess. G7 (a new feature with no `specs/`
entry) is a `pr-self-review` SUGGESTION and is not this agent's problem — `specs/`
is the planner's directory.

---

## Edits to `.claude/agents/README.md`

Five existing structures grow; nothing is rewritten.

### 1. The roster

Add four rows, in chain order, after `implementer`:

| Agent | Model | Writes | Reach for it when |
|---|---|---|---|
| `test-writer` | `opus` | test files only | a change needs tests, or a plan's `Done when` names a suite |
| `plan-verifier` | `opus` | nothing | code is finished and the question is whether the plan is actually done |
| `architecture-reviewer` | `opus` | nothing | the change leans on a boundary — a ring, an import direction, a module reaching sideways |
| `doc-writer` | `sonnet` | `docs/**` only | a feature works and its lasting explanation needs a home |

### 2. The chain

Replace the current block. The *"separate agents, not built yet"* line goes away for
architecture and stays for security:

```
researcher            →  facts, quotes, "could not establish"
     ↓
planner               →  specs/L<NN>-<slug>.md          ← the contract
     ↓
implementer           →  code + test results
     ↓
test-writer           →  tests + verbatim command output vs baseline
     ↓
plan-verifier         →  one verdict per plan item, with citations
architecture-reviewer →  boundary findings, CRITICAL/WARNING/SUGGESTION
security review                                ← still a separate agent, not built yet
     ↓
doc-writer            →  docs/ page for what actually shipped
     ↓
/pr-self-review                                ← the pre-PR gate (a skill)
```

Keep the paragraph under it and extend it: sequencing is the **main session's** job;
**none of the seven** spawns a subagent of its own, and none commits, pushes or
opens a PR. Add the two distinctions a reader will otherwise guess at:
`plan-verifier` asks *is the plan done* while `/pr-self-review` asks *can this
ship*; `architecture-reviewer` is one lens in depth, `/pr-self-review` is the router
and the gate over the whole diff.

### 3. Artifacts in and out

Four rows:

| Agent | Takes | Produces | Where it lands |
|---|---|---|---|
| `test-writer` | the code under test, plus a plan's `Done when` when there is one | test files, plus a report: files written, the behaviour each pins down, what must break for each to fail, verbatim command output, baseline comparison, what it deliberately did not test | **the working tree**, uncommitted |
| `plan-verifier` | a path to a plan in `specs/`, plus the working tree | one verdict per extracted item from a five-value vocabulary, each with a `file:line`; outcome-check command output; deviations; out-of-scope changes | the hand-back report only |
| `architecture-reviewer` | the open change | `pnpm arch` result and the counted baseline, then findings with `file:line`, rule name and severity, plus `Not flagged` and `Cannot assess` | the hand-back report only |
| `doc-writer` | a shipped feature, and the code that implements it | one `docs/` page, plus a report naming the path, the section rule that put it there, a claim → `file:line` table, and what belongs elsewhere | **a file** in `docs/` or `<pkg>/docs/`, plus the index line |

### 4. Permissions at a glance

| Agent | `tools` | Notably absent | Why |
|---|---|---|---|
| `test-writer` | `Read, Write, Edit, Glob, Grep, Bash, Skill, TodoWrite` | `Agent`, `AskUserQuestion`, `WebSearch`/`WebFetch` | writes tests, runs them, reports the output. `Write`/`Edit` are confined to test files by prose |
| `plan-verifier` | `Read, Glob, Grep, Bash, TodoWrite` | `Write`, `Edit`, `Skill`, `skills:`, `Agent`, `AskUserQuestion` | read-only by construction; **no skill list on purpose** — a loaded best-practices skill is how a per-item verdict degenerates into generic advice |
| `architecture-reviewer` | `Read, Glob, Grep, Bash, Skill, TodoWrite` | `Write`, `Edit`, `Agent`, `AskUserQuestion` | read-only; `Bash` runs `pnpm arch` and reads git. Never `arch:baseline` |
| `doc-writer` | `Read, Glob, Grep, Bash, Write, Edit, Skill, TodoWrite` | `Agent`, `AskUserQuestion`, `WebSearch`/`WebFetch` | `Write`/`Edit` confined to `docs/**` by prose |

Extend the paragraph after the table: three of the four declare a `skills:` list;
`plan-verifier` deliberately declares none, and that absence is itself a rule.

Extend *Path and command limits are prose, not config* with the new cases —
`test-writer` → test files only, `doc-writer` → `docs/**` only, both reviewers →
nothing — and keep the existing conclusion: `settings.json` stays untouched, and
`hooks:` plus a guard script is the lever if machine enforcement is ever wanted.

### 5. Sourcing tables

Add to **Anthropic documentation**:

| Rule it produced | Source |
|---|---|
| omitting `Agent` from `tools:` is the documented way to stop a subagent spawning helpers | [sub-agents](https://code.claude.com/docs/en/sub-agents) |
| `tools:` cannot be scoped to a path; a specifier in `disallowedTools` removes the whole tool → the write-path limits are prose, and `permissions.deny` is rejected because it would bind the main session too | " |
| `claude plugin validate .claude/agents` is the only pre-session check — an invalid file is skipped silently (requires Claude Code ≥ v2.1.233) | " |
| combined agent `description`s over 15,000 tokens warn at startup → the budget check in this plan's `Verification` | " |
| a read-only reviewer's tool set is `Read, Glob, Grep` (+ `Bash`) — the docs' own worked examples omit `Edit`/`Write` | [best-practices](https://code.claude.com/docs/en/best-practices) |
| "Report gaps, not style preferences", and "review the diff against PLAN.md… every requirement implemented" → `plan-verifier`'s whole remit | " |
| "Always provide verification… If you can't verify it, don't ship it" and "show evidence rather than asserting success" → `test-writer` runs what it writes and pastes the output | " |
| a reviewer told to find gaps will report some even when the work is sound → the `Not flagged` / `Noticed, not my call` sections | " |
| a fresh subagent "evaluates the result on its own terms" → why verification is a separate agent | " |
| a standalone skeptical evaluator beats self-review; grade against stated principles, not beauty | [harness design](https://www.anthropic.com/engineering/harness-design-long-running-apps) |
| rules-based feedback first, LLM-as-judge last → `architecture-reviewer` runs `pnpm arch` before any judgement | [building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) |
| grade outcomes, not the sequence of steps; deterministic graders for coding agents → `plan-verifier` checks outcomes and runs the suites | [demystifying evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) |
| a `file:line` verification bar cuts false positives | [code review](https://code.claude.com/docs/en/code-review) |

Add to **This repo**:

| Rule it produced | Source |
|---|---|
| the severity vocabulary and the per-lens mapping are cited, never invented | `contracts/findings.ts:11`, `severity-map.md`, `general-reviewer.md:53-73` |
| a new `pnpm arch` failure is CRITICAL and machine-verified; a grandfathered entry is not a finding | `severity-map.md`, `do-not-flag.md` |
| the known-violations file must be **counted** — it holds 21 entries while three reference files say 25 | `server/.dependency-cruiser-known-violations.json` |
| `routing.md` routes no `server/test/**` or `reviewer-core/test/**` path → `test-writer` picks from the reconciled skill list and says which | `routing.md`, `scripts/lib/routing.mjs:32,41,56` |
| a generator is not a lens → `mermaid-diagram` is never routed | `routing.md`, *Adding a skill to the routing* |
| the integration suite silently skips itself; counts, not exit codes | `server/INSIGHTS.md:72`, `:265` |
| `pnpm typecheck` does not cover `server/test/` | `server/INSIGHTS.md:128` |
| a DB test is `*.it.test.ts` | `server/INSIGHTS.md:91` |
| `fireEvent`, not `userEvent`; `findByRole` hides a duplicate accessible name; a new `common` namespace breaks colocated tests silently while staying green | `client/INSIGHTS.md:175`, `:44`, `:117` |
| a test's own rubric: what would have to change in production for it to fail | `docs/agent-prompts/test-quality-reviewer.md` |
| where a doc page goes, and what each `docs/` directory refuses | `docs/README.md`, `<pkg>/docs/README.md`, root `AGENTS.md` *Where to write what* |
| a spec stays the record of intent once it ships | `specs/README.md` |
| server tests live in `server/test/`, reviewer-core's in `test/`, client tests are colocated — not uniform | `server/AGENTS.md`, `reviewer-core/AGENTS.md`, `client/AGENTS.md` |

### 6. *Adding an agent*

The 7-step checklist needs no change — this plan follows it. Add one sentence to
step 6 recording the version floor (`claude plugin validate` needs Claude Code
≥ v2.1.233; the local CLI is 2.1.283) and one to step 7 pointing at the artifacts
and permissions tables, which also grow per agent.

---

## Other repo edits

### `AGENTS.md` — the `## Agents` section

It currently lists three agents as prose lines. Add four in the same voice, keeping
the trigger-first shape:

- tests are missing or a suite was promised → `test-writer`, which writes them, runs
  them and pastes the output;
- code is finished and the plan needs checking item by item → `plan-verifier`, which
  returns a verdict per item and writes nothing;
- the change leans on a boundary → `architecture-reviewer`, which runs `pnpm arch`
  first and writes nothing;
- a shipped feature needs its lasting explanation → `doc-writer`, which writes one
  page into `docs/`.

Keep the existing sentence that state passes between agents through **files**.

### `.claude/skills/README.md` — the `## Agents` paragraph

One sentence currently says `planner` and `implementer` declare a `skills:` list and
both derive routing from `routing.md`. Extend it: seven agents now; `test-writer`,
`architecture-reviewer` and `doc-writer` also declare `skills:`; `plan-verifier`
declares none on purpose. **This file already has uncommitted changes** — read it
before editing and do not revert them.

### Explicitly untouched

So nobody goes looking:

| Not touched | Why |
|---|---|
| `@devdigest/shared` and both vendored copies | no contract, no Zod schema, no type crosses a package. The double-vendoring rule does not apply to this change at all |
| all four lockfiles (`server/pnpm-lock.yaml`, `client/pnpm-lock.yaml`, `reviewer-core/package-lock.json`, `e2e/package-lock.json`) | no dependency is added. A lockfile changes only in a commit whose subject is that dependency change |
| `.claude/settings.json` | a `permissions.deny` rule would bind the main session too |
| `.claude/skills/**` — including `routing.md`, `routing.mjs`, `severity-map.md`, `do-not-flag.md`, `gates.md`, `gates.mjs` | no new lens is added; the new agents *consume* those tables. Adding a `server/test/**` row would be its own change (prose row + `routing.mjs` rule + severity mapping + eval case) |
| `docs/agent-prompts/**` | the built-in product prompts are unrelated to subagents; `test-quality-reviewer.md` is read, not edited |
| every file under `server/`, `client/`, `reviewer-core/`, `e2e/` | repo tooling only |
| the `25` vs `21` count in `do-not-flag.md` / `gates.md` / `severity-map.md` | a real drift, recorded in `## Open questions`, fixed in its own commit |

---

## Steps

Each step is one reviewable unit and one commit.

1. **`.claude/agents/test-writer.md`** · skill: none (agent authoring) — write the
   file: frontmatter exactly as specified above, `# Test Writer`, `## Hard rules`
   (write-scope, no production code, no commit/push/checkout/lockfile, no `Agent`,
   no `e2e/`), `## What you must read first`, `## Where a test file goes` (the
   three-package table), `## Which skill for which file` (the skill map, including
   the `server/test/**` gap stated out loud), `## Constraints` (the INSIGHTS table),
   `## Verify, always` (the per-package command table from `implementer`, plus the
   integration passed/skipped rule), `## Never do this to get green` (the three
   anti-degeneration sentences), `## Output` (the report template verbatim).
2. **`.claude/agents/architecture-reviewer.md`** · skill: `onion-architecture` for
   the ring vocabulary it must use — frontmatter, `## Hard rules` (read-only, never
   `arch:baseline`, no security/perf/correctness verdict, no `Agent`),
   `## What you must read first`, `## Procedure` with **step 1 = `pnpm arch`** and
   judgement strictly after it, `## Severity` (cited, not copied),
   `## Do not flag` (the inherited list, restated), the counted-baseline rule,
   `## Output`.
3. **`.claude/agents/plan-verifier.md`** · skill: none — frontmatter (no `skills:`,
   no `Skill`), `## The only thing you produce` first, then `## Item extraction`,
   `## The five verdicts` table, `## Grade the outcome, not the path`,
   `## Forbidden output` (the explicit list), `## What you must read first`,
   `## Outcome checks` (the per-package commands + the baseline rule),
   `## Output`.
4. **`.claude/agents/doc-writer.md`** · skill: `mermaid-diagram` — frontmatter,
   `## Hard rules` (write scope `docs/**` + the index line, nothing else; no
   commit; no `Agent`), `## What you must read first`, `## Which directory`
   (the routing table + what each refuses + the Diátaxis vocabulary),
   `## Diagrams` (two renderers, conservative types, escaping, static check only),
   `## Document the code, not the spec`, `## Output`.
5. **`.claude/agents/README.md`** — the five edits in
   [`## Edits to .claude/agents/README.md`](#edits-to-claudeagentsreadmemd): roster
   rows, chain diagram, artifacts table, permissions table + the two prose
   paragraphs, both sourcing tables, and the two sentences on the *Adding an agent*
   checklist.
6. **`AGENTS.md`** — four prose lines under `## Agents`.
7. **`.claude/skills/README.md`** — the `## Agents` paragraph. Read the file first;
   it has uncommitted changes.
8. **Verify** — everything in [`## Verification`](#verification), including one real
   smoke invocation per agent.

Order matters only in that step 5 must not precede steps 1–4: a roster row pointing
at a file that does not exist is worse than no row.

---

## Verification

No package source changes, so **no package test suite applies** — `pnpm typecheck`,
`pnpm arch` and the five suites are all no-ops for this diff. The checks that do
apply:

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | every agent file parses and is not silently skipped | `claude plugin validate .claude/agents` | 7 agents valid, 0 errors |
| 2 | `name` matches the filename, in all seven | `node -e` over the frontmatter | 7/7 |
| 3 | combined `description` budget | the script below | well under 15,000 tokens |
| 4 | every declared skill exists | the script below | no missing directory |
| 5 | no `Agent` in any `tools:` line | `grep -n "^tools:" .claude/agents/*.md` | no `Agent`, all seven enumerate |
| 6 | the roster has a row per file and no orphan row | read `README.md` against `ls .claude/agents/*.md` | 7 = 7 |
| 7 | smoke: each new agent once, on a real small task | see below | the report has every section of its template |
| 8 | nothing outside the seven planned files changed | `git status --short` | only those paths |

### 1 — `claude plugin validate`

```sh
claude plugin validate .claude/agents
```

Requires Claude Code **≥ v2.1.233** [1]; the CLI on this machine is **2.1.283**
(`claude --version`), so it is available. This is the only pre-session check that
exists, because *"Claude Code skips a file without reporting it in the session when:
No `name`… Name but no `description`: skipped with reason logged to debug log… YAML
that doesn't parse: skipped with parse error logged to debug log."* [1] **A file that
is silently skipped looks exactly like an agent nobody called.**

### 3 — the description budget, concretely

The rule: *"When the combined descriptions of your subagents, except the built-in
ones, exceed 15,000 tokens, Claude Code shows a warning at startup with the total
token count."* [1] The warning is the authoritative signal, but it only fires **past**
the limit — so measure before. Run from the repo root:

```sh
node -e "
const fs=require('fs');
let total=0;
for (const f of fs.readdirSync('.claude/agents').filter(f=>f.endsWith('.md')&&f!=='README.md')) {
  const m=fs.readFileSync('.claude/agents/'+f,'utf8').match(/^description:\s*\"([\s\S]*?)\"\s*\$/m);
  const d=m?m[1]:'';
  if(!d) console.log('!! no parsable description:',f);
  console.log(f,'chars='+d.length,'~tokens='+Math.ceil(d.length/4));
  total+=d.length;
}
console.log('TOTAL chars='+total,'~tokens='+Math.ceil(total/4),'budget=15000');
"
```

**Measured baseline, today, three agents:** `implementer` 648 chars, `planner` 584,
`researcher` 593 — **1,825 chars ≈ 457 tokens**. The four descriptions above are
~600–750 chars each, so seven agents land at roughly **4,600 chars ≈ 1,150 tokens** —
about 8% of the budget. `chars/4` is an **estimate, not a tokenizer**: it is the
early-warning number, and the startup warning remains the authority. A run of the
script that prints `!! no parsable description` for a file is also check 1 failing,
since a description-less file is skipped silently.

### 4 — declared skills exist

```sh
node -e "
const fs=require('fs');
const have=new Set(fs.readdirSync('.claude/skills',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name));
for (const f of fs.readdirSync('.claude/agents').filter(f=>f.endsWith('.md')&&f!=='README.md')) {
  const t=fs.readFileSync('.claude/agents/'+f,'utf8');
  for (const m of t.matchAll(/^\s+-\s+([a-z0-9-]+)\s*\$/gm)) if(!have.has(m[1])) console.log('MISSING',f,m[1]);
}
console.log('done');
"
```

Catches a typo and catches `perf-prompt` being declared as if it were a skill. The
thirteen real skill directories are listed in `.claude/skills/README.md`.

### 7 — the smoke runs

Rules-based checks prove the files load; they do not prove the agents behave.
*"Give Claude a check it can run"* [9]. One cheap invocation each, and the pass
criterion is the **shape** of the report, not its conclusion:

| Agent | Smoke task | Passes when |
|---|---|---|
| `architecture-reviewer` | review this very change (`.claude/**` + `*.md` only) | it reports that `pnpm arch` has nothing to say because no `server/src` file changed, and does **not** lens the tooling — `do-not-flag.md`'s last section |
| `plan-verifier` | verify this plan against the tree after step 7 | 8 steps extracted, one verdict per step, every row cited, no advice section |
| `test-writer` | none — nothing to test in this diff. Run it on the first real code change instead, and note that in the commit | deferred, deliberately |
| `doc-writer` | none — nothing shipped in this diff. Same | deferred, deliberately |

Deferring two smoke runs is a real gap, recorded in `## Open questions`, not papered
over: this diff has no product code, so `test-writer` and `doc-writer` have no
honest target inside it. Fabricating one would mean writing a throwaway test or a
throwaway page, which both agents' own rules forbid.

### `/pr-self-review` on this diff

Every changed path is `*.md` under `.claude/` or the root, so `routing.md` puts them
in **crosscutting with no lens** — *"never lens the reviewer itself"* for
`.claude/skills/**`, and `\.(md|ya?ml|json)$` for the rest. So this change gets
**gates only**, which is correct. Expected: G1 n/a (no `vendor/shared`), G2 n/a (no
lockfile), G3 pass (not on `main`), G4 pass (no secrets), G8/G9 n/a, G12 n/a.
Watch the **CRLF gate**: `INSIGHTS.md` and `AGENTS.md` have been bitten before —
count `\r\n` vs bare `\n` in each file before editing and match what you find
(`INSIGHTS.md`, *Recurring Errors & Fixes*, 2026-09-16), then confirm with
`git diff --numstat` that the line count moved by roughly what was added. A
whole-file diff means the line endings flipped.

---

## Done when

- [ ] four new files exist in `.claude/agents/`, each with `name` matching its
      filename, an enumerated `tools:` with no `Agent`, a `model:`, and a
      `description` written for the caller
- [ ] `claude plugin validate .claude/agents` reports 7 valid agents, 0 errors
- [ ] the budget script prints a `~tokens` total well under 15,000 and no
      `!! no parsable description`
- [ ] every `skills:` entry resolves to a directory under `.claude/skills/`
- [ ] each file carries all five required parts: a read-first table, a skill map,
      `## Hard rules` with its write scope, its anti-degeneration rule, and a fixed
      output template
- [ ] `.claude/agents/README.md` roster, chain, artifacts and permissions name all
      seven agents, **both** sourcing tables carry every row listed in
      [§5](#5-sourcing-tables) (they map rules to sources, not agents), and the new
      Anthropic rows carry the briefing's URLs
- [ ] `AGENTS.md` and `.claude/skills/README.md` mention all seven
- [ ] `git status --short` shows only the seven planned paths — no lockfile, no
      `vendor/shared`, no `.claude/settings.json`, no `.claude/skills/pr-self-review/**`
- [ ] the two smoke runs that can be done here (`architecture-reviewer`,
      `plan-verifier`) each returned a report with every section of its template

---

## Left to reviewers

- **architecture** (`architecture-reviewer`, once it exists — or the main session
  for this change): whether `plan-verifier` withholding `Skill`/`skills:` is a real
  guard or an inconvenience that a future editor will quietly undo; whether
  `architecture-reviewer` and `/pr-self-review` overlap enough that one of them
  should shrink; whether four new agents split one job into four or genuinely
  separate four concerns.
- **security**: the only surface here is `Bash` in four agents with no
  `permissions.deny` behind them — the reviewers can run any command the session
  can, and the prose limits are not enforced. The briefing is explicit that this
  cannot be tightened in frontmatter [1]; the reviewable question is whether a
  `hooks:` guard is now worth writing, and whether allowing `plan-verifier` to run
  package commands (`pnpm test` executes repo code) widens anything that matters in
  a local-first repo.
- **documentation**: whether `.claude/agents/README.md` is still the right size for
  seven agents, or whether the sourcing tables should move to their own file.

---

## Not in scope

- Any file under `server/`, `client/`, `reviewer-core/`, `e2e/`.
- A **security-reviewer** agent. The chain keeps its *"not built yet"* marker; the
  `security` skill is written for React + Express + Mongo and needs
  `docs/agent-prompts/security-reviewer.md` alongside it, which is its own design
  problem.
- Any change to `routing.md` / `routing.mjs` / `severity-map.md` / `do-not-flag.md`
  / `gates.md` — including the missing `server/test/**` row and the `21` vs `25`
  drift. Both are recorded as open questions.
- `hooks:` blocks or `permissions.deny` for machine enforcement.
- Restructuring `docs/` onto Diátaxis directories. Diátaxis is borrowed as
  vocabulary only.
- `e2e/` flow authoring.
- Changing the existing three agent files.
- Committing, pushing or opening a PR. That is the main session's job, after
  `/pr-self-review`.

---

## Open questions

| # | Question | The call made here | Blocks | Needs |
|---|---|---|---|---|
| 1 | `routing.md` routes no `server/test/**` or `reviewer-core/test/**` path, so a server test file is unrouted by the gate. Should a row be added? | Not here. `test-writer` states the gap and picks from the reconciled skill list. A row needs prose + `routing.mjs` + severity mapping + an eval case | nothing in this plan | a decision from the repo owner; then its own change |
| 2 | The known-violations file holds **21** entries; `do-not-flag.md`, `gates.md` and `severity-map.md` all say **25**, while the `onion-architecture` skill says 21 | `architecture-reviewer` **counts the file** and never quotes a prose count. The three documents are not edited here | nothing | one commit whose subject is that correction |
| 3 | Should the four new agents carry a `hooks:` guard so the write-path limits are enforced rather than trusted? | No — consistent with the existing three, and a guard script is a separate piece of work with its own test problem (`INSIGHTS.md`, *What Works*, 2026-09-19: a command-text hook cannot be tested from a Bash command) | nothing | a decision; then a script plus its scratchpad test |
| 4 | `test-writer` and `doc-writer` get no smoke run in this change, because there is no product code and nothing shipped | Deferred, and recorded rather than faked. Run each on the next real change and note the result | nothing | the next feature branch |
| 5 | Is `sonnet` enough for `doc-writer`, given it must read a subsystem and produce a correct diagram? | `sonnet`, matching `researcher`. `model:` is one line to change if the first real page comes back thin | nothing | one real page |
| 6 | Should `plan-verifier` also run when there is **no** plan file — grading against a task restated in prose? | Yes, but as a degraded mode: it extracts items from the task text, says in the report that the source was prose and not a file, and still refuses to give advice instead of verdicts. State this in the file | step 3 | — |
| 7 | Is `fable` a currently-shipping `model` alias? | Not used. The briefing marks it medium-confidence and uncorroborated [1] | nothing | `researcher`, or a local check |
| 8 | Do the existing three agents need a `## Not flagged` / `Noticed, not my call` convention too, for consistency? | Out of scope. `implementer` already has `Left to reviewers`, which is the same idea | nothing | — |

---

## Sources

Every external claim in this plan comes from the research briefing at
`<scratchpad>/research-briefing.md`, compiled 2026-09-27 from two `researcher` runs.
No page was fetched while writing this plan — `planner` has no `WebSearch`/
`WebFetch` by design. Markers below are carried from the briefing verbatim and
**must not be upgraded**.

### Official documentation

| # | What it supports | URL | Marker |
|---|---|---|---|
| 1 | frontmatter fields (required `name` + `description`; optional `tools`, `disallowedTools`, `model`, `skills`, `hooks`, `permissionMode`, …); `model` aliases; **tools cannot be scoped to a path**, and a specifier in `disallowedTools` removes the whole tool; silent-skip behaviour and `claude plugin validate` (needs ≥ v2.1.233); the 15,000-token combined-description warning | https://code.claude.com/docs/en/sub-agents | high confidence on field names and the required/optional split; **medium** on per-field wording (the briefing's fetch summarised). `fable` as an alias: **medium confidence, uncorroborated — not used in this plan**. Rolling page, retrieved 2026-09-27; **no publish date establishable** |
| 2 | nesting depth (3 layers by default, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), and that omitting `Agent` from `tools` — or listing it in `disallowedTools` — is the documented way to stop a subagent spawning helpers | https://code.claude.com/docs/en/sub-agents | same page. A community claim of "5 layers / v2.1.172" is **unverified and not cited** |
| 3 | the trust-then-verify gap and *"If you can't verify it, don't ship it"*; a fresh subagent *"evaluates the result on its own terms"*; *"review the rate limiter diff against PLAN.md… **Report gaps, not style preferences**"*; the worked tool sets `Read, Grep, Glob, Bash` and `Read, Glob, Grep`, both omitting `Edit`/`Write`; the over-reporting warning | https://code.claude.com/docs/en/best-practices | rolling page, retrieved 2026-09-27 |
| 4 | the `file:line` verification bar (*"behaviour claims need a `file:line` citation in the source, not an inference from naming"*); the shipped severities Important / Nit / Pre-existing | https://code.claude.com/docs/en/code-review | **medium confidence on transfer** — that machinery is native to the hosted product, not a frontmatter feature; a hand-written agent restates the convention in its body |
| 10 | Testing Library guiding principles and the query priority order — `getByRole` first, `getByTestId` last, *"only recommended for cases where you can't match by role or text"* | https://testing-library.com/docs/guiding-principles/ · https://testing-library.com/docs/queries/about/ | project docs, high confidence |
| 14 | Diátaxis — the four modes and the anti-mixing rule | https://diataxis.fr · https://diataxis.fr/map/ | primary, high confidence. The mapping onto this repo's `docs/` / `README.md` / `specs/` / `INSIGHTS.md` is **this plan's synthesis**, not Diátaxis's |
| 15 | Mermaid diagram types; **ER marked experimental**, **C4 carries a warning** | https://mermaid.js.org/intro/ | version reported as 12.0.0 and the 30+ type count are **time-sensitive — re-verify at writing time** |
| 16 | GitHub renders Mermaid in Markdown, issues, PRs, wikis; *"You may observe errors if you run a third-party Mermaid plugin"*; GitHub pins its own version, visible via the `info` command | https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams | official |
| 17 | Mermaid escaping — quoted text, numeric entities (`#` as `#35;`) | https://mermaid.js.org/syntax/flowchart.html | official |
| 19 | *"Don't pre-announce anything in documentation."* | https://developers.google.com/style/highlights | a style handbook, **not a standard** |
| 22 | Fastify's own testing docs: `inject()` via light-my-request boots every plugin; *"highly recommended to call `.close()`"*. **The absence is the finding** — Fastify prescribes no unit/integration split and says nothing about databases, so this repo's `*.it.test.ts` + testcontainers split is a **local** convention, not upstream guidance | https://fastify.dev/docs/latest/Guides/Testing/ | official, v5.x tree |

### Anthropic engineering blog

| # | What it supports | URL | Marker |
|---|---|---|---|
| 5 | *"separating the agent doing the work from the agent judging it proves to be a strong lever"*; a skeptical standalone evaluator is more tractable than a self-critical generator; grade against stated principles rather than *"is this design beautiful?"* | https://www.anthropic.com/engineering/harness-design-long-running-apps | — |
| 6 | rules-based feedback is the best form; *"Code linting is an excellent form of rules-based feedback"*; LLM-as-judge *"is generally not a very robust method"* | https://claude.com/blog/building-agents-with-the-claude-agent-sdk | the label *"verify hierarchy"* is a **community paraphrase, not an Anthropic term**; the ordering is the article's own |
| 7 | *"There is a common instinct to check that agents followed very specific steps… too rigid and results in overly brittle tests"*; *"Deterministic graders are natural for coding agents… does the code run and do the tests pass?"* | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | — |

### Third party

| # | What it supports | URL | Marker |
|---|---|---|---|
| 8 | AI-review failure modes at scale — *"a flood of vague suggestions, hallucinated syntax errors, and helpful advice to 'consider adding error handling' on functions that already had it"*; the fix was specialised agents plus an explicit "What NOT to Flag" list; and the honest limit that reviewers *"don't have the full context of why a system was designed a certain way"* | https://blog.cloudflare.com/ai-code-review/ | **third party, single source**, 2026-04-20. A second reputable source was **not found** |
| 11 | the assertion-weakening / test-special-casing failure mode, and the directives *"Report exactly what you observe"* and *"Do not mark a scenario as passed if not all assertions have been explicitly verified"* | https://www.codecentric.de/en/knowledge-hub/blog/dont-let-your-ai-cheat-isolated-specification-testing-with-claude-code | **single blog, low confidence — adopted as a repo rule, never cited as upstream policy** |
| 13 | agentic **under**-testing: test changes in only 49.6% of PRs touching test files; coverage improved in 35.9% (Java) / 22.5% (Python); *"64.8% of PRs have no changed line executed by any existing test"* | https://arxiv.org/abs/2607.18057 | **preprint, not peer-reviewed; medium confidence; descriptive, not prescriptive** |
| 18 | docs-as-code — documentation written with the same tools as code; teams *"block merging of new features if they don't include documentation"* | https://www.writethedocs.org/guide/docs-as-code/ | **community handbook, not a standard** |
| 9 | *"Give Claude a check it can run: tests, a build, a screenshot to compare"*; *"Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned"* | https://code.claude.com/docs/en/best-practices | official (listed here only to keep the numbering of the briefing) |

### Explicitly not sourced — the briefing's *could not establish*

Carried forward so no reader mistakes these for cited claims:

| # | The gap |
|---|---|
| 12 | No Anthropic statement telling a model not to write implementation code while writing tests. `test-writer`'s division of labour is a **repo rule**. |
| 20 | Neither Write the Docs nor Google says *"source the docs from the diff, not the spec"*. `doc-writer`'s rule is a **repo rule**, derived from [19] plus the `specs/` vs `docs/` split. |
| 21 | No upstream guidance on documentation-agent failure modes (hallucinated APIs, restating code, duplicating the README). `doc-writer`'s anti-patterns come from `docs/README.md` and the root `AGENTS.md`. |
| — | "TDD as Anthropic doctrine" is **not confirmed** (secondary source, seen in search only). Not used anywhere in this plan. |
| — | Whether *"return findings not fixes"* and *"rubric-driven evaluation"* exist as **named** upstream methodologies. The concepts are cited; the labels are not used. |
| — | Any authoritative "N tests per change" threshold. None is expected to exist; `test-writer` is bound to `TESTING.md` instead. |
| — | The exact current Mermaid version, the diagram-type count, and whether GitHub's pinned Mermaid lags upstream. |
| — | Publish dates for the rolling Claude Code docs pages. |
