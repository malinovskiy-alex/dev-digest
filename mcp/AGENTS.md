# `@devdigest/mcp` — agent instructions

A local **stdio MCP server** that lets Claude Code (or any MCP client) list the
reviewer agents, run one on a PR, read findings and read a repo's conventions.
It is a **thin wrapper over the Fastify API on `:3001`** — it holds no business
logic and never touches the database.

## Read before you act

These are **not** loaded for you. Read the file when its trigger matches.

| Read | When |
|---|---|
| [README.md](README.md) | before you change anything here — setup, registration, env vars, the tool table, the `run_agent_on_pr` flow |
| [../specs/L04-devdigest-mcp.md](../specs/L04-devdigest-mcp.md) | you are touching a tool, its arguments, its result shape or an error message — the spec is the contract |
| [INSIGHTS.md](INSIGHTS.md) | something behaves unexpectedly — check here **before** you start debugging |
| [../TESTING.md](../TESTING.md) | you are unsure which suite a test belongs to |
| [../AGENTS.md](../AGENTS.md) | your change crosses a package boundary |

## Commands

**npm**, not pnpm — this package carries `package-lock.json`. Run from `mcp/`.

```sh
npm ci               # install from the lockfile — never `npm install` as a side effect
npm run build        # esbuild bundle → dist/index.js (what Claude Code runs)
npm run typecheck    # tsc --noEmit
npm test             # vitest, hermetic: fake API port + in-memory MCP client
npm run inspect      # MCP Inspector against dist/index.js (needs the API up)
```

## Rules

- **stdout carries the protocol only.** Any byte written to stdout that is not
  JSON-RPC breaks the client. No `console.log`, no `process.stdout`; log through
  `src/log.ts`, which writes to stderr. `test/hygiene.test.ts` enforces it.
- **`@devdigest/shared` is `import type` only.** It resolves through tsconfig
  `paths` to `../server/src/vendor/shared`. A runtime import pulls the vendored
  barrel into the bundle and breaks it.
- **No business logic.** Every rule the product enforces lives in the server.
  This package resolves names to ids, calls the API, waits, and trims the result.
  If a tool needs a new rule, the rule belongs in `server/`, not here.
- **Tool text is verbatim from the spec.** Titles, descriptions, `instructions`
  and every `.describe()` string are copied character for character from
  `specs/L04-devdigest-mcp.md`. To change one, change the spec first;
  `test/hygiene.test.ts` compares them.
- **Rebuild `dist/` after every change.** Claude Code launches
  `mcp/dist/index.js` (root `.mcp.json`), not the sources. An edit is not live
  until `npm run build` has run and the server is reconnected (`/mcp`).
- **Handlers throw, the transport maps.** A handler throws `ToolError` with a
  message that names the next step; only `server.ts` turns it into an
  `isError: true` result. Never throw a protocol error for a business failure.

## Rings (spec decision D16)

Imports point inward. `pnpm arch` does **not** cover this package — the ring
imports are checked by `test/hygiene.test.ts`.

| Ring | Files | May import | Must never import |
|---|---|---|---|
| 1 · pure | `src/format.ts`, `src/match.ts`, `src/errors.ts` | `zod`, `import type` from shared, other Ring 1 | anything in `api/`, the MCP SDK, `node:*`, `process` |
| 2 · orchestration | `src/api/port.ts`, `src/api/types.ts`, `src/resolve.ts`, `src/wait.ts`, `src/tools/*` | Ring 1, the `DevDigestApi` port | `api/http-client.ts`, the MCP SDK |
| 3 · I/O | `src/api/http-client.ts` (the only file with URL paths and `fetch`), `src/config.ts` (the only `process.env` reader), `src/log.ts` (stderr only) | Rings 1–2 | — |
| 4 · transport + composition root | `src/server.ts` (registers tools, maps `ToolError` → `isError`), `src/index.ts` (the only place that constructs an adapter, the only importer of `http-client.ts`) | everything | — |

## Where things live

- tool handlers → `src/tools/*.ts`, one per tool
- API port and its types → `src/api/port.ts`, `src/api/types.ts`
- HTTP adapter → `src/api/http-client.ts`
- registration, verbatim tool text → `src/server.ts`
- tests → `test/` (not beside the source)
- Claude Code registration → `../.mcp.json`

## Do not touch

- `../server/src/vendor/shared/` and `../client/src/vendor/shared/` — both
  vendored copies of `@devdigest/shared`. This package only reads their types.
- `package-lock.json` outside a commit whose subject is that dependency change.
