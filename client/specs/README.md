# client/specs/

UI plans written before the code. A feature that also needs an endpoint or a
table belongs in the root [`../../specs/`](../../specs/) instead.

Naming: `<slug>.md`, or `L<NN>-<slug>.md` when it implements a lesson.

A client spec should answer, in this order:

1. **Route** — the path under `src/app/`, and whether the page is a server or a
   client component.
2. **Component tree** — which `_components/<Name>/` folders appear, and which
   existing `@devdigest/ui` primitives it reuses instead of inventing.
3. **Data** — the hook in `src/lib/hooks/*`, the endpoint it calls, the query
   key, and what invalidates it.
4. **States** — loading, empty, error, and the degraded case (API down, repo not
   indexed, no API key configured).
5. **Tests** — the interactions the `*.test.tsx` must cover; whether an
   [`../../e2e`](../../e2e/) flow is also needed.
