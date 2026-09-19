# The Pull Requests list rollups

`GET /repos/:id/pulls` (`src/modules/pulls/routes.ts:37`) returns `PrMeta[]`. Most
of that shape is a straight read of the `pull_requests` row, but four fields are
**computed on read** from other tables: `status`, `score`, `cost_usd` and
`findings`.

This page explains why they are computed rather than stored, and what each one
actually means — the three numeric ones look similar and answer different
questions.

## Why computed, not denormalized

None of the four has a column on `pull_requests`. That is deliberate: a denormal
column has to be written by every path that can change the underlying data
(a run finishing, a review being deleted, a run being deleted, a re-review) and
silently goes stale the day one of those paths forgets. The list is small — one
repo's PRs, not the whole workspace — so the cost of recomputing is one extra
`IN`-query per field and a pass of JS grouping.

The shape is the same for all three numeric rollups, and a fourth should copy it:

```ts
const rows = await container.db
  .select({ /* the key and the value only */ })
  .from(/* the source table */)
  .where(and(inArray(/* fk */, prIds), /* the "counts" predicate */))
  .orderBy(desc(/* recency */));      // newest-first where "latest" matters
// → a pure helper in status.ts groups it into a Map
```

Keeping the grouping in a **pure function in `src/modules/pulls/status.ts`** is
what makes these testable without a database: `test/pulls-status.test.ts` is in
the hermetic unit suite and never starts Postgres.

## `status` — review freshness, not GitHub's merge state

`deriveReviewStatus` (`status.ts:48`). The DB `status` column holds GitHub's
merge state (`open` / `merged` / `closed`). The list shows a *review* status:

- `needs_review` — never reviewed, or the head moved since the last review
- `stale` — the current head was reviewed, but the PR is older than `STALE_DAYS`
- `reviewed` — current head reviewed and recent

Merged and closed PRs keep their merge state. The input is
`pull_requests.last_reviewed_sha` compared against `head_sha`, so the status is a
statement about *this commit*, not about the PR ever having been looked at.

## `score` — the LATEST review

One `IN`-query over `reviews` where `kind = 'review'`, ordered newest-first; the
first row seen per PR wins. "Latest" is right here because a score is a verdict
on the current state of the code, not something that accumulates.

## `cost_usd` — the TOTAL of every completed run

`totalCostByPr` (`status.ts:82`). This one is a **sum**, and the asymmetry with
`score` is the thing to remember: the column answers *"what has reviewing this PR
cost me?"*. Three agents reviewing a PR spend three bills; a re-run spends
another. Reporting only the newest run would understate the spend, and would make
the number go *down* after a cheap re-run.

Only `status = 'done'` rows are passed in, so a failed attempt never adds to it.

Three empty-ish cases, which are not the same thing:

| Situation | Value | Rendered |
|---|---|---|
| no completed run | absent from the map → `null` | `—` |
| runs exist, every one has an unknown price | `null` | `—` |
| some runs priced, some not | sum of the priced ones | `$0.0xx` |

An unknown model price is *unknown*, never `0`. The third row is a floor rather
than a guess, which is the honest answer available.

## `findings` — severity tally of the LATEST review

`rollupSeverities` (`status.ts:31`), over `findings` joined to the latest review
ids the score rollup already resolved. Keys are the `Severity` enum verbatim
(`CRITICAL` / `WARNING` / `SUGGESTION`) so a client can index by severity with no
mapping table. A PR with no review still gets an object — `EMPTY_SEVERITY_COUNTS`
— never `null`, so the client branches on the total rather than on nullness.

Scoped to the latest review (like `score`, unlike `cost_usd`) so the column
agrees with the score ring beside it, and with the hover popover, which says
"in this run".

**Dismissed findings are counted.** The PR detail page still renders a dismissed
finding, greyed but present, so the list has to agree. This makes it deliberately
a different number from `agent_runs.blockers`, which excludes dismissed rows
because it gates CI. If you change either definition, change the comment at the
other — see `../INSIGHTS.md`.

## Adding a fifth

1. Compute it in `routes.ts` beside the others, as one `IN`-query.
2. Put the grouping in a pure exported function in `status.ts`, and unit-test it
   in `test/pulls-status.test.ts` — **not** a `*.it.test.ts`; nothing here needs
   a database.
3. Add the field to `PrMeta` in **both** vendored contract trees in the same
   commit (`src/vendor/shared/contracts/platform.ts` and the client's copy), and
   make it `.nullish()` so a client that predates it still parses.
4. Decide latest-vs-total explicitly, and say which in the field's comment. The
   two already disagree on purpose.
