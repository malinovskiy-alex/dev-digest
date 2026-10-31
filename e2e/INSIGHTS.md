# Insights — e2e

Append-only. Format, sections and cross-package entries:
[../INSIGHTS.md](../INSIGHTS.md).

---

## What Works

*(nothing yet)*

## What Doesn't Work

### 2026-09-15 — flow 02 assumes the demo repo is the only repo
**Symptom:** the suite passes in CI and fails locally right after you add a repo
of your own.
**Cause:** the flow follows the home redirect to the *first* repo; CI always
starts from an empty, freshly seeded Postgres.
**Rule:** reseed (or use `pnpm e2e:hermetic`) before trusting a local failure.
**Where:** `e2e/specs/02-repo-pulls-detail.flow.json`

## Codebase Patterns

### 2026-09-15 — markdown in `specs/` does not confuse the runner
**Symptom:** none — worth knowing before someone "fixes" it.
**Cause:** spec discovery filters on `.endsWith(".flow.json")`, so plans and
flows coexist in one folder.
**Rule:** keep e2e plans in `e2e/specs/*.md`; no renaming needed.
**Where:** `e2e/run.ts:54`

## Tool & Library Notes

### 2026-10-31 — `find … click` on an element below the fold does nothing, yet the step passes
**Symptom:** flow 08: "expand the Prompt assembly section" ✓, then
`wait --text "Project context — attached specs (untrusted)"` times out. The
failure screenshot shows the trace drawer still scrolled to the top.
**Cause:** CI's viewport is 1280×577 and agent-browser does not scroll before a
click; the section header sits below Stats, off screen, so the click lands
nowhere — and the command still exits 0. Locally the window is taller and the
flow passes.
**Rule:** a flow that clicks anything below the first screen starts with
`["set", "viewport", "1280", "2000"]` (or `scrollintoview <css>` before the
click). Click by `find role button … --name`, so the target must be a real
`<button>` — a clickable `<div>` is not reachable that way.
**Where:** `e2e/specs/08-run-trace-project-context.flow.json:5`

## Recurring Errors & Fixes

*(nothing yet)*

## Open Questions

*(nothing yet)*

## Session Notes

*(nothing yet)*
