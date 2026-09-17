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
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/`

## What Doesn't Work

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
**Where:** `client/src/components/run-cost-badge/RunCostBadge.tsx`,
`client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx`

## Codebase Patterns

### 2026-09-15 — `src/vendor/shared` is a copy, not a link
**Symptom:** the API returns a field the client types say does not exist.
**Cause:** the contracts are vendored per package and aliased by tsconfig
`paths`; nothing keeps the two trees in sync automatically.
**Rule:** mirror every contract edit into `server/src/vendor/shared` and
typecheck both packages.
**Where:** `client/tsconfig.json`

## Tool & Library Notes

*(nothing yet)*

## Recurring Errors & Fixes

*(nothing yet)*

## Open Questions

*(nothing yet)*

## Session Notes

- 2026-09-16 — added the Cost column to the PR list, tokens+cost to the
  timeline row and the COST tile back to the run trace (L01). One shared
  component, `src/components/run-cost-badge/`, plus `src/lib/format-cost.ts`.
