# L02 — Conventions extractor

**Goal:** a user scans a cloned repo, reads the house-rules the model found —
each one pinned to real code in that repo — keeps the ones that are true,
rewrites the ones that are nearly true, and turns the survivors into one
reusable **Skill** they can attach to any agent.

**Not in scope:**

- **Linking the new skill to an agent.** The skill lands in the library; the
  agent editor's Skills tab (L02, shipped) is where it gets attached. This
  feature does not write `agent_skills`.
- **Many skills from one scan.** One scan produces at most one
  `<repo>-conventions` skill. Splitting by category is a later call.
- **Enforcing a convention during a review.** A convention only reaches a
  prompt the way every other skill does — as a linked, enabled skill body.
- **Background jobs.** The extract call runs the model inline and answers with
  the finished scan. No `jobs` row, no SSE, no polling.
- **Incremental re-scan.** A re-scan replaces the previous scan wholesale
  (§D4).

---

## 1. Decisions

| # | Decision | Consequence |
|---|---|---|
| D1 | **Sample selection is code, never the model.** Config files by a fixed probe list + `repoIntel.getConventionSamples(repoId, 12)` | one model call per scan, and the set of files the model may cite is known before the call — which is what makes D2 possible |
| D2 | **Every candidate is verified against the clone before it is stored.** The file must be one we sampled, the lines must exist, and a line of the quoted snippet must actually be in the file. The stored snippet is then re-read **from the file**, never taken from the model | a hallucinated rule cannot reach the screen, and the snippet on the card is real code by construction. Same shape as the review path's grounding gate |
| D3 | **A candidate has two states, `accepted` and `rejected`, and lands `accepted`** | matches the mockup's *"3 of 3 accepted"* and *Deselect all*: the reader's job is to throw out what is wrong, not to click three times to keep what is right. A third `pending` state would have to render as neither, and the mockup has no such affordance |
| D4 | **A re-scan deletes the previous scan for that repo** (cascading its candidates) | accept/reject decisions do not survive a re-scan. They are one click each and the model's output moves anyway; carrying decisions across batches means matching candidates by rule text, which is a guess. A skill already created is a separate row and is untouched |
| D5 | **The skill is written by code, reviewed by a human, and only then saved.** `GET …/skill-draft` composes markdown from the accepted candidates; the modal is a full editor over that draft; `POST …/skill` stores exactly what the modal submits | the model never writes the skill body. What the user reads in the modal is what is stored |
| D6 | Provenance is `extracted` and `evidence_files` carries the cited paths | the Skills grid already renders `source: extracted` (`skills.listItem.source.extracted`), so the card tells the truth with no client change |
| D7 | The scan's own metadata gets a table, `convention_scans` | the header line *"Detected from 84 sample files · last scan 1h ago"* is a fact about the scan, not about any one candidate. Putting `sample_count` on every candidate row would repeat it N times and have no home when a scan finds nothing |

### D8 — the trust model

The extracted text is **repo-derived data** until a human reads it, and
**instructions** afterwards — the same line L02 D6 draws for an imported skill,
reached by a different door:

| Gate | Where |
|---|---|
| the model may only cite files we sampled | `verifyCandidates` (§4.3) |
| the quoted snippet is replaced by the real file text | `verifyCandidates` |
| the whole skill body is shown, editable, before the first write | the create-skill modal |
| `enabled` is a deliberate choice in that modal | `POST /repos/:id/conventions/skill` |
| nothing enters a prompt until the skill is enabled **and** checked on an agent | `SkillsRepository.promptBodiesForAgent` (unchanged) |

The scan prompt wraps every file excerpt in `<untrusted source="repo">`. A repo
can contain a file that tells the model what "convention" to report; the
delimiters plus D2's path allow-list are what stop it from becoming a rule.

## 2. What already exists

Do not rebuild these.

| Already there | Where |
|---|---|
| `conventions` table | `server/src/db/schema/knowledge.ts`; DDL at `migrations/0000_init.sql:96` |
| `ConventionCandidate` contract | `vendor/shared/contracts/knowledge.ts` (both copies) |
| the sample-file picker | `repoIntel.getConventionSamples(repoId, n)` (`modules/repo-intel/service.ts:630`) |
| reading a file out of the clone | `container.git.readFile(repoRef, path)` (`GitClient` port) |
| per-feature model choice, id `conventions` | `FEATURE_MODELS` (`contracts/platform.ts:74`), `resolveFeatureModel` (`modules/settings/feature-models.ts:51`) — **no caller yet; this is the first** |
| structured model calls | `LLMProvider.completeStructured({ schema, schemaName })` |
| a two-fixture mock for exactly this flow | `MockLLMOptions.structuredBySchema` (`adapters/mocks.ts:48`) |
| skill writes, versioning, provenance | `container.skillsRepo.insert({ source, evidenceFiles })` |
| sidebar active-key routing for `/conventions` | `client/src/components/app-shell/helpers.ts:33` |
| the screen's first strings | `client/messages/en/conventions.json` |

## 3. Contract

Added to `@devdigest/shared` — **both** vendored copies,
`server/src/vendor/shared/contracts/knowledge.ts` and
`client/src/vendor/shared/contracts/knowledge.ts`.

```ts
export const ConventionCategory = z.enum([
  'naming', 'structure', 'error-handling', 'async',
  'typing', 'testing', 'imports', 'api', 'docs', 'other',
]);

export const ConventionStatus = z.enum(['accepted', 'rejected']);

/** REPLACES the starter's `{ id, rule, evidence_*, confidence, accepted }`. */
export const ConventionCandidate = z.object({
  id: z.string(),
  repo_id: z.string(),
  category: ConventionCategory,
  rule: z.string(),
  evidence_path: z.string(),
  evidence_start_line: z.number().int(),
  evidence_end_line: z.number().int(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  status: ConventionStatus,
  created_at: z.string(),
});

export const ConventionScan = z.object({
  id: z.string(),
  repo_id: z.string(),
  sample_count: z.number().int(),
  model: z.string(),
  created_at: z.string(),
});

/** What the screen loads in one request. `scan: null` = never scanned. */
export const ConventionsView = z.object({
  scan: ConventionScan.nullable(),
  candidates: z.array(ConventionCandidate),
});

/** Composed by code from the accepted candidates; the modal edits it. */
export const ConventionSkillDraft = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  convention_ids: z.array(z.string()),
  evidence_files: z.array(z.string()),
});
```

`ConventionExtraction` — the model's response shape — is **not** a shared
contract. It is internal to the extraction call and lives beside the prompt
(`modules/conventions/constants.ts`), because nothing outside the server ever
sees an unverified candidate.

## 4. Server

### 4.1 Migration `0013_conventions_extract`

`conventions` gains `scan_id`, `category`, `evidence_start_line`,
`evidence_end_line`, `status`, `created_at`, and **drops `accepted`** (D3 makes
it a two-valued column with a third name). New table `convention_scans`
(`id`, `workspace_id`, `repo_id`, `sample_count`, `model`, `created_at`), and
`conventions.scan_id` references it `ON DELETE cascade` so D4's replace is one
delete. Index on `(workspace_id, repo_id)`.

### 4.2 Module `server/src/modules/conventions/`

```
routes.ts      GET/POST/PATCH, zod schemas, workspace scoping
service.ts     scan orchestration, draft composition, skill creation
repository.ts  conventions + convention_scans
sampling.ts    the code-only sample picker (pure, testable)
verify.ts      the evidence gate (pure, testable)
skill-draft.ts candidates → markdown (pure, testable)
constants.ts   probe list, caps, the extraction response schema
```

| Route | Does |
|---|---|
| `GET /repos/:id/conventions` | the current `ConventionsView` |
| `POST /repos/:id/conventions/extract` | sample → model → verify → replace → returns the new `ConventionsView` |
| `PATCH /conventions/:id` | `{ status?, rule?, category? }` — accept/reject **and** the inline edit |
| `GET /repos/:id/conventions/skill-draft` | the composed draft over the accepted candidates |
| `POST /repos/:id/conventions/skill` | writes the skill (`source: 'extracted'`) and returns it |

Every repo-scoped route resolves tenancy through `getContext` +
`requireRepoInWorkspace`.

### 4.3 The scan, step by step

1. **Sample (code).** Probe a fixed list of config and house-rules files
   (`package.json`, `tsconfig.json`, the eslint/prettier/editorconfig family,
   `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`); then
   `repoIntel.getConventionSamples(repoId, 12)` for the top-ranked source files.
   Read each through `container.git.readFile`, skip what is missing, cap each
   excerpt at `SAMPLE_LINE_CAP` lines and `SAMPLE_CHAR_CAP` characters.
   `sample_count` is how many files actually came back.
   No samples → `422 no_samples` (repo not cloned or not indexed), nothing written.
2. **Ask (one model call).** `completeStructured` with `schemaName:
   'ConventionExtraction'`, the provider/model from
   `resolveFeatureModel(container, workspaceId, 'conventions')`, the system
   prompt from `src/prompts/conventions.system.md`, and the numbered excerpts
   wrapped in `<untrusted source="repo">`.
3. **Verify (code).** Per candidate: the path must be one we sampled; the line
   range must be inside the file, ordered, and at most `EVIDENCE_LINE_CAP` lines;
   at least one non-blank line of the model's snippet must appear in the file —
   inside the claimed range, or anywhere in the file, in which case the range is
   **corrected** to where it really is. Then the snippet is re-read from the
   file. Anything else is dropped. Duplicate rules collapse to the highest
   confidence.
4. **Replace.** Delete the repo's previous scans, insert the scan row and the
   verified candidates as `accepted`.

### 4.4 The draft (§D5)

```markdown
# <repo>-conventions

House conventions for `<owner/repo>`. Flag changes that violate any rule below
and cite the offending `file:line`.

## <rule slug>
<rule>

Detected in `src/api/users.ts:23-31`:

```ts
<snippet, verbatim from the file>
```
```

`name` = `<repo>-conventions`, `description` = `N house conventions extracted
from <repo>`, `type` = `convention`.

## 5. Client

New route `/repos/[repoId]/conventions`, reached from a new **Conventions**
entry in the SKILLS LAB nav group (`g c`), with the Skills-Lab breadcrumb the
mockup shows.

```
_components/ConventionsView/        header, scan meta, toolbar, list, empty/error
  _components/ConventionCard/       rule, evidence block + copy, confidence bar,
                                    Accepted/Reject, inline edit
  _components/CreateSkillFromConventionsModal/
                                    name · description · type · enabled ·
                                    the full body in a line-numbered editor
```

Data through `src/lib/hooks/conventions.ts`; no `fetch` in a component. Runtime
lists (categories) go in `src/lib/convention-categories.ts`, **not** imported
from the vendored Zod barrel — see the client insight of 2026-09-20.

## 6. Done when

- [x] `POST /repos/:id/conventions/extract` on an indexed repo returns
      candidates whose `evidence_path` + lines resolve to real code, and a
      second call replaces the first batch.
- [x] A candidate the model invented (bad path, or a snippet not in the file) is
      absent from the response.
- [x] Reject a card, and the counter and the draft both drop it.
- [x] Edit a rule inline, open the modal, and the edited text is in the body.
- [x] Save, and the skill is on `/skills` with the **Extracted** source badge and
      can be attached to an agent.
- [x] Cancel, and nothing is written.
- [x] tests: server-unit (`test/conventions-extract.test.ts`, 18),
      server-integration (`test/conventions.it.test.ts`, 13 — the five routes
      against real Postgres with a mock LLM + mock git), client
      (`ConventionCard` 9, `ConventionsView` 9,
      `CreateSkillFromConventionsModal` 6).

## 7. Reconciled with what was built

Four things landed differently from the plan above.

| Planned | Built | Why |
|---|---|---|
| the service calls `resolveFeatureModel(container, …)` | `container.featureModel(workspaceId, id)`, and `resolveFeatureModel` now takes a `Db` | a module importing `modules/settings/` is a `no-cross-module` violation, and passing the Container into `feature-models.ts` closes a `no-circular` one. The function had no callers before this, so nothing else moved |
| the stored span is the model's `start..end` | the span is taken from the **snippet**, and `start..end` is only a hint for locating it | line numbers are the field a model gets wrong most often; the quoted lines are the part the gate just proved. `verify.ts` explains it in place |
| — | one migration, `0013_conventions_extract`, carrying both the additions and the `accepted` drop | `drizzle-kit generate` asks interactively whether a new column is a rename of a dropped one, and the prompt cannot be answered from a non-interactive shell. Generated in two passes, then folded into one file with `0014`'s snapshot re-pointed at `0012` — see the server INSIGHTS entry |
| — | a `Conventions` entry in `client/src/vendor/ui/nav.ts` (`g c`) | the standing exception `client/AGENTS.md` records: `Sidebar` imports `NAV` directly and there is no override |

Still deliberately not built, and still worth building: linking the new skill to
an agent from the modal (one `POST /agents/:id/skills` away), and splitting a
scan into one skill per category.
