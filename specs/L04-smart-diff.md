# L04 — Smart Diff

**Goal:** on a PR's *Files changed* tab, a reviewer sees the files grouped by
role — core → tests → wiring → docs → boilerplate — and sees the latest
review's findings inline, under the line they cite. No more switching to
*Agent runs* to find out what the agent said about a file.

**Not in scope:**

- `split_suggestion` beyond the minimum (`too_big: false`, `proposed_splits: []`).
  The `largeTitle` / `largeBody` strings stay unused.
- `pseudocode_summary` — the field stays in the contract and is never set.
- Any model call, prompt change or reviewer-core change. L08 will reuse
  `classifyFile` as a prompt filter; this lesson only makes that possible.
- Changing the *Agent runs* tab. `FindingsTab`, `FindingsPanel` and
  `FindingCard` behave exactly as before.
- A new table, column or migration. None is needed.
- Persisting the Smart/Original toggle (URL or storage). It is local state.

**Branch:** `lesson/L04-homework` (never `main`)

**Requirements source:** the course brief for L04 Smart Diff (P1 user stories
S1–S5 below). Built from the brief and the current code. Do **not** restore
or copy an earlier implementation from git history.

| # | P1 story (from the brief) | Steps | Done-when |
|---|---|---|---|
| S1 | Files grouped core → tests → wiring → docs → boilerplate. Each group header shows the role label, a short description and the file count. | 1–7, 11–14 | D1 |
| S2 | docs and boilerplate start collapsed. A lock-file lands in boilerplate. | 3, 13 | D2 |
| S3 | After a review: the group header shows a red dot and the **number of files in the group that have findings**, right-aligned before "N files". The file card shows a dot (no number) next to the path, separate from the GitHub comment counter. | 6, 9–10, 13–15 | D3 |
| S4 | Expanding such a file shows a finding comment under line `RIGHT:${start_line}`: severity, title, rationale, suggested fix, Accept / Dismiss. It looks like the Agent-runs `FindingCard`. The line gets a coloured left bar and a right-aligned label (CRITICAL → "blocker", WARNING → "warning", SUGGESTION → "suggestion"). | 9–10, 14 | D4 |
| S5 | A "Smart order \| Original order" segmented toggle, top right, switches back to GitHub order. Above the groups: the caption "REVIEWER-ORDERED DIFF" and a "9 files · +247 −38" summary. | 12, 14 | D5 |

---

## Starter inventory — checked against this fork

Every piece the brief says already exists, checked on `lesson/L04-homework`
(HEAD `5c32d58`):

| Brief says | Found | Notes |
|---|---|---|
| `SmartDiff` contract in both `brief.ts` | `server/src/vendor/shared/contracts/brief.ts:80-113`, `client/src/vendor/shared/contracts/brief.ts:80-113` | `diff -r` of the two `vendor/shared` trees reports no differences today |
| `SmartDiffRole` = 3 values | `brief.ts:81` (both): `z.enum(['core', 'wiring', 'boilerplate'])` | extended to 5 in step 1 |
| `SmartDiffFile` / `SmartDiffGroup` / `split_suggestion` | `brief.ts:84-91`, `:93-97`, `:105-112` | `finding_lines: z.array(z.number().int())`, `pseudocode_summary: z.string().nullish()` |
| `SmartDiffResponse` | `contracts/review-api.ts:63-65` (both) | `= SmartDiff`. Nothing serves it yet, and no route matching `smart-diff` exists |
| contract unit test | `server/test/contracts.test.ts:108-119` | parses a `core` group only |
| `GET /pulls/:id` → `files[]` | `server/src/modules/pulls/routes.ts:216-305` | **deletes and re-inserts `pr_files` on every call when a GitHub token works** (`:238-248`). See Risks |
| `GET /pulls/:id/reviews` | `server/src/modules/reviews/routes.ts:136-139` → `ReviewService.reviewsForPull` (`service.ts:160-174`) | newest first (`repository/review.repo.ts:58-74`, `orderBy(desc(createdAt))`) |
| "latest review" precedent | `server/src/modules/pulls/routes.ts:130-143` | `kind = 'review'`, newest `created_at` first, so the first row per PR wins. The PR list's score and severity columns use it |
| `usePrReviews(prId)` | `client/src/lib/hooks/reviews.ts:51-57` | key `["reviews", prId]` |
| `useFindingAction()` | `client/src/lib/hooks/reviews.ts:139-161` | invalidates `["reviews", prId]` |
| other `["reviews", prId]` invalidations | `reviews.ts:68` (delete run), `:85` (delete review), `:133` (run review) | prefix-matching, which step 8 relies on |
| `DiffTab` → `DiffViewer` | `client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/DiffTab.tsx:62` | `DiffTab` is `.tsx` + `index.ts` only, with hard-coded strings at `:55` and `:60` |
| `DiffViewer` | `client/src/components/diff-viewer/DiffViewer/DiffViewer.tsx:14-32` | a flat list of `FileCard`s. Consumers: `DiffTab` and `client/src/test/smoke.test.tsx:27-45` |
| `FileCard` | `client/src/components/diff-viewer/FileCard/FileCard.tsx:65-128` | open state `:67-69`. Comment counter `:99-106` |
| `AUTO_EXPAND_MAX_LINES = 200` | `client/src/components/diff-viewer/constants.ts:4` | |
| `parsePatch` | `client/src/components/diff-viewer/helpers.ts:12` | `Line { kind, text, oldNo?, newNo? }` |
| `lineKey` / `keysForLine` / `partitionThreads` | `client/src/components/diff-viewer/comments.ts:34`, `:63`, `:89` | the key is `` `${side}:${line}` `` |
| `CodeLine` | `client/src/components/diff-viewer/CodeLine/CodeLine.tsx:12-84` | renders threads under the row (`:67-71`) |
| `FindingCard` | `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingCard/FindingCard.tsx:26-117` | props: `f`, `defaultExpanded`, `onAction`, `pending`, `repoFullName`, `headSha`. Consumed at `FindingsPanel.tsx:100-108` |
| `SEV` / `SeverityBadge` | `client/src/vendor/ui/primitives/tokens.ts:6-14` (`SEV`: `c`, `bg`, `icon`, `label`), `Badge.tsx:52` | `SEV` is exported from `@devdigest/ui` (`primitives/index.ts:2`) |
| `prReview.json` `smartDiff` keys | `client/messages/en/prReview.json:53-62` | `coreLabel`, `wiringLabel`, `boilerplateLabel`, `largeTitle`, `largeBody`, `filesCount`, `findingLines`, `groupedByRole`. No code reads any of them (grep) |
| `Severity` | `vendor/shared/contracts/findings.ts:11` | `CRITICAL \| WARNING \| SUGGESTION` (`SEV` also has `INFO`) |

Not in the brief, but it shapes the plan:

- **`client/eslint.config.mjs` exists** and `pnpm lint` enforces
  `src/components` ↛ `src/app` (`:76-81`), route isolation, and imports only
  through `index.ts` (`:93-96`). The `frontend-ui-architecture` skill still says
  "no ESLint in this repository". It is stale, and `client/AGENTS.md` and the
  config win.
- **The arch rule's Ring-1 regex does not reach subfolders.**
  `server/.dependency-cruiser.cjs:51`:
  `DOMAIN = '…|^src/modules/[^/]+/helpers\\.ts$'`. A
  `reviews/smart-diff/helpers.ts` would not be checked by `core-no-io`. No
  nested `helpers.ts` exists today (`find src/modules -name helpers.ts`), so
  widening the regex is a zero-violation change (step 2).
- `pnpm arch` on a clean tree: *no dependency violations, 21 known ignored*.

## Decisions

| # | Decision | Why |
|---|---|---|
| D-1 | **The grouping comes from the new route.** The client never classifies. It consumes `GET /pulls/:id/smart-diff` for group membership, group order and `finding_lines`. | One classifier, in one place, which L08 reuses server-side. The client keeps no second copy of the rules. |
| D-2 | **The server code lives in the reviews module**, in a subject subfolder: `server/src/modules/reviews/smart-diff/{constants,helpers}.ts`. | The route needs `pr_files` and findings, both read today by `ReviewRepository` (`getPrFiles`, `review.repo.ts`). A sibling `smart-diff` module would either reach into `reviews` (`no-cross-module`) or duplicate its queries. L08's prompt builder is `reviews/run-executor.ts`, the same module, so the import stays legal. A subject subfolder follows `reviews/repository/{pull,review,run}.repo.ts`. |
| D-3 | **"Latest review"** = the newest `reviews` row for the PR **with `kind = 'review'`**, ordered by `created_at DESC` and scoped by `workspace_id`. Its findings, **dismissed and accepted included**, feed `finding_lines`. | It is the same rule as the PR list (`pulls/routes.ts:130-143`) and the same counting rule as `PrMeta.findings` (`server/INSIGHTS.md:170-182`). The diff shows dismissed findings greyed through `FindingCard`'s existing `muted` style, so the counts must include them. The cost of this rule is in Risks: after "Run all", only the last agent to finish is shown. |
| D-4 | **The client takes the review the server names.** *(Amended after architecture review.)* `SmartDiff` carries `review_id` (the newest `kind='review'` review, or `null`); the client picks `reviews.find(r => r.id === review_id)` from `usePrReviews` via `inlineFindings`. Until smart-diff resolves, no findings render inline. | `FindingCard` needs full `FindingRecord`s, which the contract does not carry. The rule lives once, on the server; the original plan re-derived it on the client (`latestReviewFindings`), which architecture-reviewer flagged as a non-authoritative duplicate. |
| D-5 | **The smart-diff query key is `["reviews", prId, "smart-diff"]`.** | TanStack invalidation matches by prefix. Every existing `["reviews", prId]` invalidation (`reviews.ts:68,85,133,158`) then refreshes the grouping for free. The one exception is the exact-key `refetchReviews()` at `page.tsx:160`, and step 15 adds the invalidation there. |
| D-6 | **`DiffViewer` stays route-agnostic.** It gains an optional `findings?: DiffFindingApi` prop: `{ findings: FindingRecord[]; renderFinding: (f) => ReactNode }`. `DiffTab` passes a `renderFinding` that renders the route-private `FindingCard`. | `src/components` may not import from `src/app` (`eslint.config.mjs:76-81`). Moving `FindingCard` up to `src/components/` is wrong too: every consumer is in one route, and the skill says promote on a second *route*. A render slot is the composition the skill prefers over configuration. |
| D-7 | **Empty groups are omitted** by the server. The groups that remain always come in the fixed order core → tests → wiring → docs → boilerplate. | A "0 files" header is noise. A unit test pins this. |
| D-8 | **Within a group, files keep GitHub order.** The client sorts each group's files by their index in `pr.files`. | `pr_files` has no order column, and `getPrFiles` (`repository/pull.repo.ts:29-34`) has no `ORDER BY`, so the server's order is not guaranteed. `pr.files` is the GitHub order that "Original order" shows. |
| D-9 | **No silent fallbacks.** While `useSmartDiff` is loading or errored, or when its paths do not cover every `pr.files` path, `DiffTab` renders Original order and disables the toggle. A finding whose `start_line` is not a rendered RIGHT line is shown in a "findings outside the shown lines" block at the bottom of its file, in the same way as `OutdatedComments`. | A file or a finding must never disappear because of the grouping. |
| D-10 | **`package.json` (any depth) is classified as `wiring`.** This goes beyond the brief's list and is pinned in the table test. | Without it, `package.json` falls through to *core — "review closely"*. Seeded PRs #485 and #486 change it (`server/src/db/seed-fixtures.ts:201,359`), so the demo would show it in the wrong group. It is one line to revert if the course disagrees. |
| D-11 | **Path matching is hand-written string logic.** It uses basename, extension and segment checks, with no glob library, no `RegExp` built from input, and no new dependency. | `server/package.json` has no glob/minimatch dependency. Adding one would rewrite `pnpm-lock.yaml`, which a feature commit must not do. File paths come from GitHub and are attacker-influenced, so plain string ops avoid ReDoS. |
| D-12 | **Anchoring rules.** `dist/`, `build/` and `e2e/` match only as the **first** path segment. `test/`, `tests/`, `__tests__/`, `__snapshots__/`, `docs/`, `.github/` and `.claude/` match **any** segment. Paths are normalised first (`\` → `/`, a leading `./` stripped). | Taken literally from the brief's patterns (`dist/**` vs `**/test/**`). `src/build/plan.ts` stays core, and the test pins it. |
| D-13 | **Colour cues.** The file-header dot takes the colour of the file's highest severity (`SEV[sev].c`). The group dot is always `var(--crit)` (the mockup's red dot). Both have an accessible name. | The brief asks for a red group dot. A red dot on a file that only has suggestions would overstate it. `SeverityBadge`'s own rule is "never color alone" (`Badge.tsx:51`). |
| D-14 | **New components use Tailwind class strings in `styles.ts`.** These are `SmartDiffGroup`, `DiffOrderToggle` and `DiffTab`'s new header. Existing `diff-viewer` files keep extending their `CSSProperties` objects. | `client/AGENTS.md` (naming: `styles.ts # Tailwind class strings`) and the skill both say this. Never mix the two within one component. See Risks: these are the first Tailwind classes in `src/app`. |
| D-15 | **The touched strings in `DiffTab` move to i18n.** These are `"Files changed · N files"` (`DiffTab.tsx:60`) and `"Show/Hide comments"` (`:55`). | The JSX is being rewritten anyway, and `client/AGENTS.md` forbids hard-coded user-facing strings. |

## Touches

**shared contracts** (vendored twice, same commit):
`contracts/brief.ts` (`SmartDiffRole` → 5 values).

**server:** `.dependency-cruiser.cjs` (`DOMAIN` regex) ·
`modules/reviews/smart-diff/constants.ts` (new) ·
`modules/reviews/smart-diff/helpers.ts` (new: `classifyFile`, `buildSmartDiff`) ·
`modules/reviews/repository/review.repo.ts` + `repository.ts`
(`latestReviewFindingAnchors`) · `modules/reviews/service.ts`
(`smartDiffForPull`) · `modules/reviews/routes.ts` (`GET /pulls/:id/smart-diff`)
· tests in `server/test/`.

**client:** `src/lib/hooks/reviews.ts` (`useSmartDiff`) ·
`src/components/diff-viewer/` (`findings.ts` new, `constants.ts`, `styles.ts`,
`index.ts`, `DiffViewer`, `FileCard`, `CodeLine`) ·
`pulls/[number]/_components/DiffTab/` (rewritten, plus nested
`_components/SmartDiffGroup/` and `_components/DiffOrderToggle/`) ·
`pulls/[number]/page.tsx` (two props, one invalidation) ·
`messages/en/prReview.json`, `messages/en/shell.json`.

**reviewer-core:** nothing. **e2e:** nothing new. `05-pr-diff.flow.json` must
stay green (D7).

## Contract

Both files, byte-identical, **one commit**:

- `server/src/vendor/shared/contracts/brief.ts:81`
- `client/src/vendor/shared/contracts/brief.ts:81`

```ts
// Display order = enum order: core → tests → wiring → docs → boilerplate.
export const SmartDiffRole = z.enum(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
```

Nothing else in the contract changes. `SmartDiffFile`, `SmartDiffGroup`,
`SmartDiff` and `SmartDiffResponse` (`review-api.ts:63-65`) are used as they are.

**Route:** `GET /pulls/:id/smart-diff`
- params `IdParams` (`modules/_shared/schemas.ts`, uuid). A bad id gets **422** before the handler runs.
- the response schema `200: SmartDiffResponse` is declared on the route (`serializerCompiler` is installed at `src/app.ts:65`)
- **404** `NotFoundError('Pull request not found')` when the PR is not in the caller's workspace
- body: `{ groups: SmartDiffGroup[], split_suggestion: { too_big: false, total_lines: Σ(additions + deletions) over pr_files, proposed_splits: [] } }`
- `finding_lines` per file: the **unique, ascending** `start_line`s of D-3's review whose `file === path`. A file with no findings gets `[]`.

## Classifier

`classifyFile(path: string): SmartDiffRole`. The first matching rule wins, and
rules are checked in **precedence order**:
boilerplate → tests → wiring → docs → core. This is not the same as the
display order.

| Role | Matches (after D-12 normalisation) |
|---|---|
| boilerplate | basename ends with `.lock`, or is `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` · first segment `dist` or `build` · any segment `__snapshots__` · basename ends with `.snap` · basename contains `.generated.` · basename ends with `.min.js` |
| tests | basename ends with `.test.{ts,tsx,js,jsx}` (this covers `.it.test.ts`) or `.spec.{ts,tsx,js,jsx}` · any segment `test`, `tests` or `__tests__` · first segment `e2e` |
| wiring | basename `index.ts` / `index.js` · basename contains `.config.` · basename `tsconfig*.json` · basename starts with `.eslintrc` · basename starts with `.env` · basename `docker-compose*.yml` / `docker-compose*.yaml` · basename `package.json` (D-10) · any segment `.github` or `.claude` |
| docs | basename ends with `.md` / `.mdx` · any segment `docs` · basename starts with `README`, `CHANGELOG` or `LICENSE` (case-insensitive) |
| core | everything else |

**Table test (written first, step 3).** The three cases the brief requires are
marked ★:

| path | role | pins |
|---|---|---|
| ★ `__tests__/__snapshots__/x.snap` | boilerplate | boilerplate beats tests |
| ★ `.claude/skills/security/SKILL.md` | wiring | wiring beats docs |
| ★ `e2e/README.md` | tests | tests beats docs (kept as the brief allows) |
| `pnpm-lock.yaml`, `server/pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `Cargo.lock` | boilerplate | the lock-file story (S2) |
| `dist/index.js`, `build/app.js`, `src/api.generated.ts`, `public/vendor.min.js` | boilerplate | |
| `src/build/plan.ts` | core | `build/` is first-segment only (D-12) |
| `src/billing/discount.test.ts`, `server/test/reviews.it.test.ts`, `src/a.spec.tsx`, `src/__tests__/a.ts`, `e2e/specs/05-pr-diff.flow.json` | tests | |
| `src/components/index.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.json`, `.env.example`, `docker-compose.yml`, `.github/workflows/ci.yml`, `package.json`, `client/package.json` | wiring | |
| `README.md`, `CHANGELOG.md`, `LICENSE`, `server/docs/overview.png`, `specs/L04-smart-diff.md` | docs | |
| `src/config.ts`, `src/api/routes.ts` | core | |
| `src\billing\x.test.ts` | tests | backslash normalisation |

## Skill map

Derived from `.claude/skills/pr-self-review/references/routing.md`, then
reconciled against the planner's skill table.

| Step | Path | Skills the implementer loads |
|---|---|---|
| 1 | `{server,client}/src/vendor/shared/contracts/brief.ts` | `zod` |
| 1 | `server/test/contracts.test.ts` | **not in routing.md** (`server/test/**` is not routed). Use `zod` |
| 2 | `server/.dependency-cruiser.cjs` | **not in routing.md**. Use `onion-architecture` (`references/enforcement.md`) |
| 3, 6 | `server/test/smart-diff-*.test.ts`, `server/test/routes-smoke.test.ts` | **not in routing.md**. Use `onion-architecture` (§ "Tests prove the architecture") |
| 4 | `server/src/modules/reviews/smart-diff/{constants,helpers}.ts` | `onion-architecture`, `typescript-expert` (routing: "any other `server/src/**/*.ts`" → `onion-architecture`) |
| 5 | `server/src/modules/reviews/repository/review.repo.ts`, `repository.ts` | `drizzle-orm-patterns`, `onion-architecture`; perf rubric `docs/agent-prompts/performance-reviewer.md` |
| 6 | `server/src/modules/reviews/service.ts` | `onion-architecture`; perf rubric `docs/agent-prompts/performance-reviewer.md` |
| 7 | `server/src/modules/reviews/routes.ts` | `fastify-best-practices`, `onion-architecture`, `security`, `zod` (content trigger) |
| 7 | `server/test/reviews.it.test.ts` | **not in routing.md**. Use `drizzle-orm-patterns` for the direct inserts |
| 8 | `client/src/lib/hooks/reviews.ts` | `frontend-ui-architecture`, `typescript-expert` |
| 9–10 | `client/src/components/diff-viewer/**` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` |
| 9–10, 13–14 | `client/src/**/*.test.ts(x)` | `react-testing-library` |
| 11 | `client/messages/en/{prReview,shell}.json` | none (routing: "G12 only") |
| 12–14 | `client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/**` | `frontend-ui-architecture`, `react-best-practices`, `next-best-practices` |
| 15 | `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` | `frontend-ui-architecture`, `next-best-practices`, `react-best-practices` |

`security` also applies to step 7 (input: path param, attacker-influenced file
paths) and to step 14 (AI-generated rationale rendered as markdown). Nothing in
this plan touches `process.env`, secrets or auth.

## Constraints

| Constraint | Source |
|---|---|
| `@devdigest/shared` is vendored twice. Edit both `brief.ts` files in one commit and typecheck both packages | `AGENTS.md` (hard rules), `client/INSIGHTS.md:165-171` |
| In `client/`, import **types only** from `@devdigest/shared`. A runtime list of roles is a local const with a compile-time exhaustiveness check | `server/INSIGHTS.md:54-69`, pattern `client/src/lib/skill-types.ts` |
| …and only `pnpm build` catches a violation of the line above, never `pnpm test` or `tsc` | `server/INSIGHTS.md:64-68` |
| never run `pnpm build` while `pnpm dev` is up | `client/INSIGHTS.md:22-42` |
| imports point inward. Ring-1 helpers import nothing but `@devdigest/shared` types and siblings. `pnpm arch` must stay at 0 new / 21 known | `server/AGENTS.md` (conventions), `server/.dependency-cruiser.cjs:51` |
| a service may `new` only its own module's repository. Do not copy the service-locator style into new code. Here we only add a method to the existing `ReviewService` | `server/INSIGHTS.md:156-168` |
| new SQL goes in the repository, never in `routes.ts` | `server/INSIGHTS.md:142-154` |
| a test that touches Postgres is `*.it.test.ts`. Add to the existing `reviews.it.test.ts` rather than a new file, because every new file worsens the parallel-skip flake | `server/INSIGHTS.md:91-97`, `:72-88` |
| integration runs: read the **skipped** count. Run with `--no-file-parallelism` | `server/INSIGHTS.md:265-287` |
| `pnpm typecheck` does not cover `server/test/**`. Typecheck the new test files explicitly | `server/INSIGHTS.md:128-139` |
| validation is schema-first on the route. Never `parse` in the handler. Throw `NotFoundError` and never build the error envelope by hand | `server/AGENTS.md` (conventions) |
| do not commit or touch `server/src` while a review run is in flight, because the reaper kills it | `server/INSIGHTS.md:14-31` |
| no `@testing-library/user-event`. Use `fireEvent` | `client/INSIGHTS.md:175-186` |
| a component that translates through a namespace needs that namespace in **every** test provider that renders it, and the tests must assert the rendered string | `client/INSIGHTS.md:117-131` |
| never `findByRole` an accessible name that is not unique once settled ("Accept" will repeat when there are two findings) | `client/INSIGHTS.md:44-62` |
| mixing `borderColor` with `borderLeft*` in one style object triggers a React warning. Draw the severity bar with `boxShadow: inset 3px 0 0 <colour>` instead | `client/INSIGHTS.md:190-202` |
| `src/components` ↛ `src/app`, and imports only through `index.ts` | `client/eslint.config.mjs:76-81`, `:93-96` |
| no `fetch` in a component. The new endpoint gets a hook | `client/AGENTS.md`, `eslint.config.mjs:125-140` |
| never regenerate a lockfile. This plan adds **no** dependency | `AGENTS.md` (hard rules) |
| an unused schema column or contract field (`pseudocode_summary`) is intentional | `AGENTS.md` (hard rules) |

## Steps

Each step is one reviewable unit. Run `pnpm` commands from the package
directory.

### Shared + server

1. **shared** · `server/src/vendor/shared/contracts/brief.ts:81` **and**
   `client/src/vendor/shared/contracts/brief.ts:81` · skill: `zod`
   - Replace the enum with the 5-value one from § Contract, in the same order.
     Update the `// ---- Smart Diff ----` comment to say the enum order is the
     display order.
   - In `server/test/contracts.test.ts:108-119`, add a parse of a `tests`
     group and a `docs` group, plus an assertion that
     `SmartDiffRole.options` equals
     `['core','tests','wiring','docs','boilerplate']`.
   - Check: `diff -r server/src/vendor/shared client/src/vendor/shared` prints
     nothing. `pnpm typecheck` passes in **both** `server/` and `client/`.

2. **server** · `server/.dependency-cruiser.cjs:51` · skill: `onion-architecture`
   - Widen `DOMAIN` so that nested module helpers are Ring 1:
     `'^(\\.\\./)?reviewer-core/src/|^src/modules/[^/]+/(?:[^/]+/)*helpers\\.ts$'`.
   - Update the header comment (`:9`) to read
     `helpers.ts (any depth inside a module)`.
   - Check: `pnpm arch` still reports 0 new violations, and `pnpm arch:all`
     still lists exactly **21**. Do **not** run `pnpm arch:baseline`.
   - This is its own commit, which says why: without it, the step-4 classifier
     is unguarded by `core-no-io`.

3. **server** · `server/test/smart-diff-classify.test.ts` (new) · skill:
   `onion-architecture` — **write this before step 4.**
   - `it.each` over every row of § Classifier's table test:
     `expect(classifyFile(path)).toBe(role)`. The three ★ cases each get their
     own named `it`, with a comment that states the precedence they pin
     (*boilerplate before tests*, *wiring before docs*, *tests before docs*).
   - Add one test that `ROLE_ORDER` is
     `['core','tests','wiring','docs','boilerplate']` and has the same members
     as `SmartDiffRole.options`.
   - Import from `../src/modules/reviews/smart-diff/helpers.js` and
     `…/constants.js`.
   - Check: `pnpm exec vitest run test/smart-diff-classify.test.ts` **fails**
     (the module does not exist yet). Record the red run, then go to step 4.

4. **server** · `server/src/modules/reviews/smart-diff/constants.ts` and
   `server/src/modules/reviews/smart-diff/helpers.ts` (new) · skills:
   `onion-architecture`, `typescript-expert`
   - `constants.ts`:
     - `ROLE_ORDER: readonly SmartDiffRole[]` (display order).
     - `CLASSIFY_PRECEDENCE` = `['boilerplate','tests','wiring','docs'] as const`, where core is the fallback.
     - The literal pattern data per role: the extension, basename, prefix and
       segment lists from § Classifier, each with a one-line comment.
     - `import type { SmartDiffRole } from '@devdigest/shared'` only.
   - `helpers.ts`. This is Ring 1, with no `async`, I/O, `fastify`, `drizzle`
     or `process.env`:
     - `normalizePath(path)` applies D-12: `\` → `/`, then strips a leading `./`.
     - `classifyFile(path: string): SmartDiffRole`. It walks
       `CLASSIFY_PRECEDENCE` and returns the first match, else `'core'`. Use
       string operations only (D-11).
     - `buildSmartDiff(files: readonly { path: string; additions: number; deletions: number }[], anchors: readonly { file: string; start_line: number }[]): SmartDiff`:
       - group files by `classifyFile`, keeping input order within a group;
       - emit groups in `ROLE_ORDER`, skipping empty ones (D-7);
       - `finding_lines` = the unique, ascending `start_line`s whose
         `anchor.file === file.path`;
       - ignore anchors on paths not in `files`;
       - `split_suggestion = { too_big: false, total_lines: Σ(additions+deletions), proposed_splits: [] }`;
       - never set `pseudocode_summary`.
     - The parameter types are structural. **Do not** import `PrFile`/`FindingRow`
       row types (the onion skill's "what may cross a boundary" section).
   - Check: step 3's test is green.

5. **server** · `server/src/modules/reviews/repository/review.repo.ts` and
   `server/src/modules/reviews/repository.ts` · skills: `drizzle-orm-patterns`,
   `onion-architecture`
   - Add `latestReviewFindingAnchors(db, workspaceId, prId): Promise<{ file: string; start_line: number }[]>`:
     - **Query 1** selects `t.reviews.id` where `workspaceId` and `prId` match
       and `kind = 'review'`, ordered by `desc(createdAt)`, `.limit(1)`. This
       uses `reviews_ws_pr_created_idx` (`db/schema/reviews.ts:40`).
     - If there is no review, return `[]`.
     - **Query 2** selects `{ file: t.findings.file, start_line: t.findings.startLine }`
       where `reviewId = latest.id` (uses `findings_review_idx`).
     - No filter on `dismissedAt` / `acceptedAt` (D-3).
   - Expose it as `ReviewRepository.latestReviewFindingAnchors(workspaceId, prId)`
     next to `reviewsForPull` (`repository.ts:62-65`), with a doc comment that
     names D-3's rule and points at `pulls/routes.ts:130-143` as the twin rule.
   - No migration and no schema change.

6. **server** · `server/src/modules/reviews/service.ts` and
   `server/test/smart-diff-build.test.ts` (new) · skill: `onion-architecture`
   - `ReviewService.smartDiffForPull(workspaceId, prId): Promise<SmartDiff>`, placed in the `// Reads` section (`:156-174`):
     1. Call `this.repo.getPull(workspaceId, prId)`. Throw
        `NotFoundError('Pull request not found')` when it is missing.
     2. Fetch `this.repo.getPrFiles(prId)` and
        `this.repo.latestReviewFindingAnchors(workspaceId, prId)` in
        parallel (`Promise.all`).
     3. Return
        `buildSmartDiff(files.map(f => ({ path: f.path, additions: f.additions, deletions: f.deletions })), anchors)`.
        The mapping to plain values happens here, in Ring 2, not in Ring 1.
   - `smart-diff-build.test.ts` is a hermetic `buildSmartDiff` table:
     - (a) five roles in shuffled input come back in `ROLE_ORDER`;
     - (b) when there are no docs files, the `docs` group is absent;
     - (c) duplicate and unsorted anchors give a deduplicated, ascending
       `finding_lines`;
     - (d) an anchor on a path not in `files` is ignored;
     - (e) `total_lines` = Σ(additions+deletions), `too_big` is `false` and
       `proposed_splits` is `[]`;
     - (f) a lock-file lands in the `boilerplate` group;
     - (g) the output passes `SmartDiff.parse`.

7. **server** · `server/src/modules/reviews/routes.ts` · skills:
   `fastify-best-practices`, `onion-architecture`, `security`
   - Add the route under `// ---- Reads` (`:135`):
     `app.get('/pulls/:id/smart-diff', { schema: { params: IdParams, response: { 200: SmartDiffResponse } } }, async (req) => { const { workspaceId } = await getContext(container, req); return service.smartDiffForPull(workspaceId, req.params.id); })`.
   - Add the route to the header doc comment (`:10-17`).
   - Import `SmartDiffResponse` from `@devdigest/shared`. This runtime import is
     fine on the server.
   - `server/test/routes-smoke.test.ts`: `GET /pulls/not-a-uuid/smart-diff` →
     **422**. This is hermetic, because validation runs before any DB access.
   - `server/test/reviews.it.test.ts`: add one `it(...)` that inserts the data
     directly through `pg.handle.db` (no LLM run), reusing `setupRepoAndPr`
     (`:64-97`):
     - extra `pr_files`: `pnpm-lock.yaml`, `src/config.test.ts`, `README.md`,
       `vitest.config.ts`;
     - an **older** `kind:'review'` review with a finding on `src/config.ts:5`;
     - a **newer** `kind:'review'` review with **dismissed** findings on
       `src/config.ts:11` and `:11`;
     - a **newest** `kind:'summary'` review with a finding on `src/config.ts:99`.
     - Assert:
       - the groups are exactly `core, tests, wiring, docs, boilerplate`;
       - `pnpm-lock.yaml` is in `boilerplate`;
       - the core file's `finding_lines` equals `[11]` (latest `review`-kind
         only, dismissed counted, deduplicated, summary ignored);
       - `total_lines` is correct;
       - a random uuid gives **404**.

### Client

8. **client** · `client/src/lib/hooks/reviews.ts` · skill:
   `frontend-ui-architecture`
   - Add `useSmartDiff(prId)`:
     `useQuery({ queryKey: ["reviews", prId, "smart-diff"], queryFn: () => api.get<SmartDiffResponse>(`/pulls/${prId}/smart-diff`), enabled: !!prId })`.
   - Import the type with `import type { SmartDiffResponse } from "@devdigest/shared"`.
   - Add a comment explaining that the key is nested under `["reviews", prId]`
     on purpose (D-5).
   - It is re-exported automatically through `src/lib/hooks/index.ts`.
     Nothing to add there.

9. **client** · `client/src/components/diff-viewer/findings.ts` (new),
   `constants.ts`, `index.ts`, plus colocated
   `client/src/components/diff-viewer/findings.test.ts` (new) · skills:
   `frontend-ui-architecture`, `react-testing-library`
   - `findings.ts`, which mirrors `comments.ts` and contains no React except types:
     - `export interface DiffFindingApi { findings: FindingRecord[]; renderFinding: (f: FindingRecord) => React.ReactNode }`
       (types from `@/lib/types` / `@devdigest/shared`, type-only).
     - `findingKey(f) = lineKey("RIGHT", f.start_line)`, which reuses
       `comments.ts:34`.
     - `partitionFindings(findings, renderedKeys): { matched: Map<string, FindingRecord[]>; unanchored: FindingRecord[] }`.
       It is the twin of `partitionThreads` (`comments.ts:89`).
     - `topSeverity(findings): Severity | null`, using `SEVERITY_RANK`.
   - `constants.ts`:
     - `SEVERITY_RANK` (CRITICAL > WARNING > SUGGESTION).
     - `FINDING_LINE_LABEL_KEY: Record<Severity, string>`, which maps each
       severity to its `shell` i18n key (`diffViewer.findingLabel.CRITICAL` → "blocker", and so on).
   - `index.ts`: also `export type { DiffFindingApi } from "./findings"`.
   - Test the pure functions:
     - anchored vs unanchored;
     - several findings on one line;
     - `topSeverity` ordering;
     - a finding on a deleted-only line is unanchored.

10. **client** · `client/src/components/diff-viewer/DiffViewer/DiffViewer.tsx`,
    `FileCard/FileCard.tsx`, `CodeLine/CodeLine.tsx`, `styles.ts`, plus new
    `client/src/components/diff-viewer/FileCard/FileCard.test.tsx` · skills:
    `react-best-practices`, `frontend-ui-architecture`, `react-testing-library`
    - `DiffViewer`: add an optional `findings?: DiffFindingApi` prop and
      forward it to every `FileCard`. When it is absent, the behaviour is
      unchanged, and `src/test/smoke.test.tsx:27-45` must still pass untouched.
    - `FileCard`:
      - derive `fileFindings = findings?.findings.filter(f => f.file === file.path) ?? []`.
      - in the same `useMemo` that builds `renderedKeys` (`:75-81`), also run
        `partitionFindings`.
      - **Header:** if `fileFindings.length > 0`, render a dot directly after
        the path text and before the `+/−` stat. Wrap the path and the dot so
        that `filePath`'s `flex: 1` (`styles.ts:22-30`) does not push the dot
        right.
        - The dot's colour is `SEV[topSeverity].c` (D-13).
        - It has `role="img"` and an `aria-label` / `title` from
          `t("diffViewer.hasFindings")`.
        - It carries no number, and it is separate from the `MessageSquare`
          comment counter (`:99-106`), which stays as it is.
      - Do **not** change the auto-expand rule (`:67-69`).
      - Pass `findings={matched.get(key) ?? []}` (over `keysForLine(ln)`) and
        `renderFinding` to each `CodeLine`.
      - After the lines, if `unanchored.length > 0`, render a captioned block
        (`t("diffViewer.unanchoredFindings")`, styled like
        `cs.outdatedWrap`/`cs.outdatedTitle`) that calls `renderFinding` for
        each finding (D-9).
    - `CodeLine`: add the props `findings?: FindingRecord[]` and
      `renderFinding?`. When the line has findings:
      - The row gets a left bar: `boxShadow: inset 3px 0 0 ${SEV[top].c}`, with
        no border properties (`client/INSIGHTS.md:190`).
      - It gets a right-aligned label with the `SEV[top].icon` icon and
        `t(FINDING_LINE_LABEL_KEY[top])` in `SEV[top].c`.
      - Under the row, in a `cs.thread` rail, it renders `renderFinding(f)`
        for each finding.
      - The findings are **always** shown. They do not depend on
        `commenting.showComments`, which governs GitHub comments only.
      - The new style objects go into the `diff-viewer/styles.ts` /
        `comments.ts` `cs` objects, as CSSProperties to match the folder
        (D-14).
    - `FileCard.test.tsx`: render inside
      `NextIntlClientProvider messages={{ shell }}`, with a ≤200-line patch and
      a `renderFinding` stub (`f => <div>{f.title}</div>`). Assert that:
      - the header dot is found by its accessible name;
      - the stub title renders **after** the cited code line;
      - the label text "blocker" is shown for a CRITICAL finding;
      - with no findings, there is no dot and no label;
      - an unanchored finding appears under the caption.

11. **client** · `client/messages/en/prReview.json` and
    `client/messages/en/shell.json` · no skill (routing: G12 only)
    - `prReview.smartDiff`. Keep the existing keys. Add:
      - `"testsLabel": "Tests"`
      - `"docsLabel": "Docs"`
      - `"coreDescription": "The substance of the change — review closely"`
      - `"testsDescription": "Proves the core works — check what it asserts"`
      - `"wiringDescription": "Hooks the core into the app"`
      - `"docsDescription": "Explains the change — read for intent"`
      - `"boilerplateDescription": "Generated / mechanical — skim"`
      - `"caption": "Reviewer-ordered diff"`
      - `"originalCaption": "Files changed"`
      - `"summary": "{files, plural, one {# file} other {# files}} · +{additions} −{deletions}"`
      - `"orderLabel": "Diff order"`
      - `"smartOrder": "Smart order"`
      - `"originalOrder": "Original order"`
      - `"filesWithFindings": "{count, plural, one {# file has findings} other {# files have findings}}"`
      - `"showComments": "Show comments ({count})"`
      - `"hideComments": "Hide comments ({count})"`
    - Change `filesCount` to
      `"{count, plural, one {# file} other {# files}}"`. Grep shows no
      current reader of `smartDiff.filesCount`. Leave
      `list.filesCount` (`prReview.json:102`) alone.
    - `shell.diffViewer`. Add:
      - `"hasFindings": "Has review findings"`
      - `"unanchoredFindings": "Findings outside the shown lines"`
      - `"findingLabel": { "CRITICAL": "blocker", "WARNING": "warning", "SUGGESTION": "suggestion" }`
    - The caption renders upper-case through `SectionLabel`
      (`vendor/ui/primitives/SectionLabel.tsx:22` sets
      `textTransform: uppercase`), so the string itself stays sentence case.

12. **client** · `.../DiffTab/_components/DiffOrderToggle/` (new:
    `DiffOrderToggle.tsx`, `styles.ts`, `index.ts`, `DiffOrderToggle.test.tsx`)
    · skills: `frontend-ui-architecture`, `react-best-practices`,
    `react-testing-library`
    - Props: `{ value: DiffOrder; onChange(v: DiffOrder): void; disabled?: boolean }`.
    - Render a `role="group"` with `aria-label={t("smartDiff.orderLabel")}`
      around two `@devdigest/ui` `Button`s carrying `aria-pressed`. This is
      the segmented-pair pattern at
      `conventions/.../ConventionCard/ConventionCard.tsx:137-160`. There is
      no segmented primitive in `@devdigest/ui`, so do not add one to
      `src/vendor/ui`.
    - Labels: `smartDiff.smartOrder` / `smartDiff.originalOrder`.
    - Styles: Tailwind class strings (D-14).
    - Test: clicking "Original order" calls `onChange("original")`, and
      `aria-pressed` follows `value`.

13. **client** · `.../DiffTab/_components/SmartDiffGroup/` (new:
    `SmartDiffGroup.tsx`, `constants.ts`, `helpers.ts`, `styles.ts`,
    `index.ts`, `SmartDiffGroup.test.tsx`) · skills:
    `frontend-ui-architecture`, `react-best-practices`,
    `react-testing-library`
    - `constants.ts`:
      - `ROLE_META = { core: {...}, tests: {...}, wiring: {...}, docs: {...}, boilerplate: {...} } satisfies Record<SmartDiffRole, { labelKey; descriptionKey; color; defaultOpen }>`.
        `SmartDiffRole` is a **type** import. The `satisfies` is the
        exhaustiveness check that `server/INSIGHTS.md:64-66` requires.
      - `defaultOpen` is `false` for `docs` and `boilerplate`, `true` for the
        rest (S2).
      - Colours: core `var(--accent)`, tests `var(--ok)`, wiring
        `var(--info)`, docs `var(--text-secondary)`, boilerplate
        `var(--text-muted)`.
    - `helpers.ts`: `filesWithFindings(group: SmartDiffGroup): number` =
      `group.files.filter(f => f.finding_lines.length > 0).length` (S3).
    - Component props: `{ group: SmartDiffGroup; files: PrFile[]; commenting; findings?: DiffFindingApi }`.
      - The `open` state is `useState(ROLE_META[role].defaultOpen)`.
      - The header is one `<button aria-expanded>` that holds, left to right:
        a chevron, a coloured square, the bold label, the muted description,
        a spacer, then:
        - when `filesWithFindings > 0`: a red dot plus that number, with
          `aria-label = t("smartDiff.filesWithFindings", { count })`;
        - `t("smartDiff.filesCount", { count: files.length })`.
      - When the group is open, it renders
        `<DiffViewer files={files} commenting={commenting} findings={findings} />`.
        Per-file expansion keeps following `AUTO_EXPAND_MAX_LINES`.
    - Test:
      - a `boilerplate` group starts collapsed (its file path is not in the
        document) and expands on a header click;
      - a `core` group starts open;
      - the counter shows `1` for a group with two files, one of which has
        `finding_lines`;
      - the counter is absent when no file has findings.
      - The provider needs both `prReview` and `shell` (`client/INSIGHTS.md:117`).

14. **client** · `.../DiffTab/DiffTab.tsx` (rewrite), plus new
    `DiffTab/helpers.ts`, `DiffTab/constants.ts`, `DiffTab/styles.ts`,
    `DiffTab/DiffTab.test.tsx`, `DiffTab/helpers.test.ts` · skills:
    `frontend-ui-architecture`, `react-best-practices`,
    `next-best-practices`, `react-testing-library`, `security`
    - `constants.ts`: `DIFF_ORDERS = ["smart", "original"] as const`,
      `type DiffOrder`, and `DEFAULT_DIFF_ORDER = "smart"`.
    - `helpers.ts` (pure):
      - `latestReviewFindings(reviews: ReviewRecord[] | undefined): FindingRecord[]`
        returns the first element with `kind === "review"`, then its
        `findings`, or `[]` (D-4). The doc comment names the twin server
        rule.
      - `diffTotals(files: PrFile[]): { files; additions; deletions }`.
      - `resolveGroups(smartDiff: SmartDiff | undefined, files: PrFile[]): { group: SmartDiffGroup; files: PrFile[] }[] | null`:
        - map each group's paths to `PrFile`s, sorted by index in `files`
          (D-8);
        - return `null` when `smartDiff` is undefined or when any `files`
          path is missing from every group (D-9);
        - silently drop smart-diff paths that are unknown to `files`.
    - `DiffTab.tsx`. Add new props `repoFullName?: string | null` and
      `headSha?: string | null`, and keep the existing ones. Hooks:
      - `usePrComments`, `useCreatePrComment` (unchanged);
      - `usePrReviews(prId)`, which shares the page's cache;
      - `useSmartDiff(prId)`;
      - `useFindingAction()`.
      Derived values (no state):
      - `findings = latestReviewFindings(reviews)`;
      - `groups = resolveGroups(smartDiff, files)`;
      - `order = useState<DiffOrder>(DEFAULT_DIFF_ORDER)`;
      - `effectiveOrder = groups ? order : "original"`.
      `findingApi: DiffFindingApi`:
      - `findings`;
      - `renderFinding: f => <FindingCard f={f} defaultExpanded pending={action.isPending} repoFullName={repoFullName} headSha={headSha} onAction={(act) => action.mutate({ findingId: f.id, action: act, prId: prId ?? undefined })} />`.
        This is the same wiring as `FindingsPanel.tsx:100-108`. Import
        `FindingCard` from `"../FindingCard"`, a sibling inside the same
        route. Do not change `FindingCard`.
      Header (`SectionLabel`):
      - the caption is `smartDiff.caption` in smart order and
        `smartDiff.originalCaption` otherwise, followed by
        `smartDiff.summary` from `diffTotals(files)`;
      - the `right` slot holds `DiffOrderToggle`
        (`disabled={!groups}`) plus the existing comments button, now on
        `smartDiff.showComments` / `smartDiff.hideComments`.
      Body:
      - smart order: one `SmartDiffGroup` per `groups` entry;
      - original order: `<DiffViewer files={files} commenting={commenting} findings={findingApi} />`.
    - `helpers.test.ts`:
      - `latestReviewFindings` skips a newer `summary` review and returns
        `[]` for `undefined`;
      - `resolveGroups` returns `null` when one file is missing, sorts by
        GitHub order, and returns `null` for `undefined`;
      - `diffTotals` sums correctly.
    - `DiffTab.test.tsx`. Mock `useSmartDiff`, `usePrReviews`,
      `usePrComments`, `useCreatePrComment` and `useFindingAction`, the way
      `FindingsPanel.test.tsx:7-9` does. Provide `prReview` and `shell`.
      Fixture: `src/config.ts` (core, one CRITICAL finding at line 11),
      `src/config.test.ts`, `vitest.config.ts`, `README.md` and
      `pnpm-lock.yaml`, in a deliberately different GitHub order. Assert:
      - (a) the group labels appear in the order Core, Tests, Wiring, Docs,
        Boilerplate;
      - (b) `pnpm-lock.yaml` and `README.md` are not rendered until their
        group headers are clicked;
      - (c) the Core header shows the files-with-findings count `1` by its
        accessible name;
      - (d) the finding's title and a "blocker" label render, and clicking
        `getAllByRole("button", { name: "Accept" })[0]` calls `mutate` with
        `{ findingId, action: "accept", prId }`;
      - (e) clicking "Original order" renders the files in the fixture's
        GitHub order, and the group headers are gone;
      - (f) the "Reviewer-ordered diff" caption and "5 files · +N −M" render;
      - (g) when `useSmartDiff` is still loading, the files render flat and
        the toggle is disabled.
    - Security: `FindingCard` renders AI-written `rationale`/`suggestion`
      through the existing `Markdown` primitive. Do not add
      `dangerouslySetInnerHTML` or any new HTML path.

15. **client** · `client/src/app/repos/[repoId]/pulls/[number]/page.tsx` ·
    skills: `frontend-ui-architecture`, `next-best-practices`
    - At `:166-171`, pass `repoFullName={repoFullName}` and
      `headSha={pr.head_sha}` to `DiffTab`.
    - In `onRunDone` (`:157-161`), add
      `qc.invalidateQueries({ queryKey: ["reviews", prId, "smart-diff"] })`
      after `refetchReviews()`. Guard it with `prId`, the way
      `invalidateActiveRuns` does at `:51-53`.
    - Nothing else. The page stays thin.

## Verification

| Package | Commands (run from the package directory) | Suite |
|---|---|---|
| server | `pnpm typecheck` · `pnpm arch` (0 new) · `pnpm arch:all` (still 21) · `pnpm exec vitest run --exclude '**/*.it.test.ts'` | server-unit |
| server | `pnpm exec vitest run test/reviews.it.test.ts --no-file-parallelism`. Needs Docker. **Read the skipped count**: a 0-skipped pass is the only green | server-integration |
| server | the test files' own types: a scratch tsconfig that `extends` `tsconfig.json` and includes `test/smart-diff-*.test.ts`, `test/contracts.test.ts`, `test/routes-smoke.test.ts` and `test/reviews.it.test.ts`, then run `pnpm exec tsc --noEmit -p <scratch>` (`server/INSIGHTS.md:128`). Delete the scratch file afterwards | — |
| client | `pnpm typecheck` · `pnpm lint` (slow here: it did not finish within 170 s while this plan was written, so give it a long timeout) · `pnpm test`. Check **stderr for `MISSING_MESSAGE`**, not just the exit code | client |
| client | `pnpm build`, with **`pnpm dev` stopped**. This is the only check that catches a runtime `@devdigest/shared` import | client |
| shared | `diff -r server/src/vendor/shared client/src/vendor/shared` prints nothing | — |
| e2e (optional, needs the stack) | `05-pr-diff.flow.json` still passes. `src/config.ts` is core, so its group is open | e2e web |

**Known baseline:** on this Windows machine, 6 of 11 tests in
`server/test/indexer-pipeline.test.ts` fail on a clean tree. They are
pre-existing, not a regression, and must not be "fixed" here. `pnpm arch` is
green with 21 known violations ignored. No migration is involved, so the
Windows `db:migrate` no-op quirk does not apply.

## Done when

- [ ] **D1 (S1).** Open seeded PR #485 or #486, then *Files changed*. The groups
      appear in the order Core → Tests → Wiring → Docs → Boilerplate, and only
      non-empty roles render. Each header shows the label, the description and
      "N files". `package.json` is under Wiring and `test/*.test.ts` is under
      Tests.
- [ ] **D2 (S2).** Docs and Boilerplate are collapsed on load, and Core, Tests
      and Wiring are open. A PR whose files include a lock-file shows it under
      Boilerplate. The `pnpm-lock.yaml` row in the integration test proves the
      same on the server.
- [ ] **D3 (S3).** Run a review from the header and wait for it to finish on
      *Agent runs*, then switch to *Files changed* **without reloading**. Each
      group that holds a file with findings shows a red dot and the number of
      such **files**, to the left of "N files". Each such file card shows a
      dot next to its path, and the GitHub comment counter is unchanged and
      separate. The group count equals the number of dotted file cards in that
      group.
- [ ] **D4 (S4).** Expand a dotted file. Under the cited line there is a card
      with the severity badge, title, rationale, suggested fix, Accept and
      Reject. The line has a coloured left bar and a right-aligned
      "blocker" / "warning" / "suggestion" label. Clicking Accept marks the
      card accepted, and the *Agent runs* tab agrees after switching back.
- [ ] **D5 (S5).** The header reads "REVIEWER-ORDERED DIFF" with
      "N files · +A −D", and the "Smart order | Original order" toggle sits on
      the right. "Original order" shows the flat GitHub order, with dots and
      inline findings still present. "Smart order" brings the groups back.
- [ ] *Agent runs* is visually and behaviourally unchanged.
- [ ] tests (server-unit): `server/test/smart-diff-classify.test.ts` (with
      the three ★ cases), `server/test/smart-diff-build.test.ts`,
      `server/test/contracts.test.ts` (5-role enum),
      `server/test/routes-smoke.test.ts` (422).
- [ ] tests (server-integration): the new case in
      `server/test/reviews.it.test.ts` passes with **0 skipped** files.
- [ ] tests (client): `src/components/diff-viewer/findings.test.ts`,
      `FileCard/FileCard.test.tsx`, `DiffTab/helpers.test.ts`,
      `DiffTab/DiffTab.test.tsx`, `SmartDiffGroup.test.tsx`,
      `DiffOrderToggle.test.tsx`, and the untouched `src/test/smoke.test.tsx`.
      There is no `MISSING_MESSAGE` on stderr.
- [ ] `pnpm build` (client) succeeds, and `pnpm arch` (server) shows 0 new
      violations.

## Left to reviewers

- **architecture** (`architecture-reviewer`):
  - D-2 places a Ring-1 subfolder `reviews/smart-diff/` inside a module, and
    step 2 widens `DOMAIN` in `server/.dependency-cruiser.cjs:51` so that
    `core-no-io` actually guards it. Check that the widening adds nothing to
    the baseline.
  - D-6 adds a render slot to `src/components/diff-viewer` so that it never
    imports the route-private `FindingCard`. Check that `pnpm lint` is clean.
  - D-3/D-4 apply the "latest review" rule twice, once in
    `review.repo.ts` and once in `DiffTab/helpers.ts`. Judge whether that
    duplication is acceptable or whether the contract should carry a
    `review_id`.
- **security**:
  - `GET /pulls/:id/smart-diff` takes a uuid param, scopes by workspace
    through `getPull`, and returns **404, not 403**, for another workspace.
  - `classifyFile` reads attacker-influenced PR file paths. Confirm that it
    builds no `RegExp` from input and runs in linear time.
  - AI-written `rationale`/`suggestion` now render on a second screen, through
    the same `Markdown` primitive.
- **performance** (rubric: `docs/agent-prompts/performance-reviewer.md`):
  - The route runs three small queries (two run in parallel) and uses
    `reviews_ws_pr_created_idx` and `findings_review_idx`.
  - On the client, each `FileCard` filters the findings array per render.
    This is O(files × findings) on small arrays and needs no memo unless
    measured.

## Risks / open questions

| Question | Blocks which step | Needs |
|---|---|---|
| **After "Run all", D-3 shows only the last agent's findings** (the newest `kind='review'` row), while *Agent runs* shows every agent. The alternative is "the newest review **per agent**" (a union), which changes `latestReviewFindingAnchors`, `latestReviewFindings` and the integration test. Neither is wrong. The brief says "the latest review", and the PR list uses the same rule. Decide before the demo if Run all is what gets recorded. | 5, 7, 14 | user |
| `GET /pulls/:id` deletes and re-inserts `pr_files` outside a transaction (`pulls/routes.ts:238-248`). A smart-diff request that lands in between can see an empty or partial file list. D-9 then falls back to Original order, so nothing is lost, but the grouping can flicker. A real fix (a transaction in `pulls`) is out of scope, since it touches another module's flat route (`server/INSIGHTS.md:142`). | 14 | — (accepted; note in PR) |
| These are the **first Tailwind class strings in `src/app`** (D-14). Tailwind v4 is wired (`postcss.config.mjs`, `vendor/ui/styles.css:1`), but no app component uses it yet, so source detection has never been checked in practice. If the classes do not apply in `pnpm dev`, fall back to `CSSProperties` for these two components and record why. | 12, 13 | implementer (visual check) |
| D-10 (`package.json` → wiring) and the widened test/spec extensions (`.js/.jsx`) go beyond the brief's literal list. Both are pinned by the table test and each is one line to revert. | 3, 4 | user (confirm, or revert to the literal list) |
| The `frontend-ui-architecture` skill says the client has no ESLint. It does (`client/eslint.config.mjs`). The skill text is stale. | — | follow-up after this lesson, not here |

## Amendments after review

- **D-4 / step 14:** `latestReviewFindings` was replaced by `inlineFindings(reviews, smartDiff)`, and `SmartDiff` gained `review_id: string | null` in both vendored `brief.ts` copies. Steps below that still mention `latestReviewFindings` describe the first implementation.
- **D-5 / steps 8, 15:** the key `["reviews", prId, "smart-diff"]` is owned by `smartDiffKey(prId)` in `client/src/lib/hooks/reviews.ts`; `page.tsx` calls it instead of spelling the key out.
- **Step 2:** the `DOMAIN` regex is `^src/modules/.+/helpers\.ts$`; the nested-quantifier form is rejected by dependency-cruiser's safe-regex check.
