# Gates — the half that needs no model

Two kinds, both run before any lens:

- **G1–G12**, static checks over the diff, implemented in `scripts/gates.mjs`;
- **package commands**, run per touched package, against a baseline.

```sh
node .claude/skills/pr-self-review/scripts/gates.mjs        # summary
node .claude/skills/pr-self-review/scripts/gates.mjs --json # full report to stdout
```

Always exits 0. The verdict is in `.devdigest/cache/pr-self-review/gates.json`,
because the caller decides what to do with it, not the script.

## What counts as "everything that is open"

```sh
BASE=$(git merge-base origin/main HEAD)
git diff $BASE                              # committed on the branch + staged + unstaged
git ls-files --others --exclude-standard    # untracked
```

- **`origin/main`, not `main`** — the local branch lags, and then someone else's
  work lands in your review.
- **Untracked files count.** A new `service.ts` that has not been `git add`ed is
  usually exactly what needs looking at.
- **Excluded**: `server/clones/**` (a full second checkout of dev-digest that
  repo-intel clones into — see the root `INSIGHTS.md`, 2026-09-16),
  `node_modules/`, `dist/`, `.next/`, `coverage/`, `.devdigest/`.

## G1–G12

| # | Rule | How it is checked | Severity |
|---|---|---|---|
| **G1** | `@devdigest/shared` is vendored twice | for every changed `*/src/vendor/shared/X`, compare the **contents** of the server and client copies (CRLF-normalised) | CRITICAL |
| **G2** | a lockfile changes only in a commit about that dependency | subjects of the commits touching it in `$BASE..HEAD`; uncommitted lockfile change → WARNING | CRITICAL |
| **G3** | `main` is the course starter | current branch is `main` and code files are in the diff | CRITICAL |
| **G4** | secrets never reach git | added lines matched against `ghp_`, `github_pat_`, `sk-ant-`, `sk-`, `AKIA…`, PEM private keys; `.env` / `.env.local` in the diff | CRITICAL |
| **G5** | migrations are not applied on boot | a new `server/drizzle/*.sql` is in the diff | WARNING |
| **G8** | a module has to be registered | changed `modules/<m>/routes.ts` whose `<m>` does not appear in `server/src/modules/index.ts` | CRITICAL |
| **G9** | schema and migration travel together | `server/src/db/schema.ts` changed with no new migration | CRITICAL |
| **G10** | a contract has a consumer | `vendor/shared/contracts/*` changed, nothing under `client/src` outside `vendor/` changed | WARNING |
| **G11** | a DB test belongs to the integration suite | a `server/src/**/*.test.ts` that mentions testcontainers without the `.it.test.ts` suffix | WARNING |
| **G12** | UI text goes through next-intl | a JSX text literal added in `client/src/**/*.tsx` | WARNING |
| **CRLF** | a whole-file diff is usually an encoding flip | `git diff --numstat` vs `--numstat --ignore-cr-at-eol`: ≥ 20 lines that mostly vanish without CR | WARNING |

G6 (README content duplicated into an `AGENTS.md`) and G7 (a new feature with no
`specs/` entry) are SUGGESTION-level and are judged by the lens passes, not by the
script — they need reading, not matching.

### Why G1 compares contents, not filenames

"Both copies appear in the diff" passes when the two copies were edited
differently. The failure mode the rule exists to prevent — request validation and
the client's types drifting apart — happens either way. Content equality catches
both.

### Why G8 and G9 are CRITICAL

Neither is a matter of taste: a route missing from `modules/index.ts` is not in
the application, and a schema change with no migration is a database that does
not match the code. That is the `general-reviewer.md` bar for CRITICAL
(production breakage), reached without a model.

### G5 and the Windows trap

The reminder is deliberately *not* "run `pnpm db:migrate`". On this machine
`db:migrate` and `db:seed` exit 0 without touching the database, so a green exit
code proves nothing. Verify by counting tables.

## Package commands

From `gates.json` → `packages[]`. Always **from inside the package directory**.

| Touched | Commands |
|---|---|
| `server/` | `pnpm typecheck` · `pnpm arch` · `pnpm test` |
| `client/` | `pnpm typecheck` · `pnpm test` |
| `reviewer-core/` | `npm run typecheck` · `npm test` |
| `e2e/` | `npm run typecheck` |

There is no `lint` script anywhere in the repo — do not invent one.

### `pnpm arch` is the cheap one

`onion-architecture` ships `server/.dependency-cruiser.cjs` where every rule is
`error`, with the 25 existing violations parked in
`.dependency-cruiser-known-violations.json`:

```sh
pnpm arch            # fails only on a NEW boundary violation
pnpm arch:all        # shows the grandfathered debt too
pnpm arch:baseline   # rewrite the baseline — only ever to REMOVE entries
```

A new violation is a CRITICAL with no model involved, and it is found in seconds.

### The test baseline

`.devdigest/cache/pr-self-review/baseline.json`:

```json
{
  "merge_base": "<sha>",
  "generated_at": "…",
  "known_failing": {
    "server": ["src/modules/repo-intel/indexer-pipeline.test.ts > indexes a repo > ranks symbols"]
  }
}
```

A failing test blocks only if it is **not** in `known_failing`. On a clean tree
here, 6 of 11 tests in `indexer-pipeline.test.ts` already fail; without this the
gate would block every single PR and be disabled immediately.

Rewritten only by `/pr-self-review --refresh-baseline`, never automatically, and
— borrowing the rule `onion-architecture` states for `arch:baseline` — only ever
to **remove** entries. A freshly broken test must not quietly become known-red.

No baseline file yet → report `tests: unknown` and do not block on test failures
for that run.

## Adding a gate

1. It must be decidable from the diff, the filesystem or git alone. If it needs
   judgement, it is a lens rule, not a gate.
2. Implement it in `scripts/gates.mjs` with an id, and document the row here.
3. CRITICAL only if merging it breaks something. Otherwise WARNING.
4. Check it fires on a diff that should trip it AND stays silent on a clean
   tree — a gate that fires on everything is deleted within a week.
