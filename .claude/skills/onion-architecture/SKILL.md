---
name: onion-architecture
version: 1.0.0
description: "Onion architecture for the DevDigest backend (`server/`, `reviewer-core/`) — which ring a piece of code belongs to and which way its imports are allowed to point. Use this whenever adding or moving anything under `server/src`: a route, a service, a repository, a job, an adapter for an external API, a migration-backed feature; when a `service.ts` or `routes.ts` is growing; when deciding whether logic belongs in the route, the service, the repository or `reviewer-core`; when a test needs a real database to run; when `pnpm arch` fails; or whenever the question is 'where should this backend code go?' — including when the user only says 'add an endpoint', 'wire up this API', or 'refactor this module'. Not for Fastify feature mechanics (use fastify-best-practices), query syntax (use drizzle-orm-patterns) or schema design (use postgresql-table-design)."
---

# Onion Architecture (backend)

This skill answers one question: **which ring does this code belong to, and
which way is it allowed to import?**

It is scoped to `server/` (`@devdigest/api` — Fastify 5, Drizzle, Postgres) and
`reviewer-core/` (`@devdigest/reviewer-core` — the pure review engine). The
rules below are the reasoning; `server/AGENTS.md` is the terse statement of them
and loads on its own when you touch a file there.

The rings are **logical**. There are no `domain/`, `application/` or
`infrastructure/` folders and there will not be — the existing
`src/modules/<name>/` layout already encodes them in file *names*, and
`server/.dependency-cruiser.cjs` is what makes them real.

## Read this, not that

Structure is one axis of backend quality. Stay in your lane so the skills do not
contradict each other:

| Question | Where it is answered |
|---|---|
| Which ring does this go in? Which way may it import? | **this skill** |
| Hooks, lifecycle, plugin options, serialization, logging | `fastify-best-practices` |
| How do I write this query / relation / transaction? | `drizzle-orm-patterns` |
| What type, index or constraint should this column have? | `postgresql-table-design` |
| How do I shape this schema, refine it, infer its type? | `zod` |
| Is this input handling safe? Where do secrets live? | `security` |
| The exact folder and file names to type | `server/AGENTS.md` |

When this skill and `server/AGENTS.md` disagree, **AGENTS.md wins** — it is the
project's contract. Say so rather than silently picking one.

## The rule

> **Imports point inward.** A ring may import the rings inside it and nothing
> outside it. When an inner ring needs outer behaviour, it declares an
> **interface** and the composition root supplies the implementation.

That is the whole architecture. Everything below is this rule applied to the
tools we actually use.

## The four rings

| Ring | What lives there | May import | Must never import |
|---|---|---|---|
| **1 · Domain** | `reviewer-core/src/**`, `modules/*/helpers.ts`, contracts in `@devdigest/shared` | `zod`, stdlib, other Ring 1 | `fastify`, `drizzle-orm`, `src/db/*`, `src/adapters/*`, any SDK, `process.env` |
| **2 · Application** | `modules/*/service.ts`, `reviews/run-executor.ts`, `repo-intel/pipeline/*`, job handlers | Ring 1, **port interfaces**, its own repository | `fastify`, `drizzle-orm`, `src/db/schema`, concrete adapter classes |
| **3 · Infrastructure** | `src/adapters/*`, `src/db/*`, `modules/*/repository*.ts`, `platform/{container,config,jobs,sse,prompts}.ts` | Rings 1–2, third-party SDKs | another module's folder |
| **4 · Transport** | `modules/*/routes.ts`, `src/app.ts`, `src/server.ts` | Ring 2 services, contracts, `modules/_shared/*` | `drizzle-orm`, `src/db/schema`, `src/adapters/*` |

`src/platform/` is not a ring — it is split across them. The pure files
(`errors.ts`, `resilience.ts`, `structured.ts`, `grounding.ts`, `model-router.ts`,
`prompt.ts`, `trace-builder.ts`) are Ring 1 and import nothing but contracts; the
ones that own a process resource (`container.ts`, `config.ts`, `jobs.ts`,
`sse.ts`, `prompts.ts`) are Ring 3. Check the imports before adding a file there.

`reviewer-core` is the reference implementation of Ring 1: its first invariant is
**zero I/O**, and everything it needs — skill bodies, memory, specs — arrives as
already-resolved strings. When you are unsure how pure Ring 1 should be, open it.

## The decision procedure

Ask these in order and stop at the first yes. The question is never "what kind of
thing is this?" — it is **"what does it need in order to run?"**

1. **Can it be computed from its arguments alone?** → Ring 1. `helpers.ts` in the
   module, or `reviewer-core` if the engine needs it too. No `async`, no clients.
2. **Does it orchestrate — call a port, then a repository, then decide?** →
   Ring 2, `service.ts`. It takes `workspaceId`, `userId` and DTOs.
3. **Does it talk SQL, HTTP, the filesystem or an SDK?** → Ring 3. SQL goes in
   `repository.ts`; anything external goes behind a port in
   `src/vendor/shared/adapters.ts` with its implementation in `src/adapters/`.
4. **Does it read the request or write the response?** → Ring 4, `routes.ts`.
   Parsing, status codes, delegation. Nothing else.

Two rules keep this honest:

- **The narrowest ring that works wins.** Code drifts outward on its own; it
  never drifts back in.
- **A ring boundary is crossed by a type, not just by a call.** Handing a Drizzle
  row to Ring 1 moves persistence into the domain even though no `import
  drizzle-orm` appears. See "What may cross a boundary" below.

## The shape of a module

A module is a folder under `src/modules/`, and its **file names are its rings**:

```
modules/<name>/
  routes.ts        # Ring 4 — default Fastify plugin, the module's only export
  service.ts       # Ring 2 — business logic, one class
  repository.ts    # Ring 3 — the only file that touches this module's tables
  helpers.ts       # Ring 1 — pure functions
  constants.ts     # literals, job kinds, limits
  types.ts         # module-local types (only when they outgrow the files above)
```

Add a file when it has content; never inline it back afterwards. A reader who has
seen one module can navigate every other one.

**Registration is static.** A new module is one import plus one entry in
`src/modules/index.ts`. Filesystem autoload of `.ts` is not portable across tsx,
the bundler and vitest — do not reintroduce it.

**A module never reaches into a sibling module's folder.** Shared repositories
hang off the container (`container.agentsRepo`, `container.reviewRepo`); shared
request plumbing lives in `modules/_shared/`. `pnpm arch` enforces this.

## Dependency injection, concretely

The container (`src/platform/container.ts`) is the **composition root** — the one
place allowed to say `new` on an adapter. Everything else receives what it needs.

**The target shape for a service** is explicit dependencies:

```ts
export class RepoService {
  constructor(private deps: {
    repos: RepoRepository;
    git: GitClient;         // port, not SimpleGitClient
    jobs: JobRunner;
    secrets: SecretsProvider;
  }) {}
}
```

Write new services this way. Most existing ones instead take the whole
`Container` and build their own repository — that is a service locator, it forces
every unit test to construct a full container, and it is what produces the
`container.ts ⇄ repo-intel/service.ts` import cycle in the baseline. It is
recorded as debt in `server/specs/onion-debt.md`; **do not mass-refactor it**,
and do not copy it into a new module.

The one accepted exception: a service may `new` **its own** module's repository.
A repository has no port and no mock — it is swapped by pointing it at a
different `Db`. Adapters are different: they are swapped through
`ContainerOverrides`, so they must arrive already built.

**Adding an integration with an external service, in order:**

1. Declare the port — an interface in `src/vendor/shared/adapters.ts`, described
   in terms of *our* domain, not the vendor's. Mirror the change into
   `client/src/vendor/shared/` in the same commit; `@devdigest/shared` is
   vendored twice and silently drifts otherwise.
2. Implement it in `src/adapters/<vendor>/`. This file may import the SDK; nobody
   else may.
3. Add a lazy getter on the container plus a field on `ContainerOverrides`.
4. Inject the port into the service. The service names the capability
   (`GitHubClient`), never the vendor (`OctokitGitHubClient`).

Secrets are resolved inside the container through `SecretsProvider` and never
reach `AppConfig`, the database or git.

## What may cross a boundary

| Crossing | Allowed | Why |
|---|---|---|
| Route → service | DTO validated by a Zod schema, plus `workspaceId`/`userId` | the service must be callable by the job runner, which has no request |
| Service → repository | domain values and narrow input objects | keeps SQL construction in one file |
| Repository → service | a domain object, or a row type named in `src/db/rows.ts` | a shared row type has one home next to the schema |
| Repository → anywhere | a query builder, a transaction handle, a `PostgresError` | leaking these makes every caller a Drizzle caller |
| Anything → Ring 1 | `typeof schema.x.$inferSelect` written inline | this is the leak that `core-no-io` catches |

The last row is the mistake this codebase actually makes. `src/db/rows.ts` exists
precisely so a cross-cutting consumer can name a row shape without importing
another module's data layer — and the better fix is usually to hand Ring 1 the
**domain** type (`Repo`) and leave the row→DTO mapper in the repository, which
already owns the row.

## Background work and streaming

- A job handler is Ring 2. Register it in the service
  (`jobs.register(KIND, …)`), give the payload an exported interface, and keep
  the kind string in `constants.ts`. A route enqueues; it never runs the work.
- The SSE bus (`platform/sse.ts`) is Ring 4. A service publishes a domain event
  to it; it does not know a browser is listening.
- Anything long-running checks cancellation at the same place `reviewer-core`
  does — before the next expensive step, not after it.

## Errors

Throw an `AppError` subclass from `src/platform/errors.ts` in whatever ring
notices the problem. The global handler in `src/app.ts` renders the
`{ error: { code, message, details } }` envelope — never build that envelope by
hand, and never `reply.status(...).send({ error: ... })` in a handler. Ring 1 and
Ring 2 throw; Ring 4 maps.

## Tests prove the architecture

| The test needs | What that means |
|---|---|
| nothing but the module | Ring 1 — plain `*.test.ts` |
| mocks passed to a constructor or `ContainerOverrides` | Ring 2 — plain `*.test.ts` |
| a real Postgres (testcontainers) | Ring 3 — the file **must** be named `*.it.test.ts` |

If a unit test of a *service* needs Postgres, the service is reaching into Ring 3
— fix the dependency, not the test. The `*.it.test.ts` suffix is what splits the
two CI workflows; a DB test under any other name breaks the hermetic run.

## Enforcement

```sh
pnpm arch            # fails on any NEW boundary violation
pnpm arch:all        # shows the grandfathered debt too
pnpm arch:baseline   # rewrite the baseline — only ever to REMOVE entries
```

`server/.dependency-cruiser.cjs` holds the rules; every one is `error`. The 21
violations that exist today are grandfathered in
`.dependency-cruiser-known-violations.json`, so the check is green on a clean
tree and red the moment you add a new one. **Never regenerate the baseline to
make your own violation disappear** — if a rule is wrong, change the rule and say
why in the commit.

A failure names the rule; `references/enforcement.md` has the fix for each one.

## When not to do this

Onion turns into cargo cult fast. In this codebase, do **not**:

- create a class per use case (`AddRepoUseCase`) — our services hold 5–7 methods
  and that is the right size;
- write a row→domain mapper when the shapes are identical;
- add a port for something with one implementation that no test ever swaps —
  promote to a port on the second implementation, not the first;
- split a module into ring folders because it grew; split it by **subject**
  (`reviews/repository/{pull,review,run}.repo.ts` is the pattern already here);
- "fix" the grandfathered debt as a side effect of an unrelated change. One
  boundary, one commit, and update `server/specs/onion-debt.md`.

## Further reading

- `references/rings.md` — the full folder map, what each ring owns, promotion examples.
- `references/tooling.md` — the rules per tool: Fastify, Drizzle, Zod, DI, jobs, tests.
- `references/enforcement.md` — every `pnpm arch` rule, what it catches, how to fix it.
- `examples.md` — before/after pairs taken from real files in this repository.
- `server/specs/onion-debt.md` — the 21 grandfathered violations and their recipes.
