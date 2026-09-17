# L01 — Run Cost Badge

**Goal:** every finished review run shows what it cost, on the three screens a
reviewer actually looks at — the PR list, the run timeline, and the run trace.

**Not in scope:** aggregate or monthly spend, budget caps, the `Findings` column
the PR-list mockup also draws, and the multi-agent / agent-stats screens whose
`cost_usd` contracts already exist (`contracts/observability.ts`) but have no
routes behind them. No extra model calls: cost rides along on the review call
that already happens.

## Where it shows

| Screen | What | Empty state |
|---|---|---|
| Pull Requests list | a `Cost` column between Status and Updated — cost of the **latest completed run** | `—` |
| PR Detail → Timeline | under the run's timestamp: `9,119 tok · $0.0013` | errored/running runs show nothing |
| Run Trace → Stats | a fourth tile beside DURATION / TOKENS / FINDINGS: `COST $0.060` | `—` |

`—` never becomes `$0.00`. An unknown model price means *unknown*, not *free*.

## Background — this is a revert, not a green field

Commit `d45ab0d` ("feat(reviews): remove per-PR/run cost, keep model pricing")
removed per-run cost end to end and migration `0009` dropped
`agent_runs.cost_usd`. Everything upstream of persistence survived and still
works today:

- `reviewer-core/src/llm/openrouter.ts` asks OpenRouter for the real generation
  cost (`usage: { include: true }`) and falls back to an injected estimator.
- `server/src/platform/price-book.ts` (live OpenRouter prices, 6 h TTL) over
  `server/src/adapters/llm/pricing.ts` (static table) is wired into the provider
  in `platform/container.ts`.
- `reviewer-core/src/review/run.ts` aggregates `costUsd` across map-reduce chunks
  and returns it on `ReviewOutcome` — one unknown chunk poisons the whole run to
  `null` on purpose.

The value already arrives at `run-executor.ts`, where it is destructured away.
Screens 2 and 3 restore what `d45ab0d` deleted; the PR-list column is new.

## Touches

**server:** `db/schema/runs.ts` (+ migration `0010`) · `modules/reviews`
(`run-executor.ts`, `repository.ts`, `repository/run.repo.ts`) ·
`modules/pulls` (`routes.ts`, `status.ts`) —
**client:** `lib/format-cost.ts`, `components/run-cost-badge/`, the PR-list
route, `RunHistory`, `RunTraceDrawer/TraceBody`, `messages/en/*` —
**reviewer-core:** nothing.

## Contract

Added to `@devdigest/shared` — **both vendored copies, same commit**
(`server/src/vendor/shared/`, `client/src/vendor/shared/`):

```ts
// contracts/trace.ts — restore the two fields d45ab0d removed
RunStats   = z.object({ …, cost_usd: z.number().nullable(), … });
RunSummary = z.object({ …, cost_usd: z.number().nullable(), … });

// contracts/platform.ts — new, alongside `score` (the same list-only rollup shape)
PrMeta     = z.object({ …, cost_usd: z.number().nullish() });
```

## Steps

1. **Contract** — the three fields above, mirrored into both vendored trees.
2. **Schema + migration** — `costUsd: doublePrecision('cost_usd')` on `agentRuns`;
   generate `0010` with `pnpm db:generate` (never hand-write a migration, never
   edit an applied one).
3. **Persist** — `completeAgentRun` takes `costUsd`; `run-executor` passes
   `outcome.costUsd` on success, `null` on failure/cancel, and writes `cost_usd`
   into the `RunTrace.stats` document.
4. **Serve** — `listRunsForPull` maps the column into `RunSummary`;
   `GET /repos/:id/pulls` adds a latest-completed-run rollup, with the pure
   grouping (`latestCostByPr`) in `modules/pulls/status.ts` next to the existing
   PR-list helpers.
5. **Format** — `client/src/lib/format-cost.ts`: one adaptive `formatCostUsd`
   (`< $0.01` → 4 decimals, else 3, `null` → `—`, sub-`$0.0001` → `<$0.0001`)
   plus `formatTokensTotal`. The mockups' per-screen precision is deliberately
   not reproduced — one run must read the same everywhere.
6. **Component** — `client/src/components/run-cost-badge/` (cross-cutting, so
   `src/components/<kebab-case>/`), two variants: `compact` (`$0.014`) for the
   list cell, `detailed` (`9,119 tok · $0.0013`) for the timeline. Plain
   `tnum` text, not a `Badge` pill — the mockups draw inline text, and a pill
   would fight the Status badge beside it.
7. **Wire the three screens** — PR-list `GRID`/`COLUMN_KEYS`/`PRRow` cell (+ the
   header's right-align condition), the timeline's existing right-hand meta
   column, and a fourth `Stat` in `TraceBody`. Strings via `next-intl`
   (`common.cost.tokensSuffix`, `prReview.list.columns.cost`,
   `runs.trace.stat.cost`).

## Done when

- [ ] A finished review shows its cost on all three screens; a PR that was never
      reviewed shows `—` in the list, and an errored run shows no cost at all.
- [ ] An agent on a model with no known price shows `—` everywhere, never `$0.000`.
- [ ] `agent_runs.cost_usd` exists in the database (`\d agent_runs`) — the
      migration's exit code is not evidence on Windows.
- [ ] tests: **server-unit** (`contracts.test.ts` fixture, `latestCostByPr` in
      `pulls-status.test.ts`), **server-integration** (`reviews.it.test.ts` —
      `cost_usd` on `GET /pulls/:id/runs`, on the trace, and in the PR list),
      **client** (`RunCostBadge`, `PRRow`, `RunHistory`, `RunTraceDrawer`).
- [ ] `pnpm typecheck` passes in **both** `server/` and `client/` — that is the
      only thing keeping the two vendored contract copies honest.
