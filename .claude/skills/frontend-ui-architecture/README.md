# frontend-ui-architecture

UI architecture and code organization for `client/` (`@devdigest/web`). Answers
one question — **where does this code go?** — for components, business logic,
constants, types, helpers, styles, module boundaries and the server/client split.

Version 1.0.0.

## Files

| File | What is in it |
|---|---|
| `SKILL.md` | The rules and the decision procedure. Start here. |
| `references/structure.md` | The tree of `client/src`, what each folder is for, promotion examples. |
| `references/nextjs.md` | App Router as architecture: `app/` vs product code, the `use client` boundary, data access. |
| `references/enforcement.md` | Review checklist, plus a ready ESLint flat config for the boundary rules. |
| `examples.md` | Before/after pairs using real shapes from this codebase. |
| `RESEARCH.md` | Working notes behind the skill (Ukrainian): consensus, disagreements, gap analysis. |
| `README.md` | This file — every source the skill was built from. |

## Scope

This skill is deliberately narrow so it does not fight the neighbouring ones.
It covers **placement and boundaries**. It does not cover React API mechanics
(`react-best-practices`), Next.js feature mechanics (`next-best-practices`), or
testing technique (`react-testing-library`). Where it disagrees with
`client/AGENTS.md`, AGENTS.md wins.

## Sources

93 sources, grouped by the question they answer. Every link was checked (HTTP
200) or read directly; the handful that block automated checks are marked.
`RESEARCH.md` carries longer notes on each in Ukrainian, including which claims
came from which source.

### Project structure

1. [bulletproof-react — Project Structure](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) — the reference feature-based layout, unidirectional import rule, ESLint config, and its warning against barrel files. Read in full.
2. [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview) — layers, slices, segments, and the import-downward rule. Read in full.
3. [Feature-Sliced Design — site](https://feature-sliced.design/) — entry point, examples, migration guides.
4. [feature-sliced/documentation (GitHub)](https://github.com/feature-sliced/documentation) — the docs source, ADRs and rationale.
5. [Robin Wieruch — React Folder Structure Best Practices 2026](https://www.robinwieruch.de/react-folder-structure/) — the seven-stage maturity ladder, the promotion rule, file-name suffixes. Read in full.
6. [React Handbook — Project Standards](https://reacthandbook.dev/project-standards) — the eight-step order inside a component file, linting, config pointers. Read in full.
7. [React (legacy docs) — File Structure FAQ](https://legacy.reactjs.org/docs/faq-structure.html) — the official position: by feature vs by type, max 3–4 levels of nesting, "don't spend more than five minutes".
8. [Next.js — Project structure and organization](https://nextjs.org/docs/app/getting-started/project-structure) — colocation, private folders, route groups, `src/`, and the three documented strategies. Read in full.
9. [Alex Kondov — Tao of React](https://alexkondov.com/tao-of-react/) — group by module from the start, a common module, absolute paths, wrapping external components, the prop-count heuristic. Read in full.
10. [Screaming Architecture — Evolution of a React folder structure (dev.to)](https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25) — step-by-step evolution. The original at [profy.dev](https://profy.dev/article/react-folder-structure) blocks automated checks; the dev.to mirror works.
11. [Milan Jovanović — Screaming Architecture](https://milanjovanovic.tech/blog/screaming-architecture) — the original idea and its link to vertical slices and bounded contexts.
12. [Sandro Roth — How to structure your React projects](https://sandroroth.com/blog/project-structure/) — a practical walk-through.
13. [Web Dev Simplified — How To Structure React Projects](https://blog.webdevsimplified.com/2022-07/react-folder-structure/) — beginner-to-advanced tiers.
14. [Netguru — Professional React Project Structure 2025](https://www.netguru.com/blog/react-project-structure) — an agency view of current conventions.
15. [Martin Piliar — Vertical Slice Architecture in React](https://www.piliar.me/blog/vertical-slice-architecture-react-native/) — one folder per use case, in React terms.

### Colocation as a principle

16. [Kent C. Dodds — Colocation](https://kentcdodds.com/blog/colocation) — "place code as close to where it's relevant as possible", the benefits, and the two exceptions. Read in full.
17. [Kent C. Dodds — State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) — pushing state down as more than an aesthetic choice.
18. [htmx essays — Locality of Behaviour](https://htmx.org/essays/locality-of-behaviour/) — the principle stated plainly, including its honest conflict with SoC and DRY.
19. [Alex Kondov — Locality of Behavior in React Components](https://alexkondov.com/locality-of-behavior-react/) — the same principle applied inside React code.
20. [Matias Kinnunen — Locality of Behavior / Co-location](https://mtsknn.fi/blog/locality-of-behavior-and-co-location/) — a survey tying both together.

### Splitting components, composition patterns

21. [React — Thinking in React](https://react.dev/learn/thinking-in-react) — the official method for breaking a design into a component tree by single responsibility.
22. [React — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) — the official extraction mechanism, plus "resist adding abstraction too early".
23. [Dan Abramov — Presentational and Container Components](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0) — the 2015 original with the author's 2019 note retracting the recommendation. (Medium returns 403 to automated checks; opens in a browser.)
24. [patterns.dev — Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/) — a current reading of the pattern and its limits.
25. [patterns.dev — Compound Pattern](https://www.patterns.dev/react/compound-pattern/) — compound components over context.
26. [patterns.dev — React patterns index](https://www.patterns.dev/react/) — HOCs, hooks, render props, RSC and rendering patterns in one place.
27. [Kent C. Dodds — Compound Components with React Hooks](https://kentcdodds.com/blog/compound-components-with-react-hooks) — the canonical implementation.
28. [Vercel Academy — Compound Components and Advanced Composition](https://vercel.com/academy/shadcn-ui/compound-components-and-advanced-composition) — the pattern as shadcn/ui applies it.
29. [Makers Den — Advanced Guide on React Component Composition](https://makersden.io/blog/guide-on-react-component-composition) — when composition beats props.

### Business logic, state, layering

30. [React — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) — eight cases where an effect is unnecessary: derive during render, event logic in handlers, reset via `key`. Read in full.
31. [React — Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure) — the five official principles for structuring state. Read in full.
32. [React — Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer) — the official way to lift transition logic out of a component.
33. [React — Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) — the official limits of context (dependency injection, not a global store).
34. [TanStack Query — Does this replace client state managers?](https://tanstack.com/query/v5/docs/framework/react/guides/does-this-replace-client-state) — the official server-state / client-state split.
35. [Felix Gerschau — Separation of concerns with React hooks](https://felixgerschau.com/react-hooks-separation-of-concerns/) — hook as logic, service as the outside world.
36. [Alex Kondov — Hexagonal-Inspired Architecture in React](https://alexkondov.com/hexagonal-inspired-architecture-in-react/) — ports and adapters taken as inspiration rather than doctrine.
37. [Alex Bespoyasov — Clean Architecture on Frontend](https://bespoyasov.me/blog/clean-architecture-on-frontend/) — the most detailed treatment of a domain layer, DTOs and mappers on the front end.
38. [FSD Blog — Clean Architecture in Frontend: A How-To Guide](https://feature-sliced.design/blog/frontend-clean-architecture) — how Clean Architecture layers map onto FSD.
39. [profy.dev — Path To A Cleaner React Architecture: Business Logic Separation](https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) — business logic and dependency injection. (Blocks automated checks; opens in a browser.)

### Types, constants, utilities, naming

40. [Total TypeScript — Where To Put Your Types in Application Code](https://www.totaltypescript.com/where-to-put-your-types-in-application-code) — Matt Pocock's three rules. Read in full.
41. [Serghei — Where Your Types Live Matters More Than You Think](https://blog.serghei.pl/posts/where-your-types-live-matters/) — why a global `types/` folder is an anti-pattern.
42. [Why you should avoid helpers (dev.to)](https://dev.to/knzt/helpers-and-utils-folders-in-software-architecture-3f8h) — the clearest case against the junk-drawer folder.
43. [Lib vs Utils vs Services Folders](https://indie-starter.dev/blog/lib-vs-utils-vs-services-folders-simple-explanation-for-developers) — working definitions for the three.
44. [Services vs Utils (dev.to)](https://dev.to/moshfiqrony/services-vs-utils-what-is-the-difference-between-services-and-utils-5fh6) — a second reading of the same split.
45. [Sufle — Naming Conventions in React](https://www.sufle.io/blog/naming-conventions-in-react) — a consolidated table of cases for files, folders, components and constants.
46. [kettanaito/naming-cheatsheet](https://github.com/kettanaito/naming-cheatsheet) — the reference cheatsheet for naming functions and variables (recommended by React Handbook).
47. [ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) — baseline clean-code rules for JS (also from React Handbook).
48. [Iceland Digital Handbook — ADR 0009: Naming files and directories](https://docs.devland.is/technical-overview/adr/0009-naming-files-and-directories) — a real ADR from a large codebase; a model for recording a convention as a decision.

### Module boundaries and import rules

49. [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) — declarative element types and dependency rules.
50. [eslint-plugin-import — no-restricted-paths](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) — the rule bulletproof-react uses; the basis of `references/enforcement.md`.
51. [ESLint — no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports) — the minimal option, no plugins needed.
52. [Nx — Enforce Module Boundaries](https://nx.dev/docs/technologies/eslint/eslint-plugin/guides/enforce-module-boundaries) — tags and constraints at monorepo scale.
53. [Tim Deschryver — Enforce module boundaries with no-restricted-imports](https://timdeschryver.dev/bits/enforce-module-boundaries-with-no-restricted-imports) — a short recipe with config.
54. [Steve Kinney — Architectural Linting (Enterprise UI)](https://stevekinney.com/courses/enterprise-ui/architectural-linting-exercise) — turning an architectural policy into lint rules.

### Barrel files

55. [Barrel Files: Why index.ts Re-Exports Hurt Tree Shaking, Next.js Dev Memory, and tsc](https://reactuse.com/blog/barrel-files-tree-shaking/) — the most complete current analysis, with measurements.
56. [webpack discussion #16863 — barrel files, tree-shaking, code-splitting](https://github.com/webpack/webpack/discussions/16863) — the bundler maintainers' position.
57. [Speakeasy — Disabling Barrel Files](https://www.speakeasy.com/docs/sdks/customize/typescript/disabling-barrel-files) — why an SDK generator offers to turn them off.
58. [Brett Uglow — Burn the Barrel!](https://uglow.medium.com/burn-the-barrel-c282578f21b6) — the classic argument against. (Medium returns 403 to automated checks.)

### Tests

59. [Yockyard — Co-locate Your Unit Tests](https://www.yockyard.com/post/co-locate-unit-tests/) — the case for colocation.
60. [Mario Dias — Colocation of Tests: A Cross-Language Perspective](https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8) — how other ecosystems solve it. See also #16 for the official exception covering integration and e2e tests.

### UI layer and design systems

61. [Brad Frost — Atomic Design, Chapter 2](https://atomicdesign.bradfrost.com/chapter-2/) — the methodology at source.
62. [Brad Frost — Atomic Web Design (original post)](https://bradfrost.com/blog/post/atomic-web-design/) — the short 2013 version.
63. [Qt — Atomic Design Systems: Why the Labels Don't Matter](https://www.qt.io/software-insights/atomic-design-systems-why-the-labels-dont-matter) — carries Frost's own quote that the labels were never the point.
64. [Atomic design and its relevance in frontend in 2025 (dev.to)](https://dev.to/m_midas/atomic-design-and-its-relevance-in-frontend-in-2025-32e9) — what survived of the methodology.
65. [Tailwind CSS — Theme variables](https://tailwindcss.com/docs/theme) — `@theme` as the single source of design tokens.
66. [Vercel — Turborepo Design System template](https://vercel.com/templates/react/turborepo-design-system) — a reference shared-UI package layout.

### Monorepos

67. [FSD Blog — Monorepo Architecture: The Ultimate Guide](https://feature-sliced.design/blog/frontend-monorepo-explained) — apps and packages, boundaries, and when a monorepo is justified.
68. [Steve Kinney — Monoliths, Microfrontends and Monorepos](https://github.com/stevekinney/stevekinney.net/blob/main/courses/enterprise-ui/monoliths-microfrontends-and-monorepos.md) — criteria for choosing. See also #5, stage 7, on features becoming packages.
69. [Egnworks — Frontend Monorepo Architecture: Turborepo vs Nx](https://www.egnworks.com/blog/frontend-monorepo-architecture-turborepo-vs-nx-and-best-practices) — tool comparison.

### Validation and schemas

70. [vercel/next.js discussion #52652 — Sharing a form validation schema between server and client](https://github.com/vercel/next.js/discussions/52652) — where to physically keep Zod schemas so both sides can use them.

### Next.js — the server/client boundary

71. [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — when to use which, narrowing the boundary to the leaves, interleaving via `children`, providers, third-party wrappers, `server-only`/`client-only`. Read in full.
72. [Next.js — The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) — the deepest official explanation: two module graphs, what crosses (code via imports, data via props), owner vs parent, why compound components break at the line. Read in full.
73. [Next.js — `use client` (API reference)](https://nextjs.org/docs/app/api-reference/directives/use-client) — the directive's exact semantics.
74. [React — Server Components (reference)](https://react.dev/reference/rsc/server-components) — the RSC model at source, independent of Next.js.
75. [React — `'use client'` (reference)](https://react.dev/reference/rsc/use-client) — React's own statement of the same boundary.
76. [Next.js — Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) — static and dynamic as a per-component spectrum.
77. [Next.js — Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) — grouping routes and multiple root layouts as a decomposition tool.

### Next.js — data, DAL, server actions

78. [Next.js — How to think about data security](https://nextjs.org/docs/app/guides/data-security) — the three data-access approaches and the instruction not to mix them, the DAL definition, `server-only`, DTOs, "only the DAL reads `process.env`", re-authorization inside every action, and an audit checklist. Read in full. This is the source for why this repo uses External HTTP APIs rather than a DAL.
79. [Next.js — How to use Next.js as a backend for your frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) — route handlers vs server actions vs proxy, and the warning against fetching your own route handlers from server components. Read in full.
80. [Next.js — Server Actions guide](https://nextjs.org/docs/app/guides/server-actions) — execution model, queueing, caching.
81. [Next.js — Authentication](https://nextjs.org/docs/app/guides/authentication) — where session and checks sit in the architecture.
82. [Next.js blog — Security in Next.js Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — the reasoning behind the model, from the Next.js team.
83. [`server-only` (npm)](https://www.npmjs.com/package/server-only) — the marker package for server modules. (npm returns 403 to automated checks.)
84. [vercel/next.js discussion #55908 — Organizing Server Actions and Database Queries](https://github.com/vercel/next.js/discussions/55908) — the long community thread on laying out actions and queries.
85. [GitHub community discussion #184740 — Next.js 16 folder structure for server actions](https://github.com/orgs/community/discussions/184740) — a more recent pass at the same question.
86. [Ayush Sharma — Understanding the Data Access Layer in Next.js](https://aysh.me/blogs/data-access-layer-nextjs) — a practical treatment beyond the official docs.

### Next.js — structuring large applications

87. [FSD — The Ultimate Next.js App Router Architecture](https://feature-sliced.design/blog/nextjs-app-router-guide) — `app/` for routing only, `src/` for FSD layers; mutations owned by feature slices, server reads colocated with entities. Read in full.
88. [FSD — Usage with Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs) — the official fix for the layer-name collision (`_app`, `_pages`). Read in full.
89. [How I Structure Large-Scale Next.js Applications in 2026 (dev.to)](https://dev.to/vrushikvisavadiya/how-i-structure-large-scale-nextjs-applications-in-2026-41pc) — a concrete `app/ + features/ + lib/` layout and the "if only one feature uses it, it stays there" rule. Read in full.
90. [Groovy Web — Next.js Folder Structure: Best Practices for 2026](https://www.groovyweb.co/blog/nextjs-project-structure-full-stack) — the full-stack variant.
91. [Dharmsy — Next.js 16 App Router Folder Structure Best Practices](https://www.dharmsy.com/blog/nextjs-16-app-router-folder-structure) — a current pass under Next.js 16.
92. [Raghuveer — Next.js Server vs Client Components: Drawing the Right Boundary](https://www.iamraghuveer.com/posts/nextjs-server-vs-client-components/) — practical criteria for where to cut.
93. [jsmanifest — React Server Components in 2026: Patterns, Pitfalls](https://jsmanifest.com/react-server-components-patterns-pitfalls-2026) — common mistakes in boundary placement.
