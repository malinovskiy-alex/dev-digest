# Insights — server

Append-only. Format and cross-package entries: [../INSIGHTS.md](../INSIGHTS.md).

---

## 2026-09-15 — a DB test named `*.test.ts` poisons the unit suite
**Symptom:** the hermetic run (`--exclude '**/*.it.test.ts'`) suddenly needs
Docker, and `server-unit.yml` fails on a machine without it.
**Cause:** the suites are split purely by filename; a test importing
`test/helpers/pg.ts` under the wrong suffix lands in the unit set.
**Rule:** anything touching Postgres is `*.it.test.ts`. No exceptions.
**Where:** `server/README.md`, `.github/workflows/server-unit.yml`

## 2026-09-15 — modules are encapsulated, so registration order decides behaviour
**Symptom:** a route ignores the rate limit or misses a security header.
**Cause:** Fastify plugin encapsulation — a module registered before helmet /
cors / rate-limit / the error handler does not inherit them.
**Rule:** anything cross-cutting registers in `buildApp()` above the module loop.
**Where:** `server/src/app.ts`

## 2026-09-15 — boot-time run reaping assumes a single API instance
**Symptom:** with two API processes on one database, a live run on process A is
marked failed when process B boots.
**Cause:** the reaper treats every `running` row as orphaned, since a fresh
process has no in-flight runs of its own.
**Rule:** one API per database. Multiple replicas would need heartbeats or
per-instance scoping first.
**Where:** `server/src/app.ts`
