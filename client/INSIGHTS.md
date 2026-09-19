# Insights — client

Append-only. Format, sections and cross-package entries:
[../INSIGHTS.md](../INSIGHTS.md).

---

## What Works

### 2026-09-15 — the component-folder convention is the house style
**Symptom:** a new component as a single `.tsx` reads fine in isolation but
breaks every import assumption and makes the diff noisy for reviewers.
**Cause:** every component in `src/app/**/_components/` is a folder with
`<Name>.tsx` + `constants.ts` + `helpers.ts` + `styles.ts` + `index.ts` and a
colocated test. Consistency here is deliberate, not incidental.
**Rule:** copy the shape of a neighbouring folder before writing anything new.
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx:26`
and the five sibling files beside it

## What Doesn't Work

### 2026-09-18 — a capture-phase `scroll` listener closes the overlay it is protecting
**Symptom:** the findings popover could not be read to the bottom. The wheel
over its own scrollbar closed it instead of scrolling it.
**Cause:** an overlay anchored to a rect captured on open has to close when the
page behind it scrolls, and seeing a scrolling *ancestor* requires
`addEventListener("scroll", h, true)` — `scroll` does not bubble. Capture then
also delivers the overlay's own `overflowY: auto` scroll to the same handler.
**Rule:** in any close-on-scroll handler, bail out when `e.target` is the panel
or inside it, before closing. Guard with `e.target instanceof Node` — on a page
scroll the target is `document` or the window, and `Node.contains` throws on a
window.
**Where:** `src/components/findings-popover/useFindingsPopover.ts:120` (`onScroll`),
registered at `src/components/findings-popover/useFindingsPopover.ts:128`

### 2026-09-18 — a hover popover whose click *toggles* can never be opened by clicking
**Symptom:** clicking the severity chips on the PR timeline dismissed the
findings panel instead of opening it. Every single click, never the first one
you expect.
**Cause:** on a mouse, `mouseenter` always wins the race to `click` — the panel
is already open by the time the click lands, so a toggle reads the open state
and closes. The same handler is the only way in on touch, where nothing opens it
first, so it cannot simply be suppressed.
**Rule:** give the panel two open modes. A click on a closed panel opens it
*pinned*; a click on a panel the pointer opened *promotes* it to pinned; only a
click on an already-pinned panel closes. Pinned survives `mouseleave` and closes
on a second click, an outside `mousedown`, Escape or scroll.
**Where:** `src/components/findings-popover/useFindingsPopover.ts:105` (`toggle`),
`src/components/findings-popover/useFindingsPopover.ts:86` (`scheduleClose`, which
must bail out while pinned)

### 2026-09-17 — stripping markdown emphasis mangles the identifiers in a finding
**Symptom:** the PR-list hover preview rendered `sk_live_` as `sklive` and
`__dirname` as `dirname`, so the preview named a symbol that does not exist.
**Cause:** the flattener stripped `[*_~>#]` wholesale to remove emphasis markers.
Underscore is a markdown emphasis character, but it is also half the identifiers
a code review talks about.
**Rule:** when flattening a finding's `rationale` for display, strip `*` and `~`,
strip `>` and `#` only at the start of a line, and leave `_` alone. Underscore
emphasis is rare in these rationales; mangled identifiers are not.
**Where:** `client/src/lib/finding-format.ts:27` (`shortRationale`)

### 2026-09-16 — a shared component's `common` strings break colocated tests silently
**Symptom:** after `RunCostBadge` (which calls `useTranslations("common")`) was
dropped into the timeline row, `RunHistory.test.tsx` still passed — while
printing `MISSING_MESSAGE: Could not resolve 'common' in messages for locale
'en'` to stderr and rendering the raw key instead of the value.
**Cause:** each colocated test builds its own `NextIntlClientProvider` with
only its page's namespace (`messages={{ prReview: messages }}`). next-intl
logs a missing namespace rather than throwing, so the suite stays green on a
component that renders wrongly.
**Rule:** when a `src/components/<shared>/` component translates through a new
namespace, add that namespace to every existing test provider that renders it,
and assert the rendered string — a passing suite is not evidence here. Watch
the stderr of `pnpm test`, not just its exit code.
**Where:** `client/src/components/run-cost-badge/RunCostBadge.tsx:30`,
`client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx:44`

## Codebase Patterns

### 2026-09-17 — overlays are in-tree `position: fixed`; there is no portal anywhere
**Symptom:** an absolutely-positioned panel inside a PR-list row is clipped — the
list's `s.tableCard` sets `overflow: hidden`.
**Cause:** `overflow` clips absolutely-positioned descendants, but not fixed ones:
a fixed element's containing block is the viewport unless an ancestor sets
`transform` / `filter` / `perspective` / `will-change` / `contain`. Nothing on
this page does.
**Rule:** position an overlay `fixed` from the trigger's `getBoundingClientRect()`
rather than reaching for `createPortal` — `grep -rn createPortal client/src`
returns nothing, and `lib/toast.tsx`, `vendor/ui/kit/Drawer.tsx` and `Modal.tsx`
are all in-tree fixed. Two consequences to handle: close the overlay on `scroll`
(capture) and `resize`, since a captured rect goes stale; and if anyone ever adds
a `transform` to a wrapper (a page transition would), fixed overlays inside
`tableCard` start being clipped again.
**Where:** `client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/helpers.ts:32`
(`panelPosition`), `client/src/app/repos/[repoId]/pulls/styles.ts:90` (`tableCard`)

### 2026-09-17 — a count shown above a filtered list must be taken mid-pipeline
**Symptom:** with "Hide low confidence" on, the severity pill read `3 WARNING`
above a single warning card.
**Cause:** the tally was computed from the raw `findings` prop, while the cards
below came from `visibleFindings(findings, hideLow)`.
**Rule:** in `FindingsPanel` the order is fixed: confidence filter →
`countBySeverity` → severity filter. The pill's number is a promise about what is
rendered below it, so it has to be counted from the same array. For the same
reason the active severity is *derived* (`counts[sev] > 0 ? sev : null`) rather
than stored — hiding low confidence can empty the bucket a stored filter points
at, stranding the panel on an empty list.
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:43`

### 2026-09-15 — `src/vendor/shared` is a copy, not a link
**Symptom:** the API returns a field the client types say does not exist.
**Cause:** the contracts are vendored per package and aliased by tsconfig
`paths`; nothing keeps the two trees in sync automatically.
**Rule:** mirror every contract edit into `server/src/vendor/shared` and
typecheck both packages.
**Where:** `client/tsconfig.json:22` (`paths`)

## Tool & Library Notes

### 2026-09-17 — there is no `@testing-library/user-event`; use `fireEvent`
**Symptom:** `import userEvent from "@testing-library/user-event"` fails the whole
test file to collect with `Failed to resolve import`.
**Cause:** the client only has `@testing-library/react` and
`@testing-library/jest-dom`. Every existing interaction test drives the DOM with
`fireEvent` (`FindingCard.test.tsx`, `RunTraceDrawer.test.tsx`).
**Rule:** reach for `fireEvent`, not `userEvent`. Installing it is not a shortcut
— it would rewrite `client/pnpm-lock.yaml`, and the repo rule is that a lockfile
changes only in a commit whose subject is that dependency change. For hover
timing use `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(ms))`.
**Where:** `client/package.json:28`,
`client/src/app/repos/[repoId]/pulls/_components/FindingsCell/FindingsCell.test.tsx:21`

## Recurring Errors & Fixes

### 2026-09-17 — "Updating a style property during rerender (borderColor)"
**Symptom:** React logs `Updating a style property during rerender (borderColor)
when a conflicting property is set (borderLeftColor)` to **stderr** while the
suite stays green. It only appears once something rerenders the component with a
changed value, so it can sit latent for months.
**Cause:** `borderColor` and `borderWidth` are themselves shorthands over the four
sides. Pairing either with a `borderLeft*` longhand in the same style object is
the shorthand/longhand mix React warns about — the existing comment claiming
"all-longhand" was wrong.
**Rule:** when a style object needs one side to differ, write all four sides
(`borderTopColor`/`borderRightColor`/`borderBottomColor`/`borderLeftColor`), never
`borderColor` plus one side. Same for width.
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/styles.ts:15`

## Open Questions

*(nothing yet)*

## Session Notes

- 2026-09-16 — added the Cost column to the PR list, tokens+cost to the
  timeline row and the COST tile back to the run trace (L01). One shared
  component, `src/components/run-cost-badge/`, plus `src/lib/format-cost.ts`.
- 2026-09-17 — findings by severity (L02): shared `src/components/severity-chips/`
  drives three surfaces — the PR list's Findings column, the timeline tiles and a
  clickable filter row in the expanded run card. Plus a hand-built hover popover
  (`FindingsCell` + `FindingsPopover` + `FindingPreview`) and `lib/finding-format.ts`.
  The finding action label is now "Reject"; the action kind behind it is still
  `dismiss`.
- 2026-09-18 — extended the findings preview to the PR detail timeline (L02
  follow-up): the panel, the finding row and the open/close hook moved to
  `src/components/findings-popover/`, the PR list's `FindingsPopover` became a
  thin `usePrReviews` wrapper around it, and `RunFindingsChips` gives every
  timeline tile the same preview from findings `FindingsTab` already holds. A
  click now pins the panel open on both surfaces, which is also the touch
  fallback `client/specs/findings-popover-touch-fallback.md` planned.
