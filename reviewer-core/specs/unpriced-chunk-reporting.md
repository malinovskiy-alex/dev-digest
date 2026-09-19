# Say which chunk went unpriced

**Status:** not built. Surfaced while documenting the cost fold (see
[`../docs/cost-and-token-accounting.md`](../docs/cost-and-token-accounting.md)).

**Goal:** when a review's `costUsd` comes back `null`, make it possible to say
*why* without re-running it.

## The problem

`runReview` folds cost across chunks in `src/review/run.ts:184`:

```ts
costUsd = costUsd == null || res.costUsd == null ? null : costUsd + res.costUsd;
```

One unpriced chunk poisons the whole run to `null`, permanently, and that is the
right call — a partial sum reads like a fact while being an understatement.

But the *reason* is thrown away. A map-reduce run over twenty files that returns
`costUsd: null` gives no way to tell whether the provider omitted usage on one
call, or the model is missing from the price book entirely, or every call was
unpriced. Downstream, `agent_runs.cost_usd` is `null` and the trace's `COST` tile
renders `—` with nothing to explain it. The operator's only recourse is to re-run
and watch.

This is the one place the engine goes quiet. Findings do not: `ReviewOutcome`
already carries `dropped: { finding, reason }[]` precisely so a grounded-away
finding can be explained instead of vanishing (`src/review/run.ts:101`). Cost
should follow the same principle.

## Plan

1. **Track it in the loop.** Alongside the existing accumulators, collect
   `unpriced: { label: string }[]` — push `chunk.label` whenever
   `res.costUsd == null`. Cheap, and the labels are already in hand.
2. **Return it on `ReviewOutcome`**, beside `costUsd` and the existing `chunks`
   and `dropped` arrays. Keep it an empty array rather than `undefined` when
   everything was priced, so consumers branch on `.length`.
3. **Emit it.** The loop already calls `emit('result', …)` per chunk; add an
   `emit('info', …)` naming the unpriced chunk as it happens, so a live run shows
   it in the SSE stream rather than only at the end.
4. **Leave the fold alone.** This is reporting, not a behaviour change —
   `costUsd` must still poison to `null`. Anyone tempted to "skip the nulls and
   sum the rest" should read the docs page first: that rule is right for the PR
   list's total and wrong for one review.

## Consumer work (out of scope here, listed so it is not a surprise)

The server would persist or log it and the run trace would render it under the
`COST` tile — "price unknown for 3 of 20 chunks" is the useful sentence. That
spans `server/` and `client/`, so it belongs in a root `specs/` entry if and when
it is picked up; this spec covers only the engine's half.

## Tests

`test/` drives the pipeline with a stubbed `LLMProvider`, so this needs no
network:

- a two-chunk fixture where one returns `costUsd: null` → outcome has
  `costUsd === null` **and** `unpriced` naming exactly that chunk;
- every chunk priced → `costUsd` is the sum and `unpriced` is `[]`;
- every chunk unpriced → `costUsd === null` and all labels present.

The first case is the regression guard for the fold itself, which is worth having
regardless of whether the reporting ships.
