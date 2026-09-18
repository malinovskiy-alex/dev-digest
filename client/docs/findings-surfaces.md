# Where findings appear, and where each surface gets them

A finding shows up on four surfaces. They look similar and are fed differently,
which is the thing that trips people up: two of them share a query, one derives
from another's data, and one is a separate rollup on the list endpoint.

| Surface | Component | Data source |
|---|---|---|
| PR list → `Findings` cell | `pulls/_components/FindingsCell/` | `PrMeta.findings` from `usePulls` |
| PR list → hover popover | `pulls/_components/FindingsPopover/` | `usePrReviews(prId)`, fetched on open |
| PR detail → Timeline tile | `pulls/[number]/_components/RunHistory/` | derived in `FindingsTab` from `usePrReviews` |
| PR detail → Review runs card | `pulls/[number]/_components/FindingsPanel/` | `usePrReviews`, already in memory |

Everything except the list cell ultimately comes from **one query**,
`usePrReviews(prId)` → `GET /pulls/:id/reviews` → `ReviewRecord[]` with
`findings` embedded. `client/src/lib/hooks/reviews.ts` owns it.

## The list cell is a rollup, not the findings

`PrMeta.findings` is `{ CRITICAL, WARNING, SUGGESTION }` and nothing more — the
counts of the **latest** review, computed server-side. The cell never has finding
*text*; it cannot, because the list response deliberately does not carry it.
See [`../../server/docs/pr-list-rollups.md`](../../server/docs/pr-list-rollups.md).

## The popover shares the detail page's cache

`FindingsPopover` mounts only while open, so mounting **is** the fetch. Its query
key is `["reviews", prId]` — the same key the PR detail page reads. Hovering a
row therefore pre-warms the click that usually follows it, and with the app's
`staleTime: 30_000` (`lib/providers.tsx`) re-hovering the same row is free.

This is why there is no `/findings/preview` endpoint: a bespoke one would fill a
separate cache key and do the work twice.

## The timeline joins reviews to runs on the client

`FindingsTab` holds both `runs: ReviewRecord[]` (from `usePrReviews`) and
`prRuns: RunSummary[]` (from `usePrRuns`). It builds `severityByRun` by joining
on `run_id` and passes the map to `RunHistory`.

`RunSummary` has `findings_count` but no severity split, and deliberately never
will: a column on `agent_runs` would need a migration, would leave every
historical run `null` with no backfill path, and would become a second source
that can drift from the numbers in the card below. A run whose review row was
deleted has no entry in the map and falls back to the old `N finding(s)` text.

## The run card is the only place findings are counted *and* filtered

`FindingsPanel` is mounted once per run card, which is what makes its filter
per-card without any keying or lifting. It is also the only component that knows
what is actually rendered, because it owns the "Hide low confidence" toggle —
hence the fixed order:

```
findings → visibleFindings(hideLow) → countBySeverity → severity filter → cards
```

The chip's number is a promise about the cards below it, so it must be counted
from the same array. And the active severity is **derived**, never stored:
hiding low confidence can empty the bucket the filter points at.

## What's shared, and what isn't

`src/components/severity-chips/` renders all three chip surfaces. Read-only
callers (list cell, timeline) get the vendored `<SeverityBadge compact>`; only a
caller passing `onToggle` gets buttons. It uses **no** `useTranslations` on
purpose — labels come from the `SEV` tokens — which keeps the most reused of
these components out of the next-intl missing-namespace trap in
[`../INSIGHTS.md`](../INSIGHTS.md).

`src/lib/finding-format.ts` holds `lineLabel` and `shortRationale`, shared by
`FindingCard` (detail page) and `FindingPreview` (popover) so neither reaches
past the other's `index.ts`.

## Accept / Reject lives in exactly one place

The expanded run card, on `FindingCard`. The popover previews are strictly
read-only — no buttons and no links, the latter because a focusable descendant in
a hover panel becomes a stray tab stop between two list rows. If you add a
control to a preview, `FindingPreview.test.tsx` fails, which is what it is for.

The button reads **Reject**; the action kind behind it, the `d` shortcut and the
route are all still `dismiss`.
