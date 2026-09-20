# The shape of `client/src`

Reference for `frontend-ui-architecture`. Read when you need more than the
summary table in SKILL.md — a folder you have not seen before, or a judgement
call about promoting code between levels.

## Contents

- [The tree](#the-tree)
- [What each top-level folder is for](#what-each-top-level-folder-is-for)
- [Naming, in one place](#naming-in-one-place)
- [Promotion: worked examples](#promotion-worked-examples)
- [Why feature folders look different here](#why-feature-folders-look-different-here)

## The tree

```
client/src/
├── app/                     # routes only — App Router owns this
│   ├── layout.tsx           # the one server component; providers mount here
│   ├── page.tsx
│   ├── globals.css
│   ├── agents/
│   │   ├── page.tsx
│   │   ├── _components/     # private to /agents
│   │   │   ├── AgentCard/
│   │   │   └── AgentsListView/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── _components/AgentEditor/
│   ├── onboarding/
│   ├── repos/[repoId]/pulls/[number]/_components/   # the review UI
│   └── settings/[section]/
├── components/              # cross-route UI, kebab-case folders
│   ├── app-shell/           # nav, breadcrumbs, g-then-key shortcuts
│   ├── diff-viewer/
│   ├── findings-popover/
│   ├── mermaid-diagram/
│   ├── page-shell/
│   ├── repo-not-found/
│   ├── run-cost-badge/
│   ├── severity-chips/
│   └── showcase/
├── lib/                     # non-visual client code, kebab-case files
│   ├── api.ts               # the only place that calls fetch
│   ├── hooks/               # TanStack Query hooks, one file per domain
│   │   ├── core.ts          # settings, secrets, repos, pulls, context
│   │   ├── agents.ts  reviews.ts  trace.ts  repo-intel.ts
│   │   └── index.ts         # the one aggregating barrel (deliberate)
│   ├── types.ts             # client-wide types
│   ├── providers.tsx  theme.tsx  toast.tsx  repo-context.tsx
│   └── feature-models.ts  finding-format.ts  format-cost.ts  github-urls.ts
├── i18n/                    # next-intl wiring; strings live in ../messages/
├── test/                    # test setup and helpers
└── vendor/                  # vendored, never hand-edited
    ├── shared/              # @devdigest/shared — Zod contracts, mirrors the server
    └── ui/                  # @devdigest/ui — design primitives and tokens
```

Path aliases (`client/tsconfig.json`): `@/*` → `./src/*`, plus
`@devdigest/shared` and `@devdigest/ui`. Use them for anything outside the
current component folder.

## What each top-level folder is for

**`app/`** — routing and page composition. A `page.tsx` picks the hooks it
needs, handles loading / empty / error states, and composes components. It does
not compute, fetch, or hold domain rules. Route segments may also carry
`layout.tsx`, `loading.tsx`, `error.tsx`; those are `next-best-practices`
territory.

**`app/**/_components/`** — the feature code for exactly one route. The leading
underscore makes the folder invisible to the router, which is what lets feature
code sit next to the route that uses it instead of in a distant `features/`
tree. This is the project's answer to feature folders: **the route is the
feature**.

Nesting is allowed and used (`AgentEditor/_components/ConfigTab/`) when a
component has children that only it uses. Do not nest for its own sake — three
levels of `_components` inside one route usually means the top component should
have been split differently.

**`components/`** — UI that two or more routes use, plus cross-cutting chrome.
Arriving here is a promotion, not a starting point.

**`lib/`** — everything non-visual: the HTTP client, the query hooks, shared
types, context providers, and subject-named pure modules (`github-urls.ts`,
`format-cost.ts`). Note what this folder is *not*: it is not `utils/`. Every
file is named for its subject, so a reader can guess what is inside without
opening it. A file called `helpers.ts` here would be a bug.

**`vendor/`** — code owned elsewhere. `shared` must stay byte-compatible with
`server/src/vendor/shared`; `ui` holds the primitives and design tokens (see
`src/vendor/ui/README.md` before adding or restyling one). Hand-editing either
is how the two packages silently drift apart.

## Naming, in one place

| Thing | Case | Example |
|---|---|---|
| Component folder under `_components/` | PascalCase | `FindingsPanel/` |
| Component folder under `src/components/` | kebab-case | `app-shell/` |
| The component file itself, either way | PascalCase | `AppShell.tsx` |
| Satellite files | lowercase, fixed names | `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts` |
| Test | matches the component | `FindingsPanel.test.tsx` |
| Anything under `src/lib/` | kebab-case, named for its subject | `repo-intel.ts` |
| Constants | `UPPER_SNAKE_CASE` | `LOW_CONFIDENCE_THRESHOLD` |
| Hooks | `useThing` | `useSecretsStatus` |

The split between PascalCase and kebab-case folders is not arbitrary: a
PascalCase folder *is* a component, a kebab-case folder is a small module that
happens to contain one. Keeping them visually distinct means the tree tells you
which is which.

## Promotion: worked examples

**A component a second route needs.**
`run-cost-badge` started as review-detail UI. Once the runs list needed the same
badge, it moved to `src/components/run-cost-badge/` — folder renamed to
kebab-case, component file still `RunCostBadge.tsx`, `index.ts` unchanged.
Do it in one commit and update both call sites; a copy "for now" is how two
divergent badges appear.

**A helper a second component needs.**
A `formatCost()` living in one component's `helpers.ts` moves to
`src/lib/format-cost.ts` when a second component needs it — named for the
subject, not filed under a generic name. Its tests move with it.

**A constant that escapes.**
If you find yourself importing `SEVERITY_ORDER` from another route's
`constants.ts`, stop: that import is the boundary violation, not the fix. Move
the value to `src/lib/` (or, if the server also orders by severity, to the
shared contract) and import it from there.

**A type the server also needs.**
Client-only shapes live in `src/lib/types.ts`. The moment the server must agree
on a shape, it becomes a Zod schema in `@devdigest/shared` with the type
inferred from it — and that is a cross-package change, so read `../AGENTS.md`
first.

## Why feature folders look different here

Most React guidance says to group by feature in a top-level `features/` folder.
This project reaches the same goal by a different route: App Router private
folders put feature code *inside* the route that owns it, which is the same
colocation with less indirection — there is no mapping to maintain between a
route and its feature folder.

The trade-off is real and worth knowing: code shared by two routes has nowhere
natural to sit, so it goes up to `src/components/` or `src/lib/` a step earlier
than it would in a `features/` layout. That is why the promotion rule matters
so much here — it is the mechanism that keeps route folders from reaching into
each other.

If a genuine cross-route domain ever appears — something with its own
components, hooks, types and rules that several routes compose — that is the
point to discuss introducing `src/features/<domain>/` with the user, rather
than spreading it across `src/components/` and `src/lib/`.
