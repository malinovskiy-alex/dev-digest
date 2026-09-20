---
name: frontend-ui-architecture
version: 1.0.0
description: "UI architecture and code organization for the DevDigest Next.js client (`client/`) — where a new file belongs, how to split a component, and where business logic, constants, types, helpers and styles live, plus module boundaries and the server/client split. Use this whenever adding, moving or splitting anything under `client/src`, when a `page.tsx` or component is growing, when deciding whether code is route-local or shared, when reviewing frontend structure, or whenever the question is 'where should this code go?' — including when the user only says 'add a screen', 'extract this', or 'refactor this component'. Not for React API mechanics (use react-best-practices) or Next.js feature mechanics (use next-best-practices)."
---

# Frontend UI Architecture

This skill answers one question: **where does this code go?**

It is scoped to `client/` (`@devdigest/web` — Next.js 15 App Router, React 19,
TanStack Query, next-intl, Tailwind). The rules below are the reasoning behind
the conventions; `client/AGENTS.md` is the terse statement of them and loads on
its own when you touch a file there.

## Read this, not that

Structure is only one axis of frontend quality. Stay in your lane so the four
skills do not contradict each other:

| Question | Where it is answered |
|---|---|
| Where does this file/constant/type/helper go? | **this skill** |
| Should this be `useMemo`? Is this effect necessary? Key prop? a11y? | `react-best-practices` |
| How do route groups / metadata / streaming / `revalidate` work? | `next-best-practices` |
| How do I test this component? | `react-testing-library` |
| The exact folder names and file names to type | `client/AGENTS.md` |

When this skill and `client/AGENTS.md` disagree, **AGENTS.md wins** — it is the
project's contract. Tell the user about the divergence rather than silently
picking one; a stale convention is worth fixing, but not by accident.

## The decision procedure

Most "where do I put this?" questions resolve by asking **how many things use
it**, not by what kind of thing it is. Type-based filing (`utils/`, `helpers/`,
`types/`) is what turns folders into junk drawers — the name tells you the
shape of the code but never who owns it.

Start at the narrowest scope that works and move up only when a second consumer
appears:

```
same file  →  sibling file in the component folder  →  src/components/<kebab>/
                                                    →  src/lib/<subject>.ts
                                                    →  @devdigest/shared
```

Two rules keep this honest:

- **Promote on the second consumer, not the first.** An abstraction with one
  caller is speculation. When a second route needs it, move it up — and move it
  in one commit so nothing imports the old location.
- **Never demote silently.** Once something is shared, deleting the last
  consumer is the signal to remove it, not to leave it orphaned in `src/lib/`.

### Where the answer usually lands

| What you are adding | Where it goes |
|---|---|
| UI used by one route | `src/app/<route>/_components/<Name>/` |
| UI used by two or more routes | `src/components/<kebab-case>/` |
| A UI primitive (button, badge, input) | already in `@devdigest/ui` — reuse, don't re-invent |
| Pure function used by one component | `helpers.ts` in that component's folder |
| Pure function used across routes | `src/lib/<subject>.ts` (kebab-case, named for the subject) |
| Literal, enum, threshold, keymap | `constants.ts` in the component's folder |
| Anything touching the API | a hook in `src/lib/hooks/*` → `src/lib/api.ts` |
| A type used in one file | that same file |
| A type shared across the client | `src/lib/types.ts` |
| A contract shared with the server | `@devdigest/shared` (Zod) — see the warning below |
| User-facing text | `messages/<locale>/*.json` via `next-intl` |
| Nav, breadcrumbs, `g`-then-key shortcuts | `src/components/app-shell/` |

## The unit of organization is a folder, not a file

A component is a folder whose name is the component. The satellite files exist
so that a component can grow without its main file turning into a scroll:

```
_components/FindingsPanel/
  FindingsPanel.tsx        # the component, nothing else
  FindingsPanel.test.tsx   # vitest + RTL, colocated
  constants.ts             # literals, enums, config
  helpers.ts               # pure functions
  styles.ts                # styles (see "Styles" below)
  index.ts                 # the only public surface
```

Add a satellite file when it has content; never inline it back afterwards. The
point is that the *shape* stays predictable — a reader who has seen one
component folder can navigate every other one.

**`index.ts` is the component's public API.** Import `FindingsPanel` from the
folder, never from `FindingsPanel/FindingsPanel`. Deep imports are what let
`constants.ts` leak into unrelated routes, and after that the folder is no
longer a unit you can move or delete.

> A note on barrel files: the wider ecosystem warns against them, and rightly —
> `export *` barrels wreck tree-shaking and slow dev servers. That warning is
> about *aggregating* barrels that re-export many modules. A one-line
> per-component `index.ts` is a different thing: it names a boundary. Keep those.
> The one aggregating barrel here, `src/lib/hooks/index.ts`, is a deliberate
> exception documented in its own header — do not add more like it.

## Where business logic goes

Components render. Logic lives one step away, at the cheapest level that works:

1. **Pure functions in `helpers.ts`** — anything computable from its arguments.
   Sorting, filtering, formatting, deriving. No React, no fetch, trivially
   testable. Reach for this first; most "business logic" is this.
2. **A hook in `src/lib/hooks/*`** — when the logic needs server data or
   TanStack Query cache behaviour. This is where a query key, its invalidation
   and its mutation live together.
3. **`src/lib/api.ts`** — HTTP only: URL, method, error normalization to
   `ApiError`. No domain rules here.
4. **The Fastify server** — anything authoritative. The client is not the place
   to enforce a rule the API also has to enforce.

Two hard lines, both already in `AGENTS.md`, worth restating because they are
the ones most often broken under time pressure:

- **No `fetch` in a component.** Adding an endpoint means adding a hook.
- **`page.tsx` stays thin.** It composes and passes props; it does not compute.
  If a page grows a helper, that helper belongs to a `_components/<Name>/`
  folder, and usually so does the markup around it.

### Deriving vs. storing

Before adding state, ask whether the value can be computed during render from
what you already have. A `visibleFindings(findings, hideLow)` helper called
during render is simpler and cannot desynchronize; the same value kept in
`useState` and refreshed by an effect can. `react-best-practices` covers the
mechanics — the architectural consequence is that **derived values belong in
`helpers.ts`, not in state**.

## Where constants go

Magic numbers and bare strings are a structure problem, not a style problem:
they make the same decision appear in several files with no way to find all the
copies. Give the value a name, then place it by scope:

- used inside one component → `constants.ts` in that folder, `UPPER_SNAKE_CASE`,
  with a one-line comment saying what the value means (`LOW_CONFIDENCE_THRESHOLD`
  reads better than `0.65`, but only the comment explains why it is 0.65);
- used across routes → `src/lib/<subject>.ts`;
- environment-dependent → read it once where the module is configured (as
  `src/lib/api.ts` does with `NEXT_PUBLIC_API_BASE`) and export the resolved
  value. Do not scatter `process.env` reads through the tree.

## Where types go

Three rules, narrowest scope first:

1. Used in one file → declare it in that file. A `.types.ts` file per component
   is friction with no payoff.
2. Used across the client → `src/lib/types.ts`.
3. Shared with the server → `@devdigest/shared`, as a Zod schema with the type
   inferred from it, so validation and type stay in sync.

> `src/vendor/shared` must stay byte-compatible with `server/src/vendor/shared`.
> It is vendored, not authored here — do not hand-edit it to make a client
> change compile. If a contract must change, that is a cross-package change and
> starts at `../AGENTS.md`.

## Splitting a component

Split when the component has more than one reason to change — not at a line
count. These are the signals worth acting on:

- it renders a list *and* owns the row markup → extract the row;
- it has a second `useState` cluster unrelated to the first → the two clusters
  are two components;
- a block of JSX is guarded by a condition that nothing else in the file reads →
  that block is a component;
- its props exceed roughly five, or several props are only forwarded → the
  component is doing a parent's job;
- a helper inside the body closes over nothing → it was never part of the
  component; move it to `helpers.ts`.

Prefer composition over configuration: a `children` slot beats a seventh boolean
prop. If several components must share state to work together (tabs, an
accordion), a compound component over context is the shape to reach for — but
see the boundary caveat below before doing it across a server/client line.

## Module boundaries

The structure only holds if imports respect it. There is **no ESLint in this
repository today**, so these are review rules — check them when writing or
reviewing a change. `references/enforcement.md` has a ready flat config for the
day you want them enforced mechanically.

Dependencies point one way: `vendor → lib → components → app`.

- A route's `_components/` is private to that route. If another route needs it,
  promote it to `src/components/<kebab-case>/` — do not reach across routes.
- `src/lib/` must not import from `src/app/` or `src/components/`. It is the
  layer below them; an import upward means the code was misfiled.
- `src/components/` must not import from `src/app/`.
- `src/vendor/` imports nothing from the app. It is vendored code.
- Import through a component folder's `index.ts`, never a deep path.
- Use the `@/` alias for anything outside the current folder; relative paths
  only for siblings inside one component folder.

## The server/client boundary

`'use client'` is a boundary in the module graph, not a label on a component:
everything a client component imports is pulled into the client bundle, so the
directive placed high drags the subtree with it. Data crosses as serializable
props; server components passed as `children` do **not** get pulled in.

**Current state, so you are not surprised:** every `page.tsx` in `client/` is a
client component, the root `layout.tsx` is the only server component, and there
are no server actions or `server-only` modules. That follows from the
architecture — the authoritative backend is the Fastify API on `:3001`, and the
client talks to it over HTTP with TanStack Query. In Next.js's own terms this is
the **External HTTP APIs** approach, which the docs recommend precisely when a
separate backend exists. A Data Access Layer, server actions and `server-only`
belong to the case where Next.js *is* the backend; they are not the default here,
and proposing them for a screen that just reads the API is a wrong turn.

For new code, the convention still stands: **server component by default, push
`'use client'` as far down as it goes.** A static page whose interactivity lives
in two widgets should keep the directive on the widgets. When touching a page
that already carries the directive at the top, leave it be unless the user asked
for that refactor — narrowing the boundary is a real change with real risk, not
a drive-by cleanup.

Boundary gotcha worth knowing: a compound component's static properties
(`Tabs.Panel`) become `undefined` when a server component imports them across
the boundary. Expose the pieces as named exports instead.

## Styles

Styles live in `styles.ts` next to the component.

The target is **Tailwind classes**; the 26 existing `styles.ts` files hold
`CSSProperties` objects over CSS variables and are legacy being migrated. Write
new components with Tailwind, and when you substantially rework an old one,
migrate it rather than extending the object. Do not mix both inside a single
component — half-migrated components are harder to read than either form.

Repeated class combinations are a component, not a copy-paste: check
`@devdigest/ui` before writing another badge.

## Tests

Colocate: `<Name>.test.tsx` beside `<Name>.tsx`. A component folder that has
grown helpers and constants but no test is the folder most likely to break.
Integration and real browser journeys are a different unit — they live in
`e2e/`, not here. Query by role, label or text; see `react-testing-library`.

## Red flags

Treat these as signals to stop and reconsider placement:

- a new top-level `utils/`, `helpers/` or `types/` folder — file by owner instead;
- `fetch` inside a component or a `page.tsx` that computes;
- a deep import past an `index.ts`, or a `_components/` folder imported by
  another route;
- a `constants.ts` imported from outside its own component folder — the value is
  shared, so it belongs in `src/lib/`;
- a wrapper component that only forwards props;
- a hand-edit inside `src/vendor/`;
- a hardcoded user-facing string in JSX.

## References

Load these when the question goes past the summary above:

- `references/structure.md` — the full tree of `client/src`, what each top-level
  folder is for, and worked examples of promotion between levels.
- `references/nextjs.md` — App Router architecture in depth: routing vs. product
  code, the boundary rules, and the data-access approaches with the reasoning
  for why this repo uses the one it does.
- `references/enforcement.md` — the review checklist in list form, plus a ready
  ESLint flat config encoding the boundary rules.
- `examples.md` — before/after pairs drawn from this codebase.
- `README.md` — every source this skill was built from.
