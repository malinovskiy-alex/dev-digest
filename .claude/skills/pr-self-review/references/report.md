# Report — schema, freshness, terminal contract

Everything lands in `.devdigest/cache/pr-self-review/`, which is already covered
by `.gitignore` (`.devdigest/cache/`). Nothing to add there.

```
.devdigest/cache/pr-self-review/
├── gates.json      # written by scripts/gates.mjs — diff inventory, routing, G1-G12
├── last-run.json   # the verdict; the gh pr create guard reads this one
└── baseline.json   # known-failing tests on the merge base
```

## `last-run.json`

Shaped after the product's `Review` (`contracts/findings.ts`), plus the freshness
and bookkeeping fields the guard and the delta need.

```jsonc
{
  "head_sha": "9a63df9…",        // guard compares with the current HEAD
  "diff_hash": "5f54ad0820b38d8d", // guard recomputes; catches edits made after the review
  "base": "origin/main",
  "generated_at": "2026-09-19T12:40:11.204Z",

  "ci_fail_on": "critical",      // CiFailOn, contracts/knowledge.ts:173
  "blocked": true,               // derived: counts.CRITICAL >= 1 under ci_fail_on=critical
  "degraded": false,             // true = over budget, some lenses did not run
  "verdict": "request_changes",  // Verdict, contracts/findings.ts:26
  "summary": "Один CRITICAL у pulls/routes.ts: запит без workspace_id.",

  "counts": { "CRITICAL": 1, "WARNING": 4, "SUGGESTION": 7 },
  "delta":  { "fixed": 2, "new": 1, "still_open": 1 },

  "findings": [
    {
      "id": "a3f1c07b",            // sha256(file + normalised title + hunk content)[:8]
      "status": "open",            // open | fixed | suppressed
      "severity": "CRITICAL",      // Severity, contracts/findings.ts:11
      "category": "security",      // FindingCategory, :14
      "title": "Запит без workspace_id",
      "file": "server/src/modules/pulls/routes.ts",
      "start_line": 238,
      "end_line": 240,
      "rationale": "…markdown…",
      "suggestion": "…markdown…",
      "confidence": 0.86,          // 0..1, as in Finding
      "grounded": true,            // lines intersect a real hunk of this diff
      "lens": "onion-architecture" // our addition — which lens said it
    }
  ],

  "lenses_run": ["frontend-ui-architecture", "security", "perf-prompt", "code-review"],
  "lenses_skipped": [],
  "gates": { "G1": "pass", "G8": "pass", "typecheck": "pass", "arch": "pass", "tests": "baseline" },
  "override": null               // or { "reason": "...", "at": "…" }
}
```

### Fields that are ours, not the product's

- **`lens`** — without it a finding cannot be trusted or calibrated: "who said
  this, and is that lens usually right?" is the first question on a false
  positive.
- **`id` / `status`** — identity across runs. Hashed from the **hunk content**,
  never from line numbers: the first fix above a finding shifts every line below
  it, and a line-based id would report the whole file as new.
- **`grounded`** — the gate from §4 of `SKILL.md`, recorded so a later reader can
  see why an ungrounded CRITICAL was demoted.
- **`degraded` / `lenses_skipped`** — silently reduced coverage looks identical to
  a clean review. It must be visible.

### Everything else is deliberately the product's shape

`Severity`, `FindingCategory`, `Verdict`, `confidence`, `ci_fail_on` and the
`counts` key set (always all three keys, an absent severity is `0`, never a
missing key — `SeverityCounts`, `contracts/findings.ts:34`). The same report
should feed L06 ("Export to CI", `agent-runner/`) without a rewrite.

## Freshness

The guard (`scripts/pr-guard.mjs`) refuses `gh pr create` when any of these holds:

| Condition | Meaning |
|---|---|
| no `last-run.json` | never reviewed |
| `head_sha` ≠ current `HEAD` | reviewed, then committed |
| `diff_hash` ≠ recomputed hash | reviewed, then edited the working tree |
| `blocked: true` | reviewed, and it failed |

A stale report is "run it again", never "let it through". Otherwise reviewing a
clean tree and then writing anything at all would be enough to get past the gate.

`diff_hash` is `sha256(diff text from merge-base + the untracked file list)`,
first 16 hex chars — computed identically in `gates.mjs` and in the guard, from
`scripts/lib/repo.mjs`.

## Terminal output

**At most 15 lines.** Nothing else earns terminal space.

```
✗ request_changes — 1 CRITICAL · 4 WARNING · 7 SUGGESTION   (2 виправлено, 1 нова)
CRITICAL
  server/src/modules/pulls/routes.ts:238 — запит без workspace_id            [onion-architecture]
WARNING
  client/src/app/agents/page.tsx:64 — fetch у компоненті замість хука        [frontend-ui-architecture]
  server/src/modules/reviews/service.ts:120 — N+1: запит усередині .map      [perf-prompt]
  client/src/components/RunCard.tsx:31 — текст повз next-intl                [gate G12]
  server/drizzle/0007_runs.sql — міграцію треба застосувати вручну           [gate G5]
gates: G1-G12 pass · typecheck pass · arch pass · tests baseline
повний звіт: .devdigest/cache/pr-self-review/last-run.json
```

SUGGESTIONs never go to the terminal. The rule is not cosmetic: a wall of text is
skipped exactly when it contains something that matters.
