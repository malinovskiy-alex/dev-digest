# specs/ — cross-package plans

What we are about to build, written **before** the code. Once a spec ships, its
lasting explanation moves to [`../docs/`](../docs/) and the spec stays as the
record of intent.

**Only specs that span several packages live here** — which most course lessons
do, since a feature usually needs a table, an API module, a prompt slot and a
screen. A spec that touches one package belongs in that package's `specs/`
(`server/specs/`, `client/specs/`, `reviewer-core/specs/`, `mcp/specs/`,
`e2e/specs/`). One feature is one spec: a cross-package feature is not split into
a file per package.

## Naming

`L<NN>-<slug>.md` for course lessons (see the lesson table in
[`../README.md`](../README.md)), `<slug>.md` for anything else.

A feature can have two files under one slug: `<slug>.requirements.md` — *what*,
as EARS requirements, written by the `spec-creator` agent — and `<slug>.md` —
*how*, the plan `implementation-planner` writes from it. The same pair works in every
`<pkg>/specs/`.

After `/run-plan` the slug gains two records of how the plan was carried out:
`<slug>.verification.md` — the final `plan-verifier` verdicts, the findings
ledger and the last verification output — and `<slug>.retro.md`, the
`/workflow-retro` of the run.

Every file in `specs/` and `<pkg>/specs/` is written in **English**, whatever
language the request came in.

```
specs/L01-run-cost-badge.md
specs/L02-conventions-extractor.md
specs/L04-devdigest-mcp.md
```

## Template

```markdown
# L0X — <feature>

**Goal:** one sentence, from the user's side.
**Not in scope:** what this deliberately does not do.

## Touches
server: <modules/tables> · client: <routes/components> · reviewer-core: <prompt slot>

## Contract
The Zod shape(s) added to `@devdigest/shared` — both vendored copies.

## Steps
1. …

## Done when
- [ ] observable behaviour a human can check in the UI
- [ ] tests: <which suite>
```
