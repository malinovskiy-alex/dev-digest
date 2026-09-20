# Codebase improvement plan

**Goal:** one prioritised list of what is worth fixing across all four packages, each item grounded in a file we can point at.
**Not in scope:** new features, and anything the course lessons already own. This is a health audit, not a roadmap.

Produced 2026-09-19 by reading the code against the skills in `.claude/skills/`:
`frontend-ui-architecture`, `react-best-practices`, `next-best-practices`,
`react-testing-library`, `fastify-best-practices`, `drizzle-orm-patterns`,
`postgresql-table-design`, `typescript-expert`, `zod`, `security`.

## What is already good

Worth stating first, because it shapes the list: the conventions that are written
down are actually followed. There is **not one `fetch` outside `client/src/lib/api.ts`**,
**not one deep import past a component folder's `index.ts`**, and no cross-route
`_components` import. Validation on the server is schema-first almost everywhere,
the error envelope is never hand-built, plugin order in `app.ts` matches what
`server/AGENTS.md` describes, and `strict` + `noUncheckedIndexedAccess` are on in
both packages with only 2 `any` in 107 server files. The structural problems below
are concentrated where **no convention was ever written**.

---

## P0 — correctness and tenancy

### 1. `repo-intel` has no tenancy at all

`server/src/modules/repo-intel/repository.ts` runs 25+ queries and contains the
string `workspace` exactly zero times. Every query scopes by `repoId` only, and
the five tables in `server/src/db/schema/repo-intel.ts` (`repo_index_state`,
`file_edges`, `file_facts`, `file_rank`, `repo_map_cache`) have **no
`workspace_id` column** — which contradicts `server/AGENTS.md`: *"Every domain
table carries `workspace_id` and every query scopes by it."*

The sharp edge is `server/src/modules/repo-intel/routes.ts:38`:

```ts
// Resolve tenancy so the request is workspace-scoped even though the
// facade itself is tenant-agnostic (consistent with blast routes).
await getContext(container, req);                       // ← result discarded
return container.repoIntel.getIndexState(req.params.id); // ← raw path param
```

The workspace is resolved and then thrown away; the caller-supplied `:id` goes
straight to a facade that never filters by workspace. That is an Insecure Direct
Object Reference: any repo id returns its index state regardless of who owns it.
Today the app is single-workspace and local-first, so nothing leaks in practice —
but this is the code path that breaks the moment a second workspace exists, and
it is cheaper to fix while there is only one.

**Fix:** resolve the repo inside the workspace before touching the facade —
`const repo = await repoRepo.byIdForWorkspace(workspaceId, req.params.id)`,
404 when absent — and pass the verified id down. Audit the other `repoIntel`
routes for the same shape. Adding `workspace_id` to the five tables is the
thorough version and needs a migration; the ownership check is the cheap one
and closes the hole on its own.

### 2. The two vendored copies of `@devdigest/shared` have drifted

`server/src/vendor/shared` and `client/src/vendor/shared` differ in **5 files,
120 lines**, while both AGENTS.md files require them to stay byte-compatible.
Not all of it is comments:

```
adapters.ts   server: readonly id: 'openai' | 'anthropic' | 'openrouter'
              client: readonly id: 'openai' | 'anthropic'
              server also has sessionId?: string and interface CommitFile
knowledge.ts  server has the four-value CI gate policy documented and extra decls
```

So the client's type system cannot represent a provider the server supports.
This is the root of symptoms already seen in the UI work — a provider that exists
on one side and not the other, and settings code guessing which enum is current.

**Fix:** pick the server copy as source of truth, re-vendor the client from it in
one commit, then add a CI step that fails on drift. A three-line job is enough:

```sh
diff -r server/src/vendor/shared client/src/vendor/shared
```

Without that check the two copies will drift again — they already did.

### 3. No route-level error or loading UI in the client

`find client/src -name 'error.tsx' -o -name 'loading.tsx' -o -name 'not-found.tsx'`
returns nothing. The App Router will render its default error screen for any
unhandled throw, and `react-best-practices` flags the absence of error boundaries
as HIGH. The API is a separate process that can simply be down — `api.ts` already
produces a friendly `ApiError` for that case ("Cannot reach the DevDigest engine…"),
and nothing catches it at the route level.

**Fix:** an `error.tsx` per route group with a reset button, plus a root
`not-found.tsx`. `loading.tsx` is optional given every page is a client component
that already renders its own skeleton.

---

## P1 — structure and layering

### 4. Four server modules skip the service/repository layers

`server/AGENTS.md` describes routes → service → repository, and five modules
follow it. Four do not:

| Module | Shape | `container.db` uses in `routes.ts` |
|---|---|---|
| `pulls` | `routes.ts` (380 lines) + `status.ts` | 18 |
| `polling` | `routes.ts` only | 3 |
| `settings` | `routes.ts` + helpers | 3 |
| `workspace` | `routes.ts` only | 1 |

`pulls` is the one that matters: 380 lines of route file with 7 queries inline,
and it owns the busiest screen in the product. The others are small enough that
the flat shape is defensible.

**Fix:** do not convert all four on principle. Give `pulls` a `service.ts` and a
`repository.ts` like `repos` and `reviews` have, and adopt the rule already
written into `server/INSIGHTS.md`: when you touch a query in one of the flat
modules, move that query down rather than adding a sibling beside it.

### 5. `RunRequest.parse(req.body)` in a handler

`server/src/modules/reviews/routes.ts:32` hand-parses the body, which
`server/AGENTS.md` names explicitly: *"Never hand-roll `Schema.parse(req.body)`
in a handler — invalid input must fail with 422 before the handler runs."*
The inline comment says it is deliberate ("Body stays a tolerant manual parse"),
but tolerance is expressible in the schema:

```ts
const RunBody = RunRequest.partial().default({});
app.post('/pulls/:id/review', { schema: { params: IdParams, body: RunBody } }, …)
```

That keeps an empty body valid and moves malformed input back to the 422 path,
where the error envelope is produced for free.

### 6. Derived state kept in `useState` + `useEffect`

The "derive, don't store" rule is the one `react-best-practices` calls the #1
anti-pattern. Six client files show the shape:

```
app/agents/[id]/_components/AgentEditor/_components/ConfigTab/ConfigTab.tsx
app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx
app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx
components/mermaid-diagram/MermaidDiagram.tsx
lib/repo-context.tsx
lib/theme.tsx
```

`MermaidDiagram`, `theme` and `repo-context` legitimately synchronise with
something external (a render library, `localStorage`, the URL) — those are what
effects are for. The three under `_components/` are worth a look each: whatever
they recompute after a state change probably belongs in `helpers.ts`, called
during render.

### 7. Two components past the size where splitting pays

`RunHistory.tsx` (262 lines) and `Showcase.tsx` (259) are the only files over
200. `RunHistory` renders a timeline that interleaves runs and commits and owns
the row markup — the row is the split. `Showcase` is a demo surface, so its size
is less interesting; leave it unless it starts being used as a component library.

### 8. Relative import paths where an alias exists

`tsconfig.json` defines `@/*` → `./src/*`, and 25 files use it. 162 imports do
not, and the depth gets absurd:

```
22 imports starting  ../../../../../../../
 9 imports starting  ../../../../../../../../
```

for example in `ConfigTab.tsx`:

```ts
import { useUpdateAgent } from "../../../../../../../lib/hooks/agents";
```

Nothing is broken, but a path like that has to be re-counted by hand whenever a
folder moves, and it hides what is actually being imported. `frontend-ui-architecture`
and Tao of React both make the same point: absolute paths mean less churn when
code moves, and they make the dependency obvious at a glance.

**Fix:** mechanical — rewrite non-sibling imports to `@/…` and let a lint rule
(`no-restricted-imports` with a `../../` pattern) keep them that way. Sibling
imports inside one component folder stay relative.

---

## P2 — database and data access

### 9. Five schema files declare no indexes at all

Postgres does not index foreign keys automatically, so every `where repo_id = …`
on an unindexed table is a sequential scan that only gets slower as runs
accumulate:

| File | Tables | Indexes |
|---|---|---|
| `agents.ts` | 3 | 0 |
| `eval.ts` | 4 | 0 |
| `reviews.ts` | 4 | 0 |
| `runs.ts` | 3 | 0 |
| `skills.ts` | 2 | 0 |
| `ci.ts` | 2 | 0 |

`runs` and `reviews` are the hot ones — they grow with every review and are read
on every PR detail page load.

**Fix:** one migration adding indexes on the foreign keys and on the
`(workspace_id, …)` prefixes the queries actually filter by. Read the real
`where` clauses in `reviews/repository/*.ts` first and index those, rather than
indexing every column on principle.

### 10. `ci` and `repo-intel` tables carry no `workspace_id`

Same root as item 1, stated as a schema fact: two of the fourteen schema files
have no tenancy column. Whatever we decide for `repo-intel` should apply to `ci`
in the same migration, so the rule in `server/AGENTS.md` becomes true again or
gets an explicit, written exception.

---

## P3 — tests and tooling

### 11. `e2e/` contains no tests

The package exists, `AGENTS.md` describes it as "deterministic browser flows",
and `find e2e -name '*.spec.ts' -o -name '*.test.ts'` returns nothing. Either
the flows land or the package should say it is a stub — right now the repo
documents a safety net it does not have.

### 12. Client components: 17 tests for 58 components

The server is in decent shape (17 unit + 6 integration for 107 files). The client
is thinner, and the untested files include the review surface —
`RunHistory`, `ReviewRunAccordion`, `DiffViewer`. Worth noting that the covered
components are covered *well*: the existing tests query by role and text, which
is what `react-testing-library` asks for.

**Fix:** treat a test as part of the component folder shape rather than a
follow-up. The highest-value additions are the three above, because they hold the
severity and cost logic a reviewer acts on.

### 13. No ESLint anywhere in the repository

No `eslint.config.*` or `.eslintrc*` in any package. Every convention in the four
AGENTS.md files is currently enforced by review alone. `typecheck` catches types;
nothing catches a cross-route import, a deep import past `index.ts`, or a `fetch`
in a component — all of which are mechanical.

**Fix:** `.claude/skills/frontend-ui-architecture/references/enforcement.md` has a
ready flat config for the client boundary rules (unverified — ESLint is not
installed, so expect to adjust it). Wire `lint` into CI beside `typecheck`.

### 14. Array index as `key` on lists that can change

Seven occurrences. Most are static skeletons where it is harmless, but two are
real lists that re-render with new data:

```
components/diff-viewer/DiffViewer/DiffViewer.tsx:28   <FileCard key={i} …>
app/…/RunTraceDrawer/_components/TraceBody/TraceBody.tsx:102   <ToolCallRow key={i} …>
```

`react-best-practices` rates this CRITICAL because reconciliation silently
attaches the wrong state to the wrong row. Use the file path and the tool-call id.

### 15. Missing `aria-label` on icon-only buttons

11 `<button>` elements without one. Screen readers announce nothing for those.
Cheap to fix and easy to regress — worth an eslint-plugin-jsx-a11y rule in the
same pass as item 12.

---

## Suggested order

1. **Item 2** (re-vendor the contracts + CI diff check) — everything else is
   easier once the two copies agree, and it is an afternoon.
2. **Item 1** (repo-intel ownership check) — small, and it is the only finding
   with a security label.
3. **Item 13** (ESLint) — turns items 8, 14, 15 and the whole boundary section from
   review burden into build failures.
4. **Item 9** (indexes) — one migration, measurable improvement on the PR detail
   screen.
5. **Item 3** (`error.tsx`), then **item 4** (`pulls` service) as the larger
   structural piece.

Item 8 is a bulk rewrite, so it belongs in the same pass as item 13 rather than
being dripped out. Items 5, 6, 7, 12 and 14 are small enough to fold into
whatever change next touches those files, rather than being scheduled.

## Status — 2026-09-19

| # | Item | State |
|---|---|---|
| 1 | repo-intel tenancy | **done** — `container.reposRepo` + `requireRepoInWorkspace()`; both routes 404 a foreign repo id |
| 2 | vendored contract drift | **done** — client re-vendored from the server copy; `.github/workflows/contracts.yml` fails on drift |
| 3 | route-level error UI | **done** — `app/error.tsx` + `app/not-found.tsx`, strings via next-intl |
| 4 | `pulls` service/repository | **not done** — see below |
| 5 | `RunRequest.parse` in a handler | **done** — moved to `schema.body` with `.default({})` |
| 6 | derived state | not done (deliberately unscheduled) |
| 7 | component size | not done (deliberately unscheduled) |
| 8 | relative import paths | **done** — 116 rewritten to `@/`; 58 intra-group ones kept relative (see note) |
| 9 | missing indexes | **partial** — 6 indexes added to the schema, migration `0011` generated and its SQL validated; **not applied** |
| 10 | `workspace_id` on `ci` / `repo-intel` | not done — needs a schema decision |
| 11 | `e2e/` has no tests | not done |
| 12 | client test coverage | not done (deliberately unscheduled) |
| 13 | no ESLint | **done** — `client/eslint.config.mjs`, `pnpm lint`, wired into `client.yml` |
| 14 | array index as `key` | **done** — 1 real case fixed; see the correction below |
| 15 | missing `aria-label` | **done** — 3 real cases fixed; see the correction below |

**Two counts in this document were wrong when it was written.**

*Item 14* claimed two real cases. There is one: `DiffViewer` maps `files` from
props, so `key={f.path}` matters. The other six are lists derived deterministically
from an immutable input — `parsePatch(file.patch)` and the append-only
`trace.tool_calls` — which never reorder, so an index key is correct there and
was left alone.

*Item 15* claimed 11 buttons. The grep counted `<button` lines whose `aria-label`
sat a line or two below. `AgentCard`, `ReviewRunAccordion` and the toast close
button were already labelled. Three were genuinely missing: the two chip triggers
(`RunFindingsChips`, `FindingsCell`) and the agents search input, whose only name
was a placeholder.

**Item 8 needed a correction mid-flight.** Rewriting every `../` to `@/` turned
cohesive intra-group imports absolute — `src/components/diff-viewer/` is a *group*
(`DiffViewer/`, `FileCard/`, plus a shared `comments.ts`), and so is a route
segment with its own `constants.ts` beside `page.tsx`. 58 imports were reverted to
relative, and the lint rule now bans climbing three or more levels rather than two.

**Item 9 is not applied.** `pnpm db:migrate` exits 0 on this machine without
touching the database — `drizzle.__drizzle_migrations` still shows 11 rows and
none of the six indexes exist. The SQL was validated inside a transaction that
was rolled back, so the migration is known-good; it needs a working
`db:migrate` (or a manual `psql` run) on a machine where that works. Note also
that `EXPLAIN` on the seeded data still picks a sequential scan — the table is
far too small for an index to pay. The value here is for growth, not today.

**Item 4 is the one scheduled item left undone.** It is ~380 lines of genuine
orchestration — GitHub sync, idempotent upsert, a capped diff-stat backfill, and
the degraded paths that make the list work offline — and extracting it changes no
behaviour. That combination makes it the right candidate for its own commit and
its own review, rather than the tail of a batch. A second session was editing
`server/` while this work ran (it added `pnpm arch`, `server/specs/onion-debt.md`
and rewrote `server/AGENTS.md`), and `pulls/routes.ts` is exactly where a
conflict would hurt most.

## Done when

- [ ] `diff -r server/src/vendor/shared client/src/vendor/shared` is empty, in CI
- [ ] a repo id from another workspace returns 404 from every `repoIntel` route
- [ ] `pnpm lint` exists and passes in both packages
- [ ] the PR detail page's queries hit indexes (check with `EXPLAIN`)
- [ ] an API-down state renders the route's `error.tsx`, not the framework default
