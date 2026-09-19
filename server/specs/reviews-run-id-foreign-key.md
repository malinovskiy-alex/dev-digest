# `reviews.run_id` → `agent_runs.id`, as a real foreign key

**Status:** not built. Surfaced while wiring the findings-by-severity rollups
(see [`../../specs/L02-findings-by-severity.md`](../../specs/L02-findings-by-severity.md)).

**Goal:** make the run ↔ review link a database constraint instead of a
convention four separate places already depend on.

## The problem

`reviews.run_id` (`src/db/schema/reviews.ts`) is a bare `uuid` column. It points
at `agent_runs.id` and nothing enforces that:

- `insertReview` writes it,
- `deleteAgentRun` (`src/modules/reviews/repository/run.repo.ts`) has to delete
  the review **explicitly**, with a comment saying that otherwise the findings
  orphan,
- the client anchors `review-run-${review.run_id}` and scroll-targets by it,
- and as of L02 the PR-detail timeline joins reviews to runs on it to derive each
  tile's severity chips.

Four consumers, zero constraint. A review whose run row is gone keeps its
findings and silently loses its chips; a run whose review is gone keeps a
`findings_count` nothing can explain.

## Why it was left alone

Adding the FK is not a one-line migration — it forces a decision about cascade
semantics that the current code sidesteps:

- `ON DELETE CASCADE` makes "delete this run" silently destroy its review and
  every finding, including ones a human accepted. That is a bigger behaviour
  change than it looks.
- `ON DELETE SET NULL` keeps the review but strands it from its run, which is
  roughly today's broken state made official.
- `ON DELETE RESTRICT` is the honest one and means `deleteAgentRun` must keep
  deleting the review first — the explicit call stays, but the constraint now
  catches anyone who forgets.

## Plan

1. **Audit first.** A migration that adds a FK fails on existing bad rows, and
   this database has demo and lesson data in it:
   ```sql
   select count(*) from reviews r
   left join agent_runs ar on ar.id = r.run_id
   where r.run_id is not null and ar.id is null;
   ```
2. **New migration** (never edit an applied one — `../CLAUDE.md`): null out the
   orphans found above, then
   `alter table reviews add constraint reviews_run_id_fk
   foreign key (run_id) references agent_runs(id) on delete restrict`.
   Declare it on the Drizzle column too, so the schema and the database agree.
3. **Keep `deleteAgentRun`'s explicit review delete** and its comment; under
   `RESTRICT` it is load-bearing, not redundant.
4. **Integration test** (`*.it.test.ts` — anything touching Postgres must be, see
   `../CLAUDE.md`): deleting a run with a review succeeds and removes both;
   inserting a review with a fabricated `run_id` is rejected.

## Not in scope

Backfilling `run_id` on historical reviews that never had one — those predate the
column and `null` is the truthful value for them. The FK must therefore stay
nullable.
