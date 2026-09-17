# server/docs/

Deep-dives into the API that do not belong in [`../README.md`](../README.md)
(which stays a map: stack, request/DI flow, API surface, env, testing).

Candidates to write as they come up: the run lifecycle and its states, the SSE
event contract, the secrets chokepoint, the migration workflow, the tenancy
guard, adapter/port boundaries.

Subsystem docs that already exist elsewhere:
[`repo-intel`](../src/modules/repo-intel/README.md) — the indexer pipeline and
its `repoIntel.*` facade.

Rules: one topic per file, Mermaid for diagrams, reference code by path instead
of pasting it. Plans go to [`../specs/`](../specs/), gotchas to
[`../INSIGHTS.md`](../INSIGHTS.md).
