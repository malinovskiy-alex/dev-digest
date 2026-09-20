# Onion boundary debt — the 21 grandfathered violations

**Status:** not built. Surfaced while writing the
[`onion-architecture`](../../.claude/skills/onion-architecture/SKILL.md) skill
and turning its rules into `server/.dependency-cruiser.cjs`.

**Goal:** empty `.dependency-cruiser-known-violations.json`, then delete it and
put `pnpm arch` into both CI workflows next to `pnpm typecheck`.

Everything listed here **works today**. None of it is a bug. Each entry is a
place where an import points outward, with the cost that carries and the change
that removes it. Fix them one boundary per commit, regenerate the baseline in
that same commit, and strike the entry here.

> Do not batch these into one "architecture" PR. Each one changes behaviour-free
> code in a module someone else may be editing, and a 21-item diff is unreviewable.

## Ground rules

- `pnpm arch` must stay green throughout. After a fix:
  `pnpm arch:baseline` → the entry count drops → commit both.
- The baseline **never grows**. A new violation gets fixed, not recorded.
- Touch nothing else in the file you are fixing. These commits should be boring.

---

## A. Row types leaking into Rings 1–2 — 3 entries, one afternoon

| Rule | File |
|---|---|
| `core-no-io` | `src/modules/repos/helpers.ts` → `db/schema.ts` |
| `app-no-drizzle` | `src/modules/reviews/run-executor.ts` → `db/schema.ts` |
| `app-no-drizzle` | `src/modules/reviews/diff-loader.ts` → `db/schema.ts` |

All three write `typeof schema.repos.$inferSelect` inline for the same table.

**Fix (minimum):** add `export type RepoRow = typeof t.repos.$inferSelect;` to
`src/db/rows.ts` — which exists for exactly this and explains why in its header —
and import `RepoRow` in the three files.

**Fix (better, for `helpers.ts`):** move `toRepoDto` into `RepoRepository`, which
already owns the row, and let the service deal in `Repo`. Then `helpers.ts` holds
only `parseRepoUrl` / `withGitHubToken` and is genuinely Ring 1.

**Do first.** It is the cheapest entry here and it removes one of the two cycle
families below as a side effect.

---

## B. The `agents` cycle — 1 entry, ten minutes

| Rule | Cycle |
|---|---|
| `no-circular` | `agents/helpers.ts` ⇄ `agents/repository.ts` |

`helpers.ts:3` imports `AgentRow` / `AgentVersionRow` **from `./repository.js`**,
while `repository.ts:6` imports `isConfigChange` from `./helpers.js`.

**Fix:** `import type { AgentRow, AgentVersionRow } from '../../db/rows.js';` —
that is where both types are actually defined, and `repository.ts` only
re-exports them. One line, cycle gone.

---

## C. The container ⇄ service cycle — 4 entries, the real work

| Rule | Cycle |
|---|---|
| `no-circular` | `container.ts` ⇄ `repo-intel/service.ts` |
| `no-circular` | `container.ts` ⇄ `repo-intel/service.ts` ⇄ `pipeline/incremental.ts` (×2 paths) |
| `no-circular` | `container.ts` ⇄ `repo-intel/service.ts` ⇄ `pipeline/full.ts` |

`Container.repoIntel` constructs `new RepoIntelService(this)`, and the service —
like every service here — takes the whole container back.

**Fix:** give `RepoIntelService` an explicit dependency object:

```ts
export interface RepoIntelDeps {
  repo: RepoIntelRepository;
  git: GitClient;
  codeIndex: CodeIndex;
  embedder: () => Promise<Embedder>;   // stays lazy: embeddings can be disabled
  depgraph: DepGraph;
  tokenizer: Tokenizer;
  config: AppConfig;
}
```

The container builds that object; the service imports no container type, so the
cycle disappears and `repo-intel` becomes unit-testable without a container.

**Scope warning.** `repo-intel/service.ts` is 764 lines and four pipeline files
hang off it. Do this one alone, with the existing tests as the guard, and do not
change what any method does.

**The same shape exists in `repos`, `agents` and `reviews` services.** They do
*not* currently produce a cycle, so they are not in the baseline — convert them
opportunistically, when you are already editing the file, not as a campaign.

---

## D. Routes that query — 4 entries, one module each

| Rule | File |
|---|---|
| `routes-no-db` | `src/modules/pulls/routes.ts` (380 lines, the biggest) |
| `routes-no-db` | `src/modules/settings/routes.ts` (+ `feature-models.ts`) |
| `routes-no-db` | `src/modules/workspace/routes.ts` |
| `routes-no-db` | `src/modules/polling/routes.ts` |

These four modules have no `service.ts` at all, so the route *is* the service.

**Fix, per module:** add `repository.ts` (every query, scoped by `workspace_id`)
and `service.ts` (the decisions), leave the route with `getContext` + one call +
a status code. `repos` and `agents` are the reference shape.

**Start with `polling` or `workspace`** — they are small. `pulls` is the one with
real logic in it (the GitHub-unreachable fallback, the files/commits replace) and
should be done last, when the pattern is established.

While you are there: the delete+insert of `pr_files` / `pr_commits` in
`pulls/routes.ts:238-256` is not transactional. Wrapping it belongs in the new
repository method, not in the route.

---

## E. Modules importing adapters directly — 8 entries, three different fixes

| Rule | Edge | Fix |
|---|---|---|
| `no-concrete-adapters` | `reviews/diff-loader.ts` → `adapters/git/diff-parser.ts` | **move the file.** `parseUnifiedDiff` does no I/O — it is Ring 1 in an adapter folder. Move to `src/platform/diff.ts`. |
| `no-concrete-adapters` | `repo-intel/{service,pipeline/full,pipeline/incremental}.ts` → `adapters/astgrep/index.ts` (3) | **add a port.** ast-grep spawns a binary and reads files; a test must be able to fake it. Interface into `src/vendor/shared/adapters.ts` (mirror to the client), getter + `ContainerOverrides` field. |
| `no-concrete-adapters` | the same three files → `adapters/codeindex/extract.ts` (3) | **check first.** If `extractEndpoints` is pure, move it inward like `diff-parser`; if it shells out to ripgrep, it needs the port treatment. |
| `no-concrete-adapters` | `repo-intel/pipeline/repo-map.ts` → `adapters/tokenizer/index.ts` | **move the interface.** `Tokenizer` is declared beside `TiktokenTokenizer`; the port belongs in `adapters.ts`. Same for `DepGraph` in `adapters/depgraph/index.ts`. |

Note that `adapters.ts` lives in the **vendored** `@devdigest/shared` — every
change here is two edits, `server/src/vendor/shared/` and
`client/src/vendor/shared/`, in one commit.

---

## F. A job kind reaching across modules — 1 entry, five minutes

| Rule | Edge |
|---|---|
| `no-cross-module` | `repos/service.ts:12` → `repo-intel/constants.ts` |

`repos` imports `INDEX_JOB_KIND` and `REFRESH_JOB_KIND` so it can enqueue an
index after a clone.

**Fix:** move both constants to `src/modules/_shared/job-kinds.ts` and import
from there in both modules. A job kind two modules agree on is a contract between
them, not a private constant of one.

---

## Suggested order

1. **F** and **B** — five and ten minutes, one line each, no behaviour touched.
2. **A** — removes three entries and makes the next steps easier to read.
3. **D**, one module per commit, smallest first.
4. **E**, split by fix type: the two file moves first, the ports after.
5. **C** last — it is the largest single change and the others reduce its blast
   radius.

When the count reaches zero: delete `.dependency-cruiser-known-violations.json`,
drop `--ignore-known` from the `arch` script, and add the step to
`.github/workflows/`.
