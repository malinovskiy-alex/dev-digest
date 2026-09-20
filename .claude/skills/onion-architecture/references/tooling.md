# The rings, per tool

Every tool in the backend either helps the dependency rule or quietly breaks it.
This file is the ruling for each one, with the reason attached — a rule whose
"why" is missing gets "fixed" by the next person.

---

## Fastify 5

Fastify is Ring 4 and stays there. The framework is genuinely good at plugin
encapsulation, which is what makes a module a module — but its conveniences
(`decorate`, `request`-scoped state, hooks) all pull logic outward.

**1. A route handler does four things and no more:** read the validated input,
resolve the request context, call one service method, map the status code.

```ts
app.post('/repos', { schema: { body: RepoInput } }, async (req, reply) => {
  const { workspaceId, userId } = await getContext(app.container, req);
  const { repo, created } = await service.add(workspaceId, userId, req.body.url);
  reply.status(created ? 201 : 200);
  return repo;
});
```

If a handler has a second `await` on something that is not a service, the logic
it is expressing belongs in the service.

**2. `FastifyRequest` never crosses into Ring 2.** `getContext(container, req)`
in `modules/_shared/context.ts` is the *only* place a service's inputs are
extracted from a request, and it hands back plain `{ workspaceId, userId }`.
Passing `req` into a service couples the use case to HTTP and makes it
uncallable from the job runner.

**3. One module, one encapsulated plugin, registered statically.** A new module
is `src/modules/<name>/routes.ts` exporting a default plugin, plus one import and
one entry in `src/modules/index.ts`. Do not reintroduce filesystem autoload — it
is not portable across tsx, the bundler and vitest.

**4. Plugin order is part of the architecture.** helmet, cors, rate-limit, SSE
and the error handler register in `src/app.ts` *before* the modules, because an
encapsulated plugin inherits only what was registered earlier. Registering a
module before a security plugin silently un-protects it.

**5. `app.decorate` is for the container and nothing else.** `src/app.ts:68`
decorates exactly one thing: `container`. Decorating services, repositories or
request-scoped helpers turns Fastify into the DI container and makes every
consumer reachable only through a live server.

**6. Fastify's error handler owns the error envelope.** See *Errors* below.

---

## Drizzle + Postgres

Drizzle is a typed query builder, not a repository. It is excellent Ring 3 and
catastrophic anywhere else — because its types are *so* convenient that a row
shape spreads through the codebase without a single `import drizzle-orm`.

**1. `drizzle-orm` is importable from `src/db/**` and `*/repository*.ts` only.**
Enforced by `app-no-drizzle` and `routes-no-db`.

**2. The repository is the only file that knows its tables.** `RepoRepository`
says it in its own header: "the ONLY place that touches the `repos` table". One
module's repository never queries another module's tables — that is what
`container.agentsRepo` / `container.reviewRepo` are for.

**3. Nothing Drizzle-shaped leaves a repository.** No query builder, no
`tx` handle, no `PostgresError`. Return a domain object, or a row type that is
named in `src/db/rows.ts`. A repository that returns a partially-built query has
made every caller a Drizzle caller.

**4. Row types have exactly one home.** Writing `typeof schema.repos.$inferSelect`
in a service or a helper is the leak this codebase actually has — it is four of
the nine `error`-level entries in the baseline. Two escalating fixes:

```ts
// worse — Ring 1/2 file importing the schema barrel for a type
import * as schema from '../../db/schema.js';
function toRepoDto(row: typeof schema.repos.$inferSelect): Repo { … }

// better — the row type is named once, next to the schema
import type { RepoRow } from '../../db/rows.js';
function toRepoDto(row: RepoRow): Repo { … }

// best — Ring 1 never sees a row; the repository maps on the way out
import type { Repo } from '@devdigest/shared';
function summarize(repo: Repo): string { … }
```

Reach for "best" when you are already editing the file; "better" is the minimum.

**5. Transactions are an application decision executed in infrastructure.** The
service decides what must be atomic; the repository exposes one method that runs
it in a `db.transaction`. A service that opens a transaction and passes `tx`
around has inverted the ring.

**6. `workspace_id` scoping is a domain rule that lives in Ring 3.** Every domain
table carries it and every query filters by it. This is the strongest single
argument against routes querying directly: one forgotten `.where(eq(…workspaceId))`
in a route is a cross-tenant leak that no test in another module will catch.

**7. Migrations are never applied on boot.** `pnpm db:migrate` is yours to run,
an applied migration is immutable, and a new column gets a new migration file
keeping the generated `NNNN_name.sql` name and its `meta/_journal.json` order.

---

## Zod and the contracts

Zod sits in Ring 1, and it is the reason this codebase can skip a separate DTO
layer: the contract *is* the domain type.

**1. Validation is schema-first and declarative.** Declare `params` / `body` /
response schemas on the route via `fastify-type-provider-zod`. Never hand-roll
`Schema.parse(req.body)` inside a handler — invalid input must fail with 422
before the handler runs, and a hand-rolled parse produces a 500 instead.

**2. The contract is the boundary type.** `Repo`, `Finding`, `Review`,
`Verdict`, `PrMeta` come from `@devdigest/shared` and are what crosses every
ring boundary. `reviewer-core` never redefines them locally.

**3. `@devdigest/shared` is vendored twice.** `server/src/vendor/shared/` and
`client/src/vendor/shared/`. Editing one without the other in the same commit
makes request validation and the client's types disagree silently. This applies
to the port interfaces in `adapters.ts` too — they live in the same vendored
tree.

**4. Do not grow a second contract layer.** If a route needs a narrower shape,
derive it (`.pick()`, `.omit()`) next to the route. A parallel
`dto/` folder duplicating the contracts is how the two drift.

---

## The container and dependency injection

`src/platform/container.ts` is the composition root: config, `Db`, the
`JobRunner`, the SSE bus, and every adapter behind a lazy getter.

**1. `new` on an adapter happens here and nowhere else.** The container caches
it, resolves its secret through `SecretsProvider`, and `ContainerOverrides` lets
a test replace it. A service that constructs `new OctokitGitHubClient(token)`
cannot be tested without a network.

**2. A service takes its dependencies, not the container.**

```ts
// target — the constructor is the dependency list, and the test is three lines
constructor(private deps: { repos: RepoRepository; git: GitClient; jobs: JobRunner }) {}

// current, and the reason container.ts ⇄ repo-intel/service.ts is a cycle
constructor(private container: Container) { this.repo = new RepoRepository(container.db); }
```

Write new services in the target shape. The existing ones are debt in
`server/specs/onion-debt.md`; do not mass-refactor them, do not copy them.

**3. A service may `new` its own repository.** A repository has no port and no
mock — it is swapped by pointing at a different `Db`. Adapters are swapped
through `ContainerOverrides`, so they must arrive already built. This is the one
place the "never `new` in a service" rule does not apply, and `server/AGENTS.md`
means adapters when it says adapters.

**4. Ports are named for the capability, not the vendor.** `GitHubClient`, not
`OctokitClient`. `LLMProvider`, not `OpenAIProvider`. The port is our vocabulary;
the adapter is theirs.

**5. Adding an external integration, in this order:** port in
`src/vendor/shared/adapters.ts` (+ mirror to the client) → implementation in
`src/adapters/<vendor>/` → lazy getter + `ContainerOverrides` field → inject into
the service. Doing it in the other order produces an adapter shaped like the
vendor's SDK instead of like our domain.

**6. Secrets resolve inside the container.** `SecretsProvider` reads
`~/.devdigest/secrets.json` (mode `0600`). Secrets never reach `AppConfig`, the
database, a committed `.env`, or a service constructor argument. After writing a
new key, call `invalidateSecretCaches()` so the next resolve picks it up.

**7. Graceful degradation is a container concern.** `embedder()` throws a
`ConfigError` *before* constructing the OpenAI client when embeddings are
disabled, so the app makes zero requests; callers catch and degrade. Put the gate
where the client is built, not in every caller.

---

## Jobs and SSE

**1. A job handler is Ring 2 wearing a callback.** Register it from the service
(`container.jobs.register(KIND, …)`), export an interface for its payload, and
keep the kind string in `constants.ts`. `JobRunner` itself is Ring 3 — it is a
DB-backed queue.

**2. A route enqueues; it never runs the work.** `POST /repos` persists and
enqueues a clone; the clone happens in the job. This is also why services take
`workspaceId` rather than a request: the job runner has no request.

**3. A job kind shared by two modules is a contract.** `repos/service.ts`
importing `INDEX_JOB_KIND` from `repo-intel/constants.ts` is the live
`no-cross-module` violation; such a constant belongs in `modules/_shared/`.

**4. The SSE bus carries domain events, not HTTP.** A service publishes a run
event; `platform/sse.ts` and the route turn it into a stream. Ring 2 must not
know a browser is attached.

**5. Stale `running` runs are reaped on boot and awaited before listening.** That
assumes **one API instance per database** — keep it in mind before adding a
second process.

---

## Errors

`src/platform/errors.ts` holds `AppError` and its subclasses — `NotFoundError`,
`ValidationError`, `ExternalServiceError`, `ConfigError` — each carrying a
`statusCode`. They are Ring 1: pure classes, no framework.

- **Throw in the ring that notices.** A repository throws `NotFoundError`; an
  adapter throws `ExternalServiceError`; the container throws `ConfigError` for a
  missing key.
- **Map in Ring 4 only.** The global handler in `src/app.ts:116` renders
  `{ error: { code, message, details } }`. Never build that envelope by hand and
  never `reply.status(500).send({ error: … })` in a handler — two shapes of the
  same error is a client-side bug generator.
- **Do not catch to log and rethrow.** The handler logs. A catch that adds
  nothing removes the stack.

---

## Tests

The test suites are the architecture's proof. The shape of a test tells you
which ring its subject is really in.

| Needs | Ring | File name |
|---|---|---|
| nothing | 1 | `*.test.ts` |
| constructor mocks or `ContainerOverrides` | 2 | `*.test.ts` |
| real Postgres via testcontainers | 3 | `*.it.test.ts` |

- **A DB test named `*.test.ts` poisons the unit suite** — the suffix is what
  splits the two CI workflows, and integration tests self-skip when Docker is
  absent.
- **Both live in `server/test/`, not beside the source.**
- **If a service test needs Postgres, fix the service.** That is the single most
  reliable smell for a ring violation, and it shows up long before `pnpm arch`
  does.
- `reviewer-core` tests are hermetic by construction: a stubbed `LLMProvider`, no
  keys, no network. If a change there needs a fixture from disk, the change
  belongs in the server.

---

## The LLM path, end to end

Worth tracing once, because it crosses every ring and gets it right:

```
routes.ts            Ring 4  POST /reviews → service.start()
service.ts           Ring 2  persists a run, enqueues the job
run-executor.ts      Ring 2  loads the diff, gathers prompt inputs, calls the engine
reviewer-core        Ring 1  diff → prompt → LLMProvider.completeStructured → findings
  ↑ injected
container.llm(id)    Ring 3  resolves the key via SecretsProvider, builds the provider
adapters/llm/*.ts    Ring 3  speaks OpenAI / Anthropic / OpenRouter
```

The engine never learns which vendor answered, and the adapter never learns what
a finding is. Model choice and prompt text are configuration that flows *in* —
see `docs/agent-prompts/` before changing either.
