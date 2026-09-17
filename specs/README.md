# specs/ — cross-package plans

What we are about to build, written **before** the code. Once a spec ships, its
lasting explanation moves to [`../docs/`](../docs/) and the spec stays as the
record of intent.

Package-scoped plans belong in `server/specs/`, `client/specs/`, etc. A spec
lands here only when it spans several packages — which most course lessons do,
since a feature usually needs a table, an API module, a prompt slot and a screen.

## Naming

`L<NN>-<slug>.md` for course lessons (see the lesson table in
[`../README.md`](../README.md)), `<slug>.md` for anything else.

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
