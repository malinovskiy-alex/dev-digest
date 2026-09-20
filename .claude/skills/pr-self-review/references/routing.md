# Routing — which lens sees which file

The machine-readable version is `scripts/lib/routing.mjs`. **This file is the
contract; that file is the implementation.** Change one, change the other in the
same commit — a rule that exists only in prose never runs, and a rule that exists
only in code cannot be argued with.

## Why routing lives here and not in the skills

Two facts, both checked rather than assumed:

1. **No skill declares where it applies.** Not in its frontmatter, and not in the
   product either — `Skill` (`contracts/knowledge.ts:121`) has `name`,
   `description`, `type`, `source`, `body`, `evidence_files`, and no path or glob
   field. So the mapping has to live in the consumer, which is this skill.
2. **Most of them cannot be edited.** `skills-lock.json` lists `mcollina/skills`,
   `vercel-labs/next-skills`, `wshobson/agents`, `giuseppe-trisciuoglio/developer-kit`
   and others as upstream sources. An edit there is overwritten on the next
   update.

## The table

First match wins, top to bottom.

| Changed path | Group | Lenses |
|---|---|---|
| `client/src/app/**/{page,layout,route,template,error,loading}.tsx` | frontend | `frontend-ui-architecture`, `next-best-practices`, `react-best-practices` |
| `client/src/{app,components}/**/*.tsx?` | frontend | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` |
| `client/src/**/*.test.tsx` | frontend | `react-testing-library` |
| `client/src/lib/**` | frontend | `frontend-ui-architecture`, `typescript-expert` |
| `client/messages/**` | frontend | — (G12 only) |
| `server/src/modules/*/routes.ts`, `server/src/app.ts`, `server/src/platform/**` | backend | `fastify-best-practices`, `onion-architecture`, `security`, `perf-prompt` |
| `server/src/modules/*/{service,run-executor}.ts`, `*/pipeline/**` | backend | `onion-architecture`, `perf-prompt` |
| `server/src/modules/*/repository*.ts`, `server/src/db/**` | backend | `drizzle-orm-patterns`, `onion-architecture`, `perf-prompt` |
| `server/src/db/schema.ts`, `server/drizzle/**` | backend | `postgresql-table-design`, `drizzle-orm-patterns` |
| `server/src/adapters/**` | backend | `onion-architecture`, `security`, `perf-prompt` |
| `reviewer-core/src/**` | backend | `onion-architecture`, `typescript-expert` |
| any other `server/src/**/*.ts` | backend | `onion-architecture` |
| `*/vendor/shared/contracts/*.ts` | crosscutting | `zod` (+ G1, G10) |
| `e2e/**` | crosscutting | — (checklist in `e2e/AGENTS.md`) |
| `docs/agent-prompts/**` | crosscutting | — (checklist in its `README.md`) |
| `.claude/skills/**` | crosscutting | — (never lens the reviewer itself) |
| `*.md`, `*.yml`, `*.json` | crosscutting | — (gates only) |

### Content triggers

Applied to **added lines**, regardless of path:

| Added line matches | Lens |
|---|---|
| `process.env`, `SecretsProvider`, `token`, `auth`, `password`, `credential` | `security` |
| `z.object` / `z.string` / `z.enum` / `z.union` / `z.array` | `zod` |

A secret does not care which folder it is in.

## Grouping

Three groups, at most three passes, each seeing only its own slice of the diff.
An empty group is not run at all — that is what "UI skills on UI files" means in
practice. One pass per skill would mean 8–10 passes over the same diff: more
money, more duplicate findings, no more signal.

## The two lenses that are not skills

`docs/agent-prompts/` holds three written review rubrics, already tuned to this
stack (Fastify 5, Drizzle over postgres-js with a ~10 connection pool, pgvector,
p-queue, octokit):

| Prompt | Used as | Why |
|---|---|---|
| `performance-reviewer.md` | the `perf-prompt` lens | there is no perf skill in the repo; this is the only perf rubric we have |
| `security-reviewer.md` | second half of the `security` lens | the `security` skill targets React + Express + Mongo; this prompt targets our stack |
| `general-reviewer.md` | **not** a lens | its job is done by `/code-review`; it is used here only as the severity rubric (`:53-73`) |

These files are the source of truth for the product's built-in agents
(`docs/agent-prompts/README.md`). Read them at review time; never copy their text
into this skill, or the local bar and the product's bar drift apart.

## Adding a skill to the routing

1. Decide whether it is a **lens** at all. A generator (`mermaid-diagram`) or a
   post-process (`engineering-insights`) is not.
2. Add a row here **and** a rule in `scripts/lib/routing.mjs`.
3. Add its severity mapping to `severity-map.md` — a lens with no mapping cannot
   produce a blocking finding, because nobody knows what its "critical" means.
4. Add an eval case that proves it fires on its files and stays silent on others.
