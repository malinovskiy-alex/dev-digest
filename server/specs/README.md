# server/specs/

Server-side plans written before the code. A spec that also needs a screen or a
prompt slot belongs in the root [`../../specs/`](../../specs/) instead — most
course lessons do.

Naming: `<slug>.md`, or `L<NN>-<slug>.md` when it implements a lesson.

A server spec should answer, in this order:

1. **Route surface** — method, path, params/body, response, status codes.
2. **Contract** — the Zod shapes added to `@devdigest/shared` (both vendored
   copies), since they drive validation *and* serialization.
3. **Schema** — new tables/columns, the migration, how `workspace_id` scopes it.
4. **Module** — which `src/modules/<name>/` owns it; which container adapters it
   needs and which mock stands in for each under test.
5. **Tests** — what is hermetic vs what needs `*.it.test.ts` and a real Postgres.
