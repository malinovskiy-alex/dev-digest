# App Router architecture

Reference for `frontend-ui-architecture`. This covers Next.js as an
*architectural* concern — what belongs in `app/`, where the server/client line
falls, and how data reaches the tree. For how a given feature works
mechanically (metadata, streaming, caching, parallel routes), use
`next-best-practices` instead; this file deliberately does not restate it.

## Contents

- [`app/` is routing, not a home for code](#app-is-routing-not-a-home-for-code)
- [The server/client boundary](#the-serverclient-boundary)
- [How data reaches the tree](#how-data-reaches-the-tree)
- [Why this repo does not use a Data Access Layer](#why-this-repo-does-not-use-a-data-access-layer)
- [If the architecture ever changes](#if-the-architecture-ever-changes)

## `app/` is routing, not a home for code

Next.js is explicitly unopinionated about project organization — it ships
*tools*, not a structure, and the docs give three equally valid strategies.
The tools worth knowing:

- **Colocation is safe by default.** A folder in `app/` is not a public route
  until it contains `page.tsx` or `route.ts`. Project files can sit next to a
  route without becoming reachable.
- **Private folders** (`_components/`) are excluded from routing outright. This
  repo uses them as its feature-folder mechanism.
- **Route groups** (`(group)`) organize routes without touching the URL and
  allow different layouts per group.
- **`src/`** separates application code from root configuration.

What the framework does not decide for you is the split of responsibility, and
that is where projects drift: business logic slowly accumulates in `app/` until
routes and domain rules are the same thing. The rule that prevents it is
narrow — **`app/` owns routes, layouts, loading/error states and composition;
everything else lives below it.**

In this repo the split is: `page.tsx` composes, `_components/` holds the
feature UI, `src/lib/hooks/*` holds the data access, `src/lib/api.ts` holds the
transport.

## The server/client boundary

`'use client'` marks a boundary in the module graph, not a component. Two rules
govern what crosses it:

- **Code crosses through imports.** Everything a client component imports joins
  the client bundle. This is why the directive's *position* matters: put it on
  a layout because one child needs a click handler, and the whole subtree
  follows it into the browser.
- **Data crosses through props**, and must be serializable. Functions do not
  cross; a `'use server'` function crosses as a reference.

The exception that makes composition work: **server components passed as
`children` or props are not imported into the client graph.** They render on
the server and the client component receives their output. This is the "slot"
pattern:

```tsx
// page.tsx — server component
<Modal>          {/* client: owns open/close state */}
  <Cart />       {/* server: renders on the server, Modal never imports it */}
</Modal>
```

Practical consequences worth carrying:

- Render context providers **as deep as they need to be**, not around `<html>`.
- A compound component's static properties (`Tabs.Panel`) break across the
  boundary — a server component importing a client component gets a reference,
  so `Tabs.Panel` is `undefined` and React throws "Element type is invalid".
  Expose the pieces as named exports when they must be used from both sides.
- Third-party components that use client-only features need a thin
  `'use client'` re-export wrapper rather than the directive spreading into
  your shared modules.

### What the boundary looks like here today

- every `page.tsx` under `src/app/` carries `'use client'`;
- `src/app/layout.tsx` is the only server component;
- `src/lib/hooks/core.ts` opens with `'use client'` — the hooks are client-side
  by construction, because TanStack Query runs in the browser;
- there are no `'use server'` modules and no `server-only` imports.

This is a consequence of the product architecture, not an oversight: the
authoritative backend is the Fastify API on `:3001`, and the client is a SPA
that talks to it. Do not "fix" it opportunistically.

For **new** code the convention still holds — server component by default, push
the directive down to the interactive leaves. A new mostly-static page with two
interactive widgets should keep `'use client'` on the widgets. When editing a
page that already has the directive at the top, narrowing the boundary is a
refactor with its own risk; propose it, do not slip it in.

## How data reaches the tree

The path is fixed and one-directional:

```
component  →  hook in src/lib/hooks/*  →  src/lib/api.ts  →  Fastify :3001
```

- **Never `fetch` in a component.** Adding an endpoint means adding a hook.
- A hook owns its query key, its invalidation, and its mutations. Related
  invalidations belong next to the mutation that causes them — `useTestConnection`
  invalidating `provider-models` and `secrets-status` is the pattern to copy.
- `src/lib/api.ts` owns transport only: base URL, headers, and normalizing
  failures into `ApiError` so the error-UX taxonomy can branch on status.
- Loading, empty, error and degraded states are handled by the component that
  called the hook — usually the page. `client/specs/README.md` requires a spec
  to name them before the screen is built.

Hook files are split by domain (`core`, `agents`, `reviews`, `trace`,
`repo-intel`) and re-exported from `hooks/index.ts`. A new endpoint goes in the
domain file it belongs to; a new domain is a new file, added to the barrel.

## Why this repo does not use a Data Access Layer

Next.js documents three approaches to data access and asks you to pick one and
not mix them:

| Approach | Intended for |
|---|---|
| **External HTTP APIs** (Zero Trust) | existing apps, separate backend teams |
| **Data Access Layer** | new projects where Next.js *is* the backend |
| queries directly in server components | prototypes and learning |

This repo is squarely the first case. The DAL guidance — `import 'server-only'`,
authorization inside the data functions, returning DTOs rather than database
rows, only the DAL reading `process.env` — describes a Next.js app that owns
its database. Here the database is the server's, and authorization lives there.

So: **do not propose a DAL, server actions, or `server-only` for a screen that
reads the DevDigest API.** It adds a layer that duplicates the Fastify one and
splits the security model across two codebases.

What does carry over from that guidance, because it is about the boundary
rather than about the DAL:

- only send the client what the UI needs — the same reason the API returns
  booleans for `useSecretsStatus` rather than key values;
- `NEXT_PUBLIC_`-prefixed environment variables are public by definition. The
  client holds no secrets; if a screen seems to need one, it needs an endpoint.

## If the architecture ever changes

Should Next.js ever take on server-owned data here — a route handler doing more
than proxying, or a server action — the rules change, and this file should
change with it. Do not apply them speculatively. The decision tree at that
point:

- **reading data** → server component, straight from the source. Do not fetch
  your own route handler from a server component: it is an extra HTTP round
  trip, and it fails the build for pages prerendered at build time.
- **mutating from the UI** → server action. Actions are queued, so they are the
  wrong tool for reads.
- **a public HTTP endpoint** — webhooks, OAuth callbacks, non-HTML content
  (`rss.xml`, sitemap), proxying, CORS for third-party clients → route handler.

And a rule that bites regardless of architecture: **a page-level auth check does
not protect a server action defined in that page.** An action is a separate
entry point, reachable by direct POST, so it re-verifies the caller itself —
authentication *and* ownership of the resource.
