# Insights — reviewer-core

Append-only. Format and cross-package entries: [../INSIGHTS.md](../INSIGHTS.md).

---

## 2026-09-15 — a "missing" finding is usually the grounding gate, not the model
**Symptom:** the model clearly reported an issue, and the UI shows fewer
findings or none.
**Cause:** `groundFindings()` drops any finding whose line range does not
intersect a diff hunk for that file. Drops are reported with a reason through
`onEvent` and land in the run trace.
**Rule:** read the run trace before blaming the prompt or the model.
**Where:** `reviewer-core/src/grounding.ts`

## 2026-09-15 — the score is derived, never taken from the model
**Symptom:** the returned score does not match what the model answered.
**Cause:** deliberate — the score is recomputed from the findings that survived
grounding, so score, findings list and events always agree.
**Rule:** do not "fix" this by trusting the model's number.
**Where:** `reviewer-core/src/review/run.ts`

## 2026-09-15 — `auto` needs two conditions to map-reduce
**Symptom:** a very large diff still costs exactly one LLM call.
**Cause:** `selectMode()` requires total changed lines over the threshold **and**
more than one file; `map-reduce` on a single-file diff also falls back to
single-pass.
**Rule:** pass an explicit strategy when you need per-file calls.
**Where:** `reviewer-core/src/review/run.ts`
