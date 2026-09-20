# pr-self-review

Local self-review of everything that is open, run before a pull request is
opened. Routes the diff to the skills that apply to it, runs the deterministic
`AGENTS.md` gates, and returns one verdict in the product's own vocabulary:
**one CRITICAL and the PR is blocked.**

Invoke it with `/pr-self-review`. It also runs by necessity: a `PreToolUse` hook
refuses `gh pr create` until a fresh, passing report exists.

## Files

| File | What it holds |
|---|---|
| [SKILL.md](SKILL.md) | the procedure, from trigger to verdict |
| [PLAN.md](PLAN.md) | the design and the research behind it — written before the skill, kept as the record of intent |
| [references/routing.md](references/routing.md) | glob → lens table, and how to extend it |
| [references/severity-map.md](references/severity-map.md) | what each lens's "bad" maps to in `Severity` |
| [references/gates.md](references/gates.md) | G1–G12, the package commands, the test baseline |
| [references/do-not-flag.md](references/do-not-flag.md) | this repo's real false-positive sources |
| [references/report.md](references/report.md) | `last-run.json` schema, freshness rules, terminal contract |
| [references/hook.md](references/hook.md) | the `gh pr create` guard and why it is a hook |
| [examples.md](examples.md) | blocking, non-blocking, false-positive, gate-only, second run |
| `scripts/gates.mjs` | the deterministic half — diff inventory, routing, G1–G12 |
| `scripts/pr-guard.mjs` | the hook: freshness check, deny with a reason |
| `scripts/lib/` | shared git plumbing and the machine-readable routing table |

## Try it without opening anything

```sh
node .claude/skills/pr-self-review/scripts/gates.mjs
```

Prints the diff inventory, which lens group each file lands in, which package
commands to run, and every gate that fired. No model, no network, no install —
Node builtins only. Writes `.devdigest/cache/pr-self-review/gates.json`
(gitignored).

## Design decisions worth knowing

- **The vocabulary is the product's.** `Severity`, `Verdict`, `Finding`,
  `CiFailOn` come from `server/src/vendor/shared/contracts/`, and the definition
  of CRITICAL from `docs/agent-prompts/general-reviewer.md:53-73`. Cited by file
  and line, never copied — so drift is detectable.
- **Routing lives here, not in the skills.** No skill declares where it applies,
  and the product's `Skill` contract has no path field either. Most skills are
  vendored from upstream (`skills-lock.json`) and cannot be edited locally.
- **Two lenses are prompts, not skills.** `docs/agent-prompts/performance-reviewer.md`
  is the only perf rubric in the repo; `security-reviewer.md` covers this stack
  where the `security` skill covers React + Express + Mongo.
- **Bug hunting belongs to `/code-review`.** This skill routes, gates, merges and
  decides; it does not re-implement a bug hunt.
- **Blocking is guarded against itself.** A CRITICAL blocks only if it is
  grounded in a real hunk and its confidence is ≥ 0.7, and
  `/pr-self-review --override "<reason>"` always exists, with the reason surfaced
  in the PR body.

## Sources

Internal, all verified in this repository:
`server/src/vendor/shared/contracts/{findings,knowledge}.ts` ·
`docs/agent-prompts/{general,security,performance}-reviewer.md` ·
`AGENTS.md` (hard rules → G1–G4) · `TESTING.md` (suite map → G11) ·
`INSIGHTS.md` (`server/clones/`, CRLF, the scoped-vs-global hook question) ·
`server/.dependency-cruiser.cjs` + `.dependency-cruiser-known-violations.json`
(`pnpm arch`, and the baseline pattern reused for tests) ·
`server/src/modules/index.ts`, `server/drizzle/`, `client/messages/en/`
(the seams behind G8–G12) · `skills-lock.json` (which skills are vendored) ·
`.claude/skills/frontend-ui-architecture/` (package layout).
