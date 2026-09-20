# Enforcement

The rules are not advice. `server/.dependency-cruiser.cjs` turns each one into a
build failure, and `dependency-cruiser` was already a dependency of the server
(the `depgraph` adapter uses its `cruise()` API for the repo-intel import graph),
so this costs no new package.

```sh
cd server
pnpm arch            # fails on any NEW violation          ← the one to run
pnpm arch:all        # also prints the grandfathered debt
pnpm arch:baseline   # rewrite the baseline — only to REMOVE entries
```

## How the baseline works

Every rule has `severity: 'error'`. The 21 violations that exist today are
recorded in `server/.dependency-cruiser-known-violations.json` and ignored by
`pnpm arch`. So:

- on a clean tree the check is **green**;
- the moment you add a new violation it is **red**, with the rule name and the
  exact edge;
- the debt is a committed, countable list instead of a `warn` nobody reads.

**Never run `pnpm arch:baseline` to make your own violation disappear.** The
baseline shrinks; it does not grow. If a rule is genuinely wrong, change the rule
and say why in the commit message — that is a reviewable decision, a regenerated
baseline is not.

## The rules

### `core-no-io` — Ring 1 must not touch I/O
**From** `reviewer-core/src/**`, `modules/*/helpers.ts`
**To** `drizzle-orm`, `src/db/*`, `src/adapters/*`, `fastify`, `postgres`, `octokit`, `simple-git`, `openai`, `@anthropic-ai/*`, and the stateful `platform` files

Catches a pure helper that grew a dependency. Almost always a *type* import of a
Drizzle row, not a real call.

**Fix:** hand the helper the domain type and move the row→DTO mapping into the
repository. If it truly needs I/O, it was never a helper — move it to
`service.ts`.

*Live: 1 — `modules/repos/helpers.ts → db/schema.ts` (`toRepoDto` takes a row).*

### `app-no-drizzle` — Ring 2 does not speak SQL
**From** `modules/*/{service,run-executor,diff-loader,findings,status}.ts`, `modules/*/pipeline/*`
**To** `src/db/schema`

**Fix:** move the query into the module's `repository.ts`. When it is only a row
*type*, name it in `src/db/rows.ts` and import that instead.

*Live: 2 — `reviews/run-executor.ts` and `reviews/diff-loader.ts`, both for
`typeof schema.repos.$inferSelect`.*

### `app-no-fastify` — Ring 2 does not know it is behind HTTP
**From** the same Ring 2 set **To** `fastify`

**Fix:** the service takes `workspaceId`, `userId` and DTOs. Extract them in the
route with `getContext(container, req)`.

*Live: 0 — currently clean. Keep it that way.*

### `routes-no-db` — Ring 4 must not query
**From** any `routes.ts` **To** `src/db/schema`

**Fix:** create `service.ts` for the module (and `repository.ts` if it has none),
move the query down, leave the route with one service call. A module without a
service is not exempt — it is the reason the rule fires.

*Live: 4 — the `pulls`, `settings`, `workspace` and `polling` routes.*

### `no-concrete-adapters` — only the composition root builds adapters
**From** `src/modules/**` **To** `src/adapters/*`

**Fix, pick one:**
- the import is a **pure function** (`git/diff-parser.ts`) → move the file into
  Ring 1; it is not an adapter at all;
- the import is a **real adapter** (`astgrep`, `codeindex`) → put its interface
  in `src/vendor/shared/adapters.ts`, add a container getter and a
  `ContainerOverrides` field, inject it;
- the import is an **interface that happens to live beside its implementation**
  (`DepGraph`, `Tokenizer`) → move the interface to `adapters.ts`.

*Live: 8 — `repo-intel/service.ts`, the three `repo-intel/pipeline/*` files, and
`reviews/diff-loader.ts`.*

### `no-cross-module` — a module never reaches into a sibling
**From** `src/modules/<a>/` **To** `src/modules/<b>/` where `b ∉ {a, _shared}`
(the `$1` backreference in `pathNot` is what makes "same module" work)

**Fix:** a shared repository or service goes on the container; a shared schema or
helper goes in `modules/_shared/`; a job kind two modules agree on is a contract
and belongs in `_shared/` too.

*Live: 1 — `repos/service.ts → repo-intel/constants.ts` for the indexer job kinds.*

### `no-circular` — no import cycles
**From** anything **To** itself, transitively

A cycle is nearly always a ring inversion: an inner file importing an outer one
that imports it back.

**Fix:** the two live cycle families show both shapes —
- `container.ts ⇄ repo-intel/service.ts` (× 4 paths): the service takes the whole
  `Container`, and the container constructs the service. Injecting explicit
  dependencies removes it.
- `agents/helpers.ts ⇄ agents/repository.ts`: the helper imports row types *from
  the repository* while the repository imports `isConfigChange` from the helper.
  Importing the rows from `src/db/rows.ts` — where they already are — breaks it.

*Live: 5.*

### `not-to-unresolvable` — every import must resolve
Catches a broken path alias or a missing extension. The config points
dependency-cruiser at `tsconfig.json` so the `@devdigest/*` aliases resolve.

*Live: 0.*

## Review checklist

`pnpm arch` sees import direction. It does **not** see logic that moved rings
without moving an import — for that, read the diff and ask:

1. **Does any route handler make a decision?** A branch on domain state, a
   default value, a second write — that is a service method that has not been
   written yet.
2. **Does any service signature mention HTTP, SQL or a vendor?** `req`, `tx`,
   `Octokit`, a model id string that was not passed in.
3. **Did a new type appear in two rings at once?** A row shape in a helper
   signature is the usual one.
4. **Could this service be called from a job?** If not, something request-shaped
   leaked in.
5. **Does the new test need Docker?** If the subject is a service, the answer
   should be no.

## CI

`pnpm arch` is **not** in the CI workflows yet — by decision, it goes in once the
baseline is empty, so the pipeline never carries a permanently-ignored list. Run
it locally alongside `pnpm typecheck` before you push. When the last entry is
cleared, delete the baseline file and add the step next to typecheck in both
workflows.
