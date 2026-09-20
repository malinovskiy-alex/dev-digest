---
name: pr-self-review
version: 1.0.0
description: "Local self-review of everything that is open, run before a pull request is opened. Routes the changed files to the review skills that actually apply to them — UI skills on UI files, backend architecture skills on backend files — runs the deterministic AGENTS.md gates, and returns one verdict in the product's own vocabulary: one CRITICAL finding and the PR is blocked. Use whenever a PR is about to be opened (`gh pr create`, 'open a PR', 'push this up'), when asked to check the working tree before pushing, when asked 'can this be merged?' or 'review my changes', and whenever the PreToolUse guard refuses `gh pr create`. Also invoked directly as /pr-self-review. Not a bug hunt of its own — it delegates that to /code-review."
---

# PR Self-Review

One question: **can this go to other people — and if not, what exactly blocks it?**

This skill is a **router and a gate**, not a reviewer. It decides which of the
repo's skills apply to the diff, runs the deterministic gates, delegates
bug-hunting to `/code-review`, merges everything into one report, and returns a
verdict. A CRITICAL finding means the PR does not get opened.

- Routing table → [references/routing.md](references/routing.md)
- Per-lens severity mapping → [references/severity-map.md](references/severity-map.md)
- Gates G1–G12 → [references/gates.md](references/gates.md)
- Known false-positive sources → [references/do-not-flag.md](references/do-not-flag.md)
- Report schema + terminal contract → [references/report.md](references/report.md)
- The `gh pr create` guard → [references/hook.md](references/hook.md)

Findings are written **in Ukrainian**; identifiers, paths, rule names and quoted
code are never translated.

---

## The vocabulary is the product's, not this skill's

Nothing here is invented. Every term is read from the repo:

| Term | Source of truth |
|---|---|
| `CRITICAL` / `WARNING` / `SUGGESTION` | `Severity`, `server/src/vendor/shared/contracts/findings.ts:11` |
| `bug` / `security` / `perf` / `style` / `test` | `FindingCategory`, same file :14 |
| `request_changes` / `approve` / `comment` | `Verdict`, same file :26 |
| finding shape, `confidence` 0..1 | `Finding`, same file :59 |
| **when to block** | `CiFailOn`, `contracts/knowledge.ts:173` — default `critical` |
| what counts as CRITICAL | `docs/agent-prompts/general-reviewer.md:53-73`, verbatim |

**Default gate: `critical` — block iff ≥ 1 CRITICAL finding survives §4.**

Read `general-reviewer.md:53-73` before assigning any severity. Its rule holds
here too: *"I would have done it differently"* is at most a WARNING, never a
CRITICAL.

---

## Procedure

### 1. Collect and gate — always first, never skipped

```sh
node .claude/skills/pr-self-review/scripts/gates.mjs
```

One command. It collects everything open (merge-base with `origin/main`, staged,
unstaged, untracked), runs G1–G12, computes the lens routing and the list of
touched packages, and writes `.devdigest/cache/pr-self-review/gates.json`.

It costs nothing and needs no model. Read its output before doing anything else:
a CRITICAL here (unmirrored `vendor/shared`, work on `main`, a secret, an
unregistered module, a schema with no migration) is already a blocker, and the
LLM passes are not worth running until it is fixed.

Empty diff → verdict `approve`, write the report, stop.

### 2. Package checks, against a baseline

`gates.json` → `packages[]` lists the commands per touched package. Run them
**from inside the package directory**, never the root.

A failure blocks only if it is **new**. Compare against
`.devdigest/cache/pr-self-review/baseline.json`; anything already failing there
is reported as `tests: baseline`, not as a finding. On a clean tree in this
repo, 6 of 11 tests in `server/src/modules/repo-intel/indexer-pipeline.test.ts`
already fail — without the baseline this gate would block every PR and be turned
off on day one.

No baseline yet → run the same commands once on the merge-base and write it, or
report `tests: unknown` and do not block on test failures this run.

`pnpm arch` (server) is the cheapest backend check that exists: `onion-architecture`
ships `server/.dependency-cruiser.cjs` with 25 grandfathered violations in
`.dependency-cruiser-known-violations.json`, so it fails **only on a new**
boundary violation. A failure there is a CRITICAL, and it needs no model.

### 3. Lens passes — at most three, only non-empty groups

`gates.json` → `routing` gives the groups and their lenses. Run **one pass per
non-empty group**, each seeing only its own slice of the diff:

| Group | Typical lenses |
|---|---|
| `frontend` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices`, `react-testing-library` |
| `backend` | `onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`, `perf-prompt` |
| `crosscutting` | `zod`, `security` |

Two lenses are not skills:

- **`perf-prompt`** → `docs/agent-prompts/performance-reviewer.md`. There is no
  perf skill in this repo; this prompt is the rubric, already tuned to Fastify 5,
  Drizzle over postgres-js with a ~10 connection pool, p-queue and octokit.
- **`security`** → the `security` skill **plus** `docs/agent-prompts/security-reviewer.md`,
  because the skill is written for React + Express + Mongo and the prompt is
  written for this stack.

Read those prompts, never copy them: they are the source of truth for the
product's built-in agents, and a copy drifts.

Then run `/code-review` on the same diff for correctness bugs. Do not hunt bugs
in the lens passes — that is its job, and duplicating it doubles the cost and
the noise.

Subagents only when there are ≥ 2 non-empty groups **and** the diff is > 400
changed lines; otherwise run the passes inline.

### 4. Filter — this is what keeps the gate usable

Every finding, before it counts:

1. **Deduplicate.** Key: `file` + overlapping line range + normalised title.
   `security` and `/code-review` will both find the same injection. Keep the
   higher severity, list both lenses.
2. **Ground it.** A CRITICAL must cite `start_line`/`end_line` that intersect a
   real hunk of this diff — the same rule `reviewer-core`'s grounding gate
   applies to model output. Ungrounded → WARNING at most, never blocking.
3. **Confidence ≥ 0.7** to block, using the `security` skill's model: pattern +
   confirmed attacker-controlled input = HIGH = blocks; pattern with an unclear
   source = MEDIUM = WARNING.
4. **Check [do-not-flag.md](references/do-not-flag.md).** Deliberate starter
   gaps, the twice-vendored `shared`, `server/clones/`, the 25 grandfathered
   boundary violations and `// dd-ignore:` lines with a stated reason are not
   findings.

One false CRITICAL and this skill gets switched off. When in doubt: WARNING.

### 5. Verdict and report

```
CRITICAL ≥ 1  → verdict request_changes, blocked: true
CRITICAL = 0, any WARNING/SUGGESTION → verdict comment, blocked: false
nothing at all → verdict approve
```

Write `.devdigest/cache/pr-self-review/last-run.json` in the shape described in
[references/report.md](references/report.md) — it carries `head_sha` and
`diff_hash`, which is what the `gh pr create` guard checks for freshness.

Terminal output: **≤ 15 lines.** Verdict, CRITICAL and WARNING as
`file:line — title`, counts, path to the full report. SUGGESTIONs go to the JSON
only.

### 6. Re-runs are incremental

A run is almost always followed by "fix two things, run again". Reuse
`last-run.json`: a hunk whose content hash is unchanged keeps its findings from
the cache instead of being re-reviewed, and the report carries
`delta: { fixed, new, still_open }`.

**CRITICALs are never served from cache** — they are re-checked every run. A
stale cache that reports a CRITICAL as `fixed` is a silently shipped bug.

### 7. Budget

90 seconds and three lens passes. Over budget → fall back to the deterministic
gates plus one pass, set `degraded: true`, and list the lenses that did not run
in `lenses_skipped`. Silently reduced coverage is worse than none: it looks
clean.

### 8. Hand off

Not blocked → offer the PR draft: a conventional-commit title with the scopes
this repo actually uses (`feat(web,contracts):`, `fix(server):`, `docs(specs):`),
a body, and a self-review block:

```
Self-review: CRITICAL 0 · WARNING 4 · SUGGESTION 7 (frontend-ui-architecture, security, code-review)
```

Blocked → print the CRITICALs and stop. Do not run `gh pr create`; the guard
would refuse it anyway.

---

## Override

A false positive must not be able to lock the repository:

```
/pr-self-review --override "<reason>"
```

The reason is **mandatory**, goes into `override` in the report, and into the PR
body as its own line. A bypass is visible to the human reviewer or it is not a
bypass.

For a single shell call outside the skill: `PR_SELF_REVIEW_SKIP=1 gh pr create …`.

## Refreshing the baseline

`/pr-self-review --refresh-baseline` re-runs the package commands on the
merge-base and rewrites `baseline.json`. Never automatic, and — exactly as
`pnpm arch:baseline` puts it — rewritten only ever to **remove** entries. A
freshly broken test must not quietly become "known red".

## What this skill does not review

Changes under `.claude/skills/**` get the deterministic gates only. A reviewer
that lenses itself finds its own rules everywhere.
