# L02 — Findings by Severity

**Goal:** make severity the axis for scanning findings. A reviewer should be able
to tell a PR with two nits from one with two blockers without opening it, and
inside a run card should be able to narrow to one severity in a click.

**Not in scope:** changing what a severity *means*, re-scoring, any new model
call, and severity on the multi-agent / agent-stats screens (whose
`findings_by_severity` contracts already exist in `contracts/observability.ts`
but have no route behind them here). Counting is a group-by over findings the
page has already fetched.

## Where it shows

| Screen | What | Interactive? | Empty state |
|---|---|---|---|
| Pull Requests list → `Findings` column | compact severity chips, icon + count, for the **latest review** | hover previews; a click pins the preview open | `—` |
| …the popover | `N FINDINGS IN THIS RUN` + one read-only row per finding | no — **no buttons, no links** | "No findings in the latest run." |
| PR detail → Agent runs → Timeline tile | the same chips per run | the same preview, for **that** run | falls back to `N finding(s)` |
| PR detail → Agent runs → Review runs, expanded | pills `N CRITICAL · N WARNING · N SUGGESTION` under the verdict and PR SCORE | **yes** — click filters, click again clears | only present severities render |

`—` never becomes `0`. A severity with no findings is not drawn at all.

## The one correctness rule

The pill's number is a promise about the cards rendered below it. `FindingsPanel`
already owns a "Hide low confidence" toggle, so the order is fixed:

```
findings → visibleFindings(hideLow) → countBySeverity → severity filter → cards
```

Count the raw `findings` instead and switching the toggle on leaves a pill
reading `3 WARNING` above a single card. For the same reason the active severity
is **derived** (`counts[sev] > 0 ? sev : null`), never stored: hiding low
confidence can empty the bucket a stored filter points at, stranding the panel on
an empty list.

## Touches

**shared contracts** (vendored twice — `server/src/vendor/shared/` and
`client/src/vendor/shared/`, edited in the same commit):
`contracts/findings.ts` gains `SeverityCounts`; `contracts/platform.ts` gains
`PrMeta.findings`.

**server:** `modules/pulls/status.ts` (`rollupSeverities` re-keyed to the
`Severity` enum casing, `EMPTY_SEVERITY_COUNTS`) · `modules/pulls/routes.ts`
(a third "latest per PR" rollup beside score and cost).

**client:** `components/severity-chips/` (new, shared by three screens) ·
`components/findings-popover/` (new: the panel, the row inside it, and the
open/close hook, shared by the two surfaces that preview) ·
`lib/finding-format.ts` (new) · PR list `constants.ts` / `styles.ts` / `PRRow` ·
`pulls/_components/{FindingsCell,FindingsPopover}/` (new) ·
`pulls/[number]/_components/{FindingsPanel,FindingsTab,RunHistory,RunFindingsChips}/`.

## Decisions worth their reasoning

**The rollup reuses `rollupSeverities`, which was already written and tested but
wired nowhere.** Its keys were lowercase; they move to the `Severity` enum
verbatim so the client can index by severity without a mapping table. Safe
because nothing but its own unit test consumed it.

**Dismissed findings are counted.** The PR detail page still renders a dismissed
finding — greyed, but present — so the list column has to agree or the two pages
contradict each other. This is deliberately *not* `agent_runs.blockers`, which
excludes them because it is a CI-gate number.

**The timeline chips are derived on the client, not denormalized onto
`agent_runs`.** `FindingsTab` already holds both the reviews and the runs, and
joins them on `run_id`. A column would need a migration, would leave every
historical run `null` with no backfill path, and would create a second source
that can drift from the pills.

**The popover reads the existing `usePrReviews`, not a new endpoint.** The panel
only mounts while open, so mounting *is* the fetch — and its cache key
(`["reviews", prId]`) is the one the PR detail page reads, so hovering a row
warms the click that usually follows it. A bespoke `/findings/preview` would fill
a separate key and do the same work twice. Embedding previews in the list payload
was the third option; it would have added ~75 KB to a response that re-polls
every 60 s, to buy ~120 ms of hover latency.

**The timeline previews the same findings it counted, from memory.** The tile
already holds `severityByRun`; the preview takes `findingsByRun`, derived from
the same reviews in the same pass. There is nothing to fetch, and a tile
therefore cannot preview something other than what its chips counted. The panel
itself is the shared one — the list's popover is now only "where the findings
come from" wrapped around it.

**A click pins the panel; hover alone does not.** Hover opens after
`OPEN_DELAY_MS` and leaves with the pointer. A click on a panel the pointer
already opened *pins* it rather than toggling it shut — on a mouse, hover always
wins the race to open, so a plain toggle would make every click read as
"dismiss". A pinned panel closes on a second click, a click outside, Escape, or
scroll. This is also the touch fallback
([`../client/specs/findings-popover-touch-fallback.md`](../client/specs/findings-popover-touch-fallback.md)):
with no hover on a phone, the click path is the only way in.

**The popover is `position: fixed`, not a portal.** The list's table card is
`overflow: hidden`, which clips absolutely-positioned descendants but not fixed
ones. The repo contains no `createPortal` at all — toast, Drawer and Modal are
all in-tree fixed overlays. Cost: the panel must close on `scroll` and `resize`,
since it is anchored to a rect captured when it opened.

**`Dismiss` is relabelled `Reject`.** Label only — the action kind, the `d`
shortcut and `POST /findings/:id/dismiss` are untouched.

## Verification

Component tests carry the load; see `client/src/**/*.test.tsx`. The two that
matter most are the criterion guard in `FindingsPanel.test.tsx` (the pill says
`2 CRITICAL` **and** exactly two critical titles render) and the read-only
contract in `FindingPreview.test.tsx` (`queryAllByRole("button")` and
`queryAllByRole("link")` are both empty).

No e2e flow is added: this is component-level behaviour, and `e2e/CLAUDE.md`
routes that to the client suite. See
[`../e2e/docs/flow-or-component-test.md`](../e2e/docs/flow-or-component-test.md).

Manually, against a seeded stack: the severity filter must fire **zero** requests
to `:3001` — check the Network panel while toggling pills.
