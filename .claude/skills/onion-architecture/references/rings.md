# The rings, mapped onto this repository

Every path under `server/src` and `reviewer-core/src`, with the ring it belongs
to and what that costs you. Ring numbers grow outward; imports point inward.

```
                    ┌──────────────────────────────────────────────┐
                    │ 4  routes.ts · app.ts · server.ts             │
                    │  ┌────────────────────────────────────────┐  │
                    │  │ 3  adapters/ · db/ · repository.ts ·    │  │
                    │  │    container.ts · config.ts · jobs.ts   │  │
                    │  │  ┌──────────────────────────────────┐   │  │
                    │  │  │ 2  service.ts · run-executor.ts  │   │  │
                    │  │  │    pipeline/ · job handlers      │   │  │
                    │  │  │  ┌────────────────────────────┐  │   │  │
                    │  │  │  │ 1  reviewer-core/src       │  │   │  │
                    │  │  │  │    helpers.ts · contracts  │  │   │  │
                    │  │  │  │    platform/errors.ts …    │  │   │  │
                    │  │  │  └────────────────────────────┘  │   │  │
                    │  │  └──────────────────────────────────┘   │  │
                    │  └────────────────────────────────────────┘  │
                    └──────────────────────────────────────────────┘
```

Ring 3 sits *outside* Ring 2 on purpose. A repository is not "deeper" than a
service — it is further from the domain, because it knows about Postgres.

---

## Ring 1 — Domain

**Rule:** computable from its arguments. No `async` unless the caller passed the
async thing in. No client, no clock read you did not receive, no `process.env`.

| Path | What it holds |
|---|---|
| `reviewer-core/src/**` | the review engine: prompt assembly, map-reduce, grounding, output shaping |
| `src/vendor/shared/contracts/*` | the Zod contracts — `Finding`, `Review`, `Verdict`, `PrMeta`, `RunTrace` |
| `src/modules/*/helpers.ts` | per-module pure functions: parsing, mapping, deriving |
| `src/platform/errors.ts` | the `AppError` hierarchy |
| `src/platform/resilience.ts` | `withTimeout`, `withRetry` — combinators over a passed-in function |
| `src/platform/structured.ts`, `prompt.ts`, `grounding.ts`, `model-router.ts`, `trace-builder.ts` | pure transforms over contracts |

**`reviewer-core` is the strictest part of Ring 1** and has its own three
invariants in `reviewer-core/AGENTS.md`: zero I/O, mandatory grounding, and a
single injection guard. It receives skill bodies, memory and specs as
**already-resolved strings** — resolving a slug is the caller's job. When you
need a fact inside the engine, you add an optional field to `PromptParts` /
`ReviewInput` that omits its section when empty; you do not add a lookup.

**What pushes code out of Ring 1:** needing a row type, a config value, a
database, or "just one" HTTP call. All four mean it was Ring 2 all along.

---

## Ring 2 — Application

**Rule:** orchestrates. Calls ports and repositories in an order that encodes a
business decision, and returns domain values.

| Path | What it holds |
|---|---|
| `src/modules/*/service.ts` | the module's use cases, one class, 5–7 methods |
| `src/modules/reviews/run-executor.ts` | a review run start to finish; prompt inputs are gathered in `runOneAgent` |
| `src/modules/reviews/diff-loader.ts`, `findings.ts` | the stages either side of the engine |
| `src/modules/repo-intel/pipeline/*` | `full`, `incremental`, `walk`, `rank`, `repo-map` — the indexer stages |
| `src/modules/pulls/status.ts` | PR status derivation |
| job handlers registered via `container.jobs.register(KIND, …)` | the async half of a use case |

A Ring 2 file signature never mentions HTTP. It takes `workspaceId`, `userId`
and DTOs, because the same method is called by a route **and** by the job runner,
which has no request.

**What pushes code out of Ring 2:** writing SQL (→ Ring 3), touching
`FastifyRequest` (→ Ring 4), constructing a vendor client (→ the container).

---

## Ring 3 — Infrastructure

**Rule:** knows a vendor, a protocol or a table, and hides it from everyone else.

| Path | What it holds |
|---|---|
| `src/adapters/<vendor>/` | one folder per external system: `github/octokit.ts`, `git/simple-git.ts`, `llm/{openai,anthropic}.ts`, `embedder/openai.ts`, `secrets/local.ts`, `auth/local.ts`, `codeindex/ripgrep.ts`, `astgrep/`, `depgraph/`, `tokenizer/` |
| `src/adapters/mocks.ts` | the in-memory implementations tests inject |
| `src/db/schema/<domain>.ts` | Drizzle tables, one file per domain, re-exported by the `src/db/schema.ts` barrel |
| `src/db/rows.ts` | row types shared across modules — the sanctioned way to name a row outside its owner |
| `src/db/client.ts`, `migrate.ts`, `seed.ts` | connection, migration runner, demo data |
| `src/modules/*/repository.ts`, `reviews/repository/*.repo.ts` | the only files that query that module's tables |
| `src/platform/container.ts` | the composition root |
| `src/platform/config.ts` | env parsing, `AppConfig` |
| `src/platform/jobs.ts` | `JobRunner` — a DB-backed queue over `p-queue` |
| `src/platform/sse.ts` | the in-process run event bus |
| `src/platform/prompts.ts` | built-in prompt loading from disk |

**Ports live with the contracts, not with the adapters.** The interfaces
(`LLMProvider`, `GitHubClient`, `GitClient`, `CodeIndex`, `Embedder`,
`SecretsProvider`, `AuthProvider`) are declared in
`src/vendor/shared/adapters.ts` — Ring 1 — so Ring 2 can depend on them without
looking outward. `src/adapters/` holds only implementations.

> Two adapters break that pattern and declare their interface beside the
> implementation: `DepGraph` in `adapters/depgraph/index.ts` and `Tokenizer` in
> `adapters/tokenizer/index.ts`. That is why `repo-intel/pipeline/repo-map.ts`
> shows up in the baseline — importing the type drags Ring 2 into Ring 3. When
> you next touch either, move the interface to `adapters.ts`.

**Every domain table carries `workspace_id`, and every query scopes by it.** That
is a domain rule enforced in Ring 3 because Ring 3 is where the query is built —
which is exactly why routes must not build queries.

---

## Ring 4 — Transport

**Rule:** translates HTTP into a service call and back. Delete it and the
application still works.

| Path | What it holds |
|---|---|
| `src/modules/*/routes.ts` | one default-exported Fastify plugin per module |
| `src/modules/index.ts` | the static module registry — imports and wiring only |
| `src/modules/_shared/context.ts` | `getContext(container, req)` → `{ workspaceId, userId }` |
| `src/modules/_shared/schemas.ts` | request schemas shared by several modules |
| `src/app.ts` | plugin order, the global error handler, `app.decorate('container', …)` |
| `src/server.ts` | listen, signal handling |

**Plugin order is load-bearing:** helmet, cors, rate-limit, SSE and the error
handler register *before* the modules, because each module is an encapsulated
Fastify plugin and inherits only what was registered earlier.

---

## Promotion: where things move as they grow

Start at the narrowest scope and move up only when a second consumer appears.

```
inside one function
  → helpers.ts in the module                    (Ring 1, module-local)
  → src/platform/<subject>.ts                   (Ring 1, server-wide)
  → reviewer-core/src/                          (Ring 1, shared with the CI runner)
  → @devdigest/shared                           (Ring 1, shared with the client)
```

```
a query inside a service
  → the module's repository.ts                  (Ring 3, one owner)
  → repository/<subject>.repo.ts                (when the file outgrows itself)
  → a container-exposed repository              (when a second module needs it)
```

Worked examples:

- **A row type two modules need.** Not a re-export from the other module's
  `repository.ts` — add it to `src/db/rows.ts`, which exists for this and
  documents why in its header. The owning repository re-exports it from there so
  its public type API does not change.
- **A repository two modules need.** `AgentsRepository` and `ReviewRepository`
  are constructed in the container and consumed as `container.agentsRepo` /
  `container.reviewRepo`. That is the sanctioned way; reaching into
  `../agents/repository.js` is not.
- **A constant two modules need.** `repos/service.ts` importing
  `INDEX_JOB_KIND` from `repo-intel/constants.ts` is the one live
  `no-cross-module` violation. Job kinds that cross a module boundary belong in
  `modules/_shared/`, because a job kind is a contract between two modules.
- **A pure function the engine also needs.** `adapters/git/diff-parser.ts`
  parses a unified diff with no I/O at all — it is Ring 1 wearing an adapter's
  folder name. The fix is to move the file, not to wrap it in a port.

---

## Package boundaries

The four packages are **not** a workspace. Cross-package code is shared only
through tsconfig `paths` aliases — `@devdigest/shared`,
`@devdigest/reviewer-core`, `@devdigest/ui`. Never add a workspace, `npm link`,
or a published-module dependency between them.

| Package | Ring it plays | Consumed as |
|---|---|---|
| `reviewer-core/` | Ring 1 for the server and, from L06, the CI runner | source, via `@devdigest/reviewer-core` |
| `@devdigest/shared` | Ring 1 contracts + port interfaces | **vendored twice**: `server/src/vendor/shared/` and `client/src/vendor/shared/` |
| `server/` | Rings 2–4 | the running API |
| `client/` | a separate onion; see `frontend-ui-architecture` | — |

Because `@devdigest/shared` is vendored twice, a change to a contract or a port
is **two edits in one commit**. Miss the mirror and request validation and the
client's types drift apart silently.

Because `reviewer-core` is consumed as source, every dependency added there
lands in the server and the CI runner too. Keep it dependency-light.
