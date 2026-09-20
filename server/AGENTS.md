# `@devdigest/api` — agent instructions

Fastify 5 + Drizzle/Postgres (pgvector) on `:3001`. Imports repos and PRs,
indexes them with `repo-intel`, runs the reviewer.

## Read before you act

These are **not** loaded for you. Read the file when its trigger matches.

| Read | When |
|---|---|
| [README.md](README.md) | before you change anything here — the API map, the request/DI flow diagram, the env table and the "review context" notes |
| [docs/](docs/README.md) | you need how a subsystem works in depth, beyond what the code shows |
| [specs/](specs/README.md) | you are about to build something that does not exist yet — write the plan there first |
| [INSIGHTS.md](INSIGHTS.md) | something behaves unexpectedly — check here **before** you start debugging |
| [src/modules/repo-intel/README.md](src/modules/repo-intel/README.md) | you are touching indexing, the repo map, or the **Indexed** badge |
| [../AGENTS.md](../AGENTS.md) | your change crosses a package boundary |

## Commands

```sh
pnpm dev          # tsx watch, :3001
pnpm db:migrate   # NEVER runs on boot — you run it
pnpm db:seed      # idempotent demo data
pnpm typecheck
pnpm test                                         # both suites
pnpm exec vitest run --exclude '**/*.it.test.ts'  # unit only, no Docker
pnpm exec vitest run .it.test                     # integration, needs Docker
```

## Conventions

- **Never construct an adapter with `new` inside a service.** Everything goes
  through the DI container (`src/platform/container.ts`) so tests can inject
  mocks via `ContainerOverrides`. Services depend on the port interfaces from
  `@devdigest/shared`, not on concrete classes.
- **Plugin order is load-bearing.** helmet / cors / rate-limit / SSE and the
  error handler register *before* the modules, because each module is an
  encapsulated Fastify plugin and only inherits what was registered earlier.
- **Adding a module:** create `src/modules/<name>/routes.ts` exporting a default
  Fastify plugin, then add one import + one entry to `src/modules/index.ts`.
  Registration is static on purpose — filesystem autoload of `.ts` is not
  portable across tsx, the bundler and vitest.
- **Validation is schema-first.** Declare zod `params`/`body`/response schemas on
  the route (`fastify-type-provider-zod`). Never hand-roll `Schema.parse(req.body)`
  in a handler — invalid input must fail with 422 before the handler runs.
- **Errors:** throw an `AppError` subclass (`src/platform/errors.ts`). The global
  handler renders the `{ error: { code, message, details } }` envelope; never
  build that envelope by hand.
- **Schema** lives in `src/db/schema/<domain>.ts`, re-exported by the
  `src/db/schema.ts` barrel. Every domain table carries `workspace_id` and every
  query scopes by it.

## Naming

- **Files are kebab-case**, named for what they do: `diff-loader.ts`,
  `run-executor.ts`, `repository.ts`. `index.ts` is a barrel or a registry —
  re-exports and wiring only, never business logic.
- **A leading underscore marks a folder or file that is not a module surface**:
  `src/modules/_shared/`, `src/db/schema/_shared.ts`. Nothing routes through
  them.
- **Schema files are one per domain**, named after it: `runs.ts`, `repos.ts`,
  `repo-intel.ts`.
- **Migrations keep the generated `NNNN_name.sql` form** and their order in
  `meta/_journal.json`. Never rename or renumber one that has been applied.
- **A test that touches Postgres must be named `*.it.test.ts`.** The suffix is
  what splits the suites and drives the two CI workflows; a DB test under any
  other name breaks the hermetic run. Integration tests start a real Postgres
  via testcontainers and self-skip when Docker is absent. Everything else is
  `*.test.ts`. Both live in `server/test/`, not beside the source.

## Do not touch

- `src/vendor/shared/` — a vendored copy of `@devdigest/shared`. Editing it means
  editing `client/src/vendor/shared/` in the same commit.
- An applied migration. New columns and tables get a new one.
- Secrets outside `SecretsProvider` — never `AppConfig`, the DB, or a committed `.env`.
- Another module's folder. Shared repositories are exposed on the container.

## Where things live

- app assembly, plugin order, error handler → `src/app.ts`
- DI composition root → `src/platform/container.ts`
- module registry → `src/modules/index.ts`
- a review run, start to finish → `src/modules/reviews/run-executor.ts`
  (prompt inputs are gathered in `runOneAgent`, same file)
- indexer facade → `src/modules/repo-intel/service.ts`

## Gotchas

- Stale `running` runs are reaped on boot and awaited before listening — this
  assumes **one API instance per database**.
- `repo-intel` context degrades **silently**: an unindexed repo yields an empty
  repo map and the review still runs, diff-only.
