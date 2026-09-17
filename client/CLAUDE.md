# `@devdigest/web` — agent instructions

The DevDigest studio on `:3000`: Next.js 15 App Router, React 19, TanStack Query
over the Fastify API, Tailwind, `next-intl`.

## Read before you act

These are **not** loaded for you. Read the file when its trigger matches.

| Read | When |
|---|---|
| [README.md](README.md) | before you change anything here — the UI route map and the API surface each route leans on |
| [docs/](docs/README.md) | you need how a subsystem works in depth, beyond what the code shows |
| [specs/](specs/README.md) | you are about to build a screen that does not exist yet — write the plan there first |
| [INSIGHTS.md](INSIGHTS.md) | something behaves unexpectedly — check here **before** you start debugging |
| [src/vendor/ui/README.md](src/vendor/ui/README.md) | you are adding or restyling a UI primitive, or need the design tokens |
| [../CLAUDE.md](../CLAUDE.md) | your change crosses a package boundary |

## Commands

```sh
pnpm dev        # :3000, expects the API on :3001
pnpm test       # vitest + jsdom, fetch mocked — no API, no browser
pnpm typecheck
pnpm build
```

## Conventions

- **Pages stay thin.** `page.tsx` composes and passes props; feature logic lives
  in the colocated `_components/`.
- **No `fetch` in a component.** Data goes through a hook in `src/lib/hooks/*`,
  which calls `src/lib/api.ts`. Adding an endpoint means adding a hook.
- **Server components by default.** Add the `use client` directive only for
  state, effects or browser APIs, and push it as far down the tree as it goes.
- **User-facing strings go through `next-intl`** (`messages/<locale>/*.json`),
  never hardcoded into JSX.
- **Cross-cutting chrome** — nav, breadcrumbs, `g`-then-key shortcuts — lives in
  `src/components/app-shell`; extend it there rather than per page.
- **Query by role, label or text, never by class or test id.** Real browser
  journeys belong in [`../e2e`](../e2e/CLAUDE.md), not here.

## Naming

- **A component is a folder, not a file.** Follow this exactly:
  ```
  _components/<Name>/
    <Name>.tsx        # the component, nothing else
    <Name>.test.tsx   # vitest + RTL
    constants.ts      # literals, enums, config
    helpers.ts        # pure functions
    styles.ts         # Tailwind class strings
    index.ts          # the only public surface
  ```
  Import through `index.ts`, never a deep path. Not every folder needs every
  file — add one when it has content, and never inline it back afterwards.
- **PascalCase for a component, kebab-case for a shared folder.** Feature
  components live in `_components/<PascalCase>/`; cross-cutting ones in
  `src/components/<kebab-case>/` — but the component file inside is PascalCase
  either way (`app-shell/AppShell.tsx`).
- **The satellite files are always lowercase**: `constants.ts`, `helpers.ts`,
  `styles.ts`, `index.ts`. Only the component and its test carry the name.
- **A leading underscore means the folder is not a route.** `_components/` is a
  Next.js private folder, excluded from routing — feature code goes there, never
  beside `page.tsx`.
- **Everything under `src/lib/` is kebab-case** and named for its subject:
  `github-urls.ts`, `feature-models.ts`, `hooks/repo-intel.ts`.
- **Tests are `*.test.tsx`, colocated** with the component they cover.

## Do not touch

- `src/vendor/` is vendored code — do not hand-edit. `src/vendor/ui`
  (`@devdigest/ui`) holds the primitives; `src/vendor/shared`
  (`@devdigest/shared`) holds the Zod contracts and must stay byte-compatible
  with `server/src/vendor/shared`.

## Where things live

- routes → `src/app/**/page.tsx`
- HTTP client → `src/lib/api.ts`; data hooks → `src/lib/hooks/*`
- shell, nav, shortcuts → `src/components/app-shell/`
- diff rendering → `src/components/diff-viewer/`
- review UI → `src/app/repos/[repoId]/pulls/[number]/_components/`

## Gotchas

- `NEXT_PUBLIC_API_BASE` defaults to `http://localhost:3001`. A changed API port
  must be set here too, **and** the API's CORS origin must match.
