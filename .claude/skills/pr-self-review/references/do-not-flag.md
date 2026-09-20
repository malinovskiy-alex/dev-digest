# Do not flag

Every entry here is a real source of false positives **in this repository**. A
finding from this list is not a finding; reporting it teaches the author to stop
reading the report.

## Deliberate gaps in the starter

`main` is the course starter: the finished product with features removed, one per
lesson (`README.md`, *What you build in the course*). So:

- a missing feature from the lesson table (run cost badge, conventions extractor,
  MCP server, eval pipeline, multi-agent review…) is **not** an omission;
- **an empty table is intentional.** The schema already holds every table the
  finished product needs, including ones no starter code touches;
- a `TODO` or a stub left where a lesson will land is scaffolding, not debt.

Do not propose "completing" any of this, and never suggest recovering an
implementation from the commit that removed it — the lesson exists so it gets
built from scratch (root `INSIGHTS.md`, 2026-09-16).

## Things that look like duplication and are not

- **`server/src/vendor/shared/` and `client/src/vendor/shared/`** are two physical
  copies on purpose. Do not propose extracting a package, a workspace, an
  `npm link` or a published dependency. The only rule that applies is G1: they
  must stay identical.
- **Four lockfiles** are load-bearing, one per package. Not a monorepo mistake.
- **`skills-lock.json`** pins vendored community skills. Local edits to those
  skills are overwritten on update — never suggest them.

## Paths that are not source

- `server/clones/**` — repo-intel's clone target, which can hold a full second
  checkout of dev-digest itself. Gitignored, but raw `grep`/`find` do not honour
  that. Never review or edit a path containing it.
- `dist/`, `.next/`, `coverage/`, `node_modules/`, `.devdigest/`.
- `agent-runner/dist/` **is** committed on purpose when it exists — a JS GitHub
  Action runs it as-is, with no build step (`.gitignore:3-5`).

## Already-decided architecture debt

The 25 entries in `server/.dependency-cruiser-known-violations.json` are known,
written down in `server/specs/onion-debt.md`, and deliberately not fixed on
`main`. `pnpm arch` ignores them; so does this skill. Only a **new** violation is
a finding.

## Test coverage

`TESTING.md` is explicit: "We do not chase line coverage… If a test wouldn't
catch a class of regression we care about, we don't write it." So:

- "this function has no test" is not a finding;
- "this changed a seam — route, adapter, contract, pipeline, rendered component —
  and the suite that owns that seam has nothing for it" is (WARNING, G11).

## Suppression in code

```ts
// dd-ignore: react-hooks-deps — the ref is stable for the lifetime of the panel
```

Honoured only with a reason after the em dash. Without one it does nothing —
otherwise the repo fills with bare ignores inside a month. A suppression applies
to the rule named, on the next line only.

## Style the repo has already settled

- Ukrainian in findings and in `PLAN.md`; English in `SKILL.md`, `references/`
  and code comments. Not an inconsistency.
- Conventional commits with the scopes actually in use here (`web`, `server`,
  `contracts`, `specs`, `insights`).
- CRLF in the working tree for most source files, LF for some Markdown. The repo
  has no `.gitattributes`; `core.autocrlf` decides per file. A line-ending diff is
  reported once by the CRLF gate and never as a per-line finding.

## The reviewer itself

Changes under `.claude/skills/**` get the deterministic gates and nothing else.
A lens pointed at a document full of rules finds all of them, everywhere.
