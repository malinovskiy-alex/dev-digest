# DevDigest — agent instructions

Local-first AI pull-request review. **Four standalone packages, not a monorepo:**
each owns its `package.json` *and* its own lockfile, and cross-package code is
shared only through tsconfig `paths` aliases (`@devdigest/shared`,
`@devdigest/reviewer-core`, `@devdigest/ui`). Never add a workspace, `npm link`,
or a published-module dependency between them.

## Read before you act

None of these are loaded for you. Read the file when its trigger matches.

| Read | When |
|---|---|
| [README.md](README.md) | before you change anything — architecture diagram, the review flow end to end, what the starter does and does not ship |
| [TESTING.md](TESTING.md) | you are adding a test and need to know which of the five suites it belongs to |
| [INSIGHTS.md](INSIGHTS.md) | something behaves unexpectedly — check here **before** you start debugging |
| [specs/](specs/README.md) | you are about to build something that does not exist yet — write the plan there first |
| [docs/agent-prompts/](docs/agent-prompts/README.md) | you are touching a reviewer system prompt or the model choice — the built-in prompts live only here |
| [.claude/skills/README.md](.claude/skills/README.md) | you want to know what a skill is, or to add one |

Per-package rules load on their own when you touch a file in that package. Read
one up front only if you are planning a change there.

## The four packages

| Package | What it is | Port | Rules |
|---|---|---|---|
| `server/` | Fastify 5 + Drizzle/Postgres — imports repos and PRs, indexes, runs reviews | 3001 | [server/CLAUDE.md](server/CLAUDE.md) |
| `client/` | Next.js 15 studio | 3000 | [client/CLAUDE.md](client/CLAUDE.md) |
| `reviewer-core/` | pure review engine: diff → prompt → LLM → findings | — | [reviewer-core/CLAUDE.md](reviewer-core/CLAUDE.md) |
| `e2e/` | deterministic browser flows | — | [e2e/CLAUDE.md](e2e/CLAUDE.md) |

`repo-intel`, the codebase indexer, lives **inside** the server: `server/src/modules/repo-intel`.

## Commands

```sh
./scripts/dev.sh     # Postgres (Docker) + API + web. Flags: --no-seed --no-client --db-only
```

Every other command runs **from inside the package directory**, never the root.
Node >= 22.

- **`pnpm`** for `server/` and `client/` — they ship `pnpm-lock.yaml`.
- `reviewer-core/` and `e2e/` still carry a starter `package-lock.json`. Do not
  regenerate either lockfile as a side effect of an unrelated change.

## Hard rules

- **`main` is the course starter.** Lesson work belongs in a fork or a branch —
  see commit `c6af1e4`. Do not "complete" starter gaps on `main` unasked.
- **`@devdigest/shared` is vendored twice** — `server/src/vendor/shared/` and
  `client/src/vendor/shared/`. Change one, mirror the other in the same commit,
  or request validation and the client's types silently drift apart.
- **Secrets never touch the DB, git or `AppConfig`.** They live in
  `~/.devdigest/secrets.json` (mode `0600`) behind `SecretsProvider`.
- **Migrations are not applied on boot.** Run `pnpm db:migrate` yourself.
- **Docker runs Postgres only.** API and web run on the host.
- **An empty table is intentional.** The schema already contains every table the
  finished product needs, including ones no starter code touches.
- Host is Windows: prefer the Bash tool for POSIX scripts, PowerShell otherwise.

## Skills

server → `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`.
client → `next-best-practices`, `react-best-practices`, `react-testing-library`.
anywhere → `zod`, `typescript-expert`, `security`. docs → `mermaid-diagram`.
end of a substantive task → `engineering-insights`, which files what you learned
into the right `INSIGHTS.md`.

## Where to write what

| You have | It goes to |
|---|---|
| a durable explanation of how something works | `<pkg>/docs/` |
| a plan for something not built yet | `<pkg>/specs/` |
| a non-obvious fact that cost you time | `<pkg>/INSIGHTS.md` |
| something a human needs to run the package | `<pkg>/README.md` |

Never restate README content inside a `CLAUDE.md`. One fact, one home, links
everywhere else.

## Session protocol

**Before you touch a package**, read its `INSIGHTS.md`. Treat what is there as
high-confidence guidance unless this session proves otherwise — every entry is
something that already cost someone time here.

**When a task ends, run `/engineering-insights`.** It appends what this session
learned to the `INSIGHTS.md` of the package you touched. Skip it only when the
session taught you nothing worth a cold reader's time. Do not skip it because the
task ran long.
