# Insights — cross-package

Append-only log of facts that cost someone time. Package-specific ones live in
`<pkg>/INSIGHTS.md`. Newest first. One entry per finding, this shape:

```
## YYYY-MM-DD — one-line title
**Symptom:** what you saw.
**Cause:** why it happens.
**Rule:** what to do from now on.
**Where:** path/to/file.ts
```

---

## 2026-09-15 — `@devdigest/shared` exists in two physical copies
**Symptom:** a contract change works in the API but the client still sends/reads
the old shape, with no type error anywhere.
**Cause:** `shared` is *vendored*, not linked — `server/src/vendor/shared/` and
`client/src/vendor/shared/` are separate trees, each aliased to
`@devdigest/shared` by its own tsconfig `paths`.
**Rule:** edit both copies in the same commit; typecheck both packages.
**Where:** `server/tsconfig.json`, `client/tsconfig.json`

## 2026-09-15 — migrations do not run on boot
**Symptom:** `relation "..." does not exist` on a fresh clone or after
`docker compose down -v`.
**Cause:** deliberate — `buildApp()` never migrates, so a dev process cannot
mutate a database schema by accident.
**Rule:** `cd server && pnpm db:migrate` before the first run and after every
schema change. pgvector is enabled by migration `0000`.
**Where:** `server/src/app.ts`

## 2026-09-15 — the packages are not a workspace
**Symptom:** `pnpm install` at the root does nothing useful; imports resolve in
the editor but not at runtime.
**Cause:** four standalone packages with four lockfiles; cross-package imports
work only through tsconfig `paths`, consumed as TypeScript source (tsx/vitest).
**Rule:** install and run inside each package directory.
**Where:** `README.md`
