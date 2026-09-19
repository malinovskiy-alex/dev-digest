# Cost and token accounting across chunks

`runReview` (`src/review/run.ts`) may issue one LLM call or many — `selectMode`
picks `single-pass` or `map-reduce`, and map-reduce makes one call per file. The
`ReviewOutcome` it returns has to report a single `tokensIn`, `tokensOut` and
`costUsd` regardless. This page is how those three are folded, and why two of
them fold differently from the third.

## Tokens add. Cost poisons.

The accumulator loop (`src/review/run.ts:184`):

```ts
tokensIn  += res.tokensIn;
tokensOut += res.tokensOut;
costUsd = costUsd == null || res.costUsd == null ? null : costUsd + res.costUsd;
```

Tokens are a plain sum — every provider reports them, so there is no unknown to
propagate.

Cost is different. `costUsd` starts at `0` and becomes `null` the moment **any**
chunk returns `null`, and can never recover: once null, the ternary's first
branch keeps it null for the rest of the loop. That is deliberate. A partial sum
across ten chunks where three had no price is not "the cost" — it is an
understatement that reads like a fact. The engine would rather say *unknown* than
publish a number that is quietly too low.

This is the same rule the rest of the stack follows: **an unknown price is
unknown, not free.** Nothing downstream should turn a `null` into `0`.

## Where the per-call number comes from

`src/llm/openrouter.ts` asks OpenRouter for the real generation cost
(`usage: { include: true }`) rather than estimating it, and falls back to an
injected estimator when the provider does not return one. The server wires that
estimator in `server/src/platform/container.ts`, backed by
`server/src/platform/price-book.ts` (live prices, 6 h TTL) over
`server/src/adapters/llm/pricing.ts` (a static table).

So a `null` here means one specific thing: neither the provider nor the price
book knew what the model costs. A model missing from the static table produces
exactly this.

## Downstream

`ReviewOutcome.costUsd` is consumed by `server/src/modules/reviews/run-executor.ts`
and persisted to `agent_runs.cost_usd`, which is nullable for this reason. From
there:

- the run trace's `COST` stat tile and the timeline's per-run badge show that one
  run's cost;
- the PR list's `Cost` column **sums** every completed run of the PR — a
  different question, answered in
  [`../../server/docs/pr-list-rollups.md`](../../server/docs/pr-list-rollups.md).

## If you change the fold

Keep the poisoning. The tempting "skip the nulls and sum the rest" is right for
the PR-list column — where the alternative is showing nothing at all for a PR
that demonstrably cost money — and wrong here, where the unit is one review and a
partial answer is indistinguishable from a complete one.

`test/` covers the pipeline with a stubbed `LLMProvider`; a chunk fixture that
returns `costUsd: null` is the case to keep green.
