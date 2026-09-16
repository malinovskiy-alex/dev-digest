# Insights — e2e

Append-only. Format and cross-package entries: [../INSIGHTS.md](../INSIGHTS.md).

---

## 2026-09-15 — flow 02 assumes the demo repo is the only repo
**Symptom:** the suite passes in CI and fails locally right after you add a repo
of your own.
**Cause:** the flow follows the home redirect to the *first* repo; CI always
starts from an empty, freshly seeded Postgres.
**Rule:** reseed (or use `pnpm e2e:hermetic`) before trusting a local failure.
**Where:** `e2e/specs/02-repo-pulls-detail.flow.json`

## 2026-09-15 — markdown in `specs/` does not confuse the runner
**Symptom:** none — worth knowing before someone "fixes" it.
**Cause:** spec discovery filters on `.endsWith(".flow.json")`, so plans and
flows coexist in one folder.
**Rule:** keep e2e plans in `e2e/specs/*.md`; no renaming needed.
**Where:** `e2e/run.ts:54`
