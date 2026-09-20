# onion-architecture

Onion architecture for `server/` (`@devdigest/api`) and `reviewer-core/`.
Answers one question — **which ring does this code belong to, and which way is
it allowed to import?** — for routes, services, repositories, adapters, ports,
jobs, errors and tests.

Version 1.0.0.

## Files

| File | What is in it |
|---|---|
| `SKILL.md` | The rule, the four rings, the decision procedure. Start here. |
| `references/rings.md` | Every path in `server/src` mapped to a ring; promotion examples; package boundaries. |
| `references/tooling.md` | The ruling per tool: Fastify, Drizzle, Zod, the container, jobs, errors, tests. |
| `references/enforcement.md` | Each `pnpm arch` rule, what it catches, how to fix it; the review checklist. |
| `examples.md` | Before/after pairs, all taken from real files in this repository. |
| `evals/` | Three cases: place a new module, refactor a flat one, review a diff. |
| `RESEARCH.md` | Working notes (Ukrainian): consensus, disagreements, the audit, decisions taken. |
| `README.md` | This file — every source the skill was built from. |

Outside the skill folder it also owns:

- `server/.dependency-cruiser.cjs` — the rules, all `severity: error`.
- `server/.dependency-cruiser-known-violations.json` — the 21 grandfathered violations.
- `server/specs/onion-debt.md` — what each one costs and how to clear it.
- `pnpm arch` / `arch:all` / `arch:baseline` in `server/package.json`.

## Scope

Deliberately narrow, so it does not fight its neighbours. It covers **placement
and dependency direction**. It does not cover Fastify mechanics
(`fastify-best-practices`), query syntax (`drizzle-orm-patterns`), schema design
(`postgresql-table-design`), validation technique (`zod`) or input safety
(`security`). Where it disagrees with `server/AGENTS.md`, AGENTS.md wins.

## Sources

Grouped by the question they answer. Every link was opened; where a claim in the
skill traces to a specific source, `RESEARCH.md` says which.

### The canon

1. [Jeffrey Palermo — The Onion Architecture, part 1](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/) — the 2008 original: interfaces for behaviour contracts, "forces the externalization of infrastructure", and the explicit warning that it is not for small sites.
2. [jeffreypalermo.com — the onion-architecture tag](https://jeffreypalermo.com/tag/onion-architecture/) — parts 2–4.
3. [Herberto Graça — Onion Architecture](https://herbertograca.com/2017/09/21/onion-architecture/) — where onion sits among the other styles.
4. [The Software Architecture Chronicles — Onion Architecture](https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85) — the same material on Medium.
5. [Oliver Drotbohm — Sliced Onion Architecture](https://odrotbohm.github.io/2023/07/sliced-onion-architecture/) — **the key source for this skill**: how concentric rings coexist with vertical modules, and why per-module ring folders are a mistake.
6. [Milan Jovanović — Clean vs Onion vs Hexagonal](https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal) — the three are one idea; the dependency rule matters more than the labels; when it is overkill.
7. [Khalil Stemmler — The Dependency Rule](https://khalilstemmler.com/wiki/dependency-rule/) — the one-line statement.
8. [Wikipedia — Hexagonal architecture (Ports & Adapters)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) — the port/adapter vocabulary this codebase already uses.
9. [Eric Damtoft — Onion vs Clean vs Hexagonal](https://medium.com/@edamtoft/onion-vs-clean-vs-hexagonal-architecture-9ad94a27da91) — a short side-by-side.

### Node.js / TypeScript practice

10. [Remo Jansen — Implementing SOLID and the onion architecture in Node.js with TypeScript](http://blog.wolksoftware.com/implementing-solid-and-the-onion-architecture-in-node-js-with-typescript-and-inversifyjs) — the reference TS write-up; we take the layering and skip the IoC container.
11. [The same article on DEV](https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad)
12. [Remo Jansen — Enforce Clean Architecture with fresh-onion](https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi) — the idea of checking boundaries mechanically rather than by review.
13. [André Bazaglia — Clean architecture with TypeScript: DDD, Onion](https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/)
14. [Melzar/onion-architecture-boilerplate](https://github.com/Melzar/onion-architecture-boilerplate) — a full Node+TS folder layout to compare ours against.
15. [Sankhadip Samanta — Onion Architecture in Node.js with TypeScript](https://sankhadip.medium.com/onion-architecture-in-node-js-with-typescript-5508612a4391)

### Enforcement

16. [dependency-cruiser — rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) — `forbidden` / `allowed`, `from`/`to`, `pathNot`, group matching with `$1`, `tsPreCompilationDeps`.
17. [Atomic Object — Dependency Cruiser: Restrict Imports in JavaScript](https://spin.atomicobject.com/dependency-cruiser-imports/) — a layered-rule walkthrough.
18. [Jakub Andrzejewski — Avoid Cross Module Dependencies with Dependency Cruiser](https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b) — the "a module never reaches into a sibling" rule.

### Fastify and dependency injection

19. [fastify/help #284 — best practice for dependency injection](https://github.com/fastify/help/issues/284) — the maintainers' position: plugin encapsulation and `decorate`, not a DI framework.
20. [fastify-decorators — Services and dependency injection](https://github.com/L2jLiga/fastify-decorators/blob/v3/docs/Services%20and%20dependency%20injection.md)
21. [fastify-resty — Dependency Injection](https://github.com/FastifyResty/fastify-resty/blob/main/docs/Dependency-Injection.md)

### Repositories and Drizzle

22. [Sentry Blog — Atomic Repositories in Clean Architecture and TypeScript](https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/) — "don't expose raw schema types beyond repository boundaries"; the argument this skill actually uses.
23. [Khalil Stemmler — DTOs, Mappers & the Repository Pattern](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/) — the maximalist position.
24. [Jay Freestone — You might not need the repository pattern](https://dev.to/jayfreestone/you-might-not-need-the-repository-pattern-46b) — the counter-argument; the reason for the "when not to do this" section.
25. [Repository Pattern with Drizzle ORM](https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae)
26. [Drizzle ORM Best Practices](https://paulserban.eu/blog/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/)

### Internal

`server/AGENTS.md` · `reviewer-core/AGENTS.md` (the three invariants) ·
`server/README.md` (the DI flow diagram) · `server/INSIGHTS.md` ·
`src/db/rows.ts` (its header states the shared-row-type convention) ·
`.claude/skills/frontend-ui-architecture/` (the format this skill mirrors).
