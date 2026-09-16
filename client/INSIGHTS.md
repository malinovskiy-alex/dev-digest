# Insights — client

Append-only. Format and cross-package entries: [../INSIGHTS.md](../INSIGHTS.md).

---

## 2026-09-15 — the component-folder convention is the house style
**Symptom:** a new component as a single `.tsx` reads fine in isolation but
breaks every import assumption and makes the diff noisy for reviewers.
**Cause:** every component in `src/app/**/_components/` is a folder with
`<Name>.tsx` + `constants.ts` + `helpers.ts` + `styles.ts` + `index.ts` and a
colocated test. Consistency here is deliberate, not incidental.
**Rule:** copy the shape of a neighbouring folder before writing anything new.
**Where:** `client/src/app/repos/[repoId]/pulls/[number]/_components/`

## 2026-09-15 — `src/vendor/shared` is a copy, not a link
**Symptom:** the API returns a field the client types say does not exist.
**Cause:** the contracts are vendored per package and aliased by tsconfig
`paths`; nothing keeps the two trees in sync automatically.
**Rule:** mirror every contract edit into `server/src/vendor/shared` and
typecheck both packages.
**Where:** `client/tsconfig.json`
