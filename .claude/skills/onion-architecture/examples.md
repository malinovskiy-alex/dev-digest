# Before / after

Every pair below is real code from this repository, and every "before" is an
entry in `server/.dependency-cruiser-known-violations.json`. None of them are
bugs — the code works. They are places where a ring boundary is crossed, and
each one has a cost you can name.

---

## 1. A route that owns its own SQL

**Rule:** `routes-no-db` · **Where:** `server/src/modules/pulls/routes.ts:238`

```ts
// before — src/modules/pulls/routes.ts
import { and, desc, eq, inArray } from 'drizzle-orm';
import * as t from '../../db/schema.js';

app.get('/repos/:id/pulls/:number', async (req) => {
  // …fetch from GitHub, then:
  await container.db.delete(t.prFiles).where(eq(t.prFiles.prId, pr.id));
  await container.db.insert(t.prFiles).values(/* … */);
  // …and in the catch branch, a second set of reads:
  const files   = await container.db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
  const commits = await container.db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id));
});
```

```ts
// after — src/modules/pulls/routes.ts  (Ring 4)
app.get('/repos/:id/pulls/:number', { schema: { params: PullParams } }, async (req) => {
  const { workspaceId } = await getContext(app.container, req);
  return service.detail(workspaceId, req.params.id, req.params.number);
});

// src/modules/pulls/service.ts  (Ring 2)
async detail(workspaceId: string, repoId: string, number: number): Promise<PrDetail> {
  const pr = await this.pulls.getByNumber(workspaceId, repoId, number);
  if (!pr) throw new NotFoundError(`PR #${number}`);
  try {
    const fresh = await (await this.deps.github()).getPullRequest(/* … */);
    await this.pulls.replaceFilesAndCommits(pr.id, fresh);   // one atomic method
    return toPrDetail(pr, fresh);
  } catch (err) {
    this.deps.log.warn({ err }, 'GitHub refresh skipped; serving persisted detail');
    return this.pulls.getPersistedDetail(pr.id);
  }
}
```

**What it costs as written.** The fallback path is a business rule — *"when
GitHub is unreachable, serve what we persisted"* — and it is only reachable
through an HTTP request, so it can only be tested by booting Fastify. The delete
+ insert pair is not in a transaction, and nothing in Ring 4 makes that visible.
`workspace_id` scoping has to be remembered here separately from the repository.

---

## 2. A domain helper that takes a database row

**Rule:** `core-no-io` · **Where:** `server/src/modules/repos/helpers.ts:44`

```ts
// before — src/modules/repos/helpers.ts  (claims to be Ring 1)
import * as t from '../../db/schema.js';

export function toRepoDto(row: typeof t.repos.$inferSelect): Repo { … }
```

```ts
// after — the mapper moves to the file that already owns the row
// src/modules/repos/repository.ts  (Ring 3)
import type { Repo } from '@devdigest/shared';

export class RepoRepository {
  private toDto(row: RepoRow): Repo { … }
  async list(workspaceId: string): Promise<Repo[]> {
    const rows = await this.db.select().from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
    return rows.map((r) => this.toDto(r));
  }
}
```

**What it costs as written.** `helpers.ts` is the file the whole module treats as
"safe to import anywhere", and it now transitively pulls in the schema barrel —
which is why `core-no-io` fires on a file containing no I/O at all. The service
above it deals in rows instead of `Repo`, so the persistence shape reaches Ring 2
as well.

**The minimum fix**, when you are not ready to move the mapper: add
`export type RepoRow = typeof t.repos.$inferSelect;` to `src/db/rows.ts` and
import that. It removes the schema import; it does not remove the row from the
domain.

---

## 3. A cycle made of two "pure" files

**Rule:** `no-circular` · **Where:** `server/src/modules/agents/helpers.ts:3`

```ts
// before
// helpers.ts     ─→ import type { AgentRow, AgentVersionRow } from './repository.js';
// repository.ts  ─→ import { isConfigChange } from './helpers.js';
```

```ts
// after — both take the row type from where it is actually defined
// src/modules/agents/helpers.ts
import type { AgentRow, AgentVersionRow } from '../../db/rows.js';
```

**What it costs as written.** `repository.ts` already imports those two types
from `../../db/rows.js` and re-exports them, so the helper is taking the long way
round and creating a cycle to do it. `src/db/rows.ts` exists for exactly this and
says so in its header: shared row types live next to the schema so a consumer can
name a row shape without importing a data layer.

---

## 4. A service that takes the container

**Rule:** `no-circular` (`container.ts ⇄ repo-intel/service.ts`)
**Where:** `server/src/modules/repos/service.ts:33`

```ts
// before
export class RepoService {
  private repo: RepoRepository;
  constructor(private container: Container) {
    this.repo = new RepoRepository(container.db);
  }
  async add(workspaceId: string, userId: string, url: string) {
    const token = await this.container.secrets.get(GITHUB_TOKEN_SECRET);
    await this.container.git.clone(/* … */);
    this.container.jobs.register(/* … */);
  }
}
```

```ts
// after
export interface RepoServiceDeps {
  repos: RepoRepository;
  git: GitClient;            // the port, not SimpleGitClient
  jobs: JobRunner;
  secrets: SecretsProvider;
}

export class RepoService {
  constructor(private deps: RepoServiceDeps) {}
  async add(workspaceId: string, userId: string, url: string) {
    const token = await this.deps.secrets.get(GITHUB_TOKEN_SECRET);
    await this.deps.git.clone(/* … */);
  }
}

// the route stays a one-liner, the container keeps composing:
const service = new RepoService({
  repos: new RepoRepository(app.container.db),
  git: app.container.git,
  jobs: app.container.jobs,
  secrets: app.container.secrets,
});
```

**What it costs as written.** The constructor no longer documents anything — you
have to read every method to learn what the service touches. A unit test has to
build a whole `Container`. And because the container constructs
`RepoIntelService(this)`, the same pattern produces a genuine import cycle
between the composition root and a Ring 2 service, which `no-circular` reports
four times.

**Do not mass-refactor this.** It is recorded in `server/specs/onion-debt.md`.
Write *new* services in the "after" shape.

---

## 5. An adapter import that should have been a move, not a port

**Rule:** `no-concrete-adapters` · **Where:** `server/src/modules/reviews/diff-loader.ts:3`

```ts
// before
import { parseUnifiedDiff } from '../../adapters/git/diff-parser.js';
```

`diff-parser.ts` performs no I/O — it takes a diff string and returns hunks. It
is Ring 1 code living in an adapter folder, and wrapping it in a port would be
pure ceremony.

```ts
// after — move the file, keep the call
// src/platform/diff.ts  (Ring 1)
export function parseUnifiedDiff(diff: string): DiffFile[] { … }
```

Contrast with the neighbouring violation in the same rule:

```ts
// src/modules/repo-intel/service.ts — a REAL adapter, needs a port
import { … } from '../../adapters/astgrep/index.js';   // spawns ast-grep, touches the fs
```

That one gets an interface in `src/vendor/shared/adapters.ts`, a container getter
and a `ContainerOverrides` field — because a test must be able to replace it.

**The distinction to carry:** *does it do anything the test would want to fake?*
No → move it inward. Yes → put a port in front of it.

---

## 6. A constant reaching across modules

**Rule:** `no-cross-module` · **Where:** `server/src/modules/repos/service.ts:12`

```ts
// before
import { INDEX_JOB_KIND, REFRESH_JOB_KIND } from '../repo-intel/constants.js';
```

```ts
// after — src/modules/_shared/job-kinds.ts
export const INDEX_JOB_KIND = 'repo-intel.index';
export const REFRESH_JOB_KIND = 'repo-intel.refresh';
```

**What it costs as written.** A job kind that two modules use is a contract
between them, not a private constant of one. As written, `repos` cannot be read,
moved or tested without `repo-intel`, and the direction of that dependency is
accidental — it exists because of where someone typed the string first.

---

## 7. What "right" looks like

Nothing in `reviewer-core` appears in the baseline, and that is not luck:

```ts
// reviewer-core/src/review/run.ts  (Ring 1)
export async function runReview(input: ReviewInput): Promise<Review> {
  // the only side effect permitted is a call on the INJECTED provider
  const out = await input.llm.completeStructured({ … });
  input.checkCancelled?.();
  return ground(out, input.diff);   // score recomputed from survivors
}
```

The engine never learns which vendor answered, never reads a file, never sees a
`workspaceId`. Skill bodies, memory and specs arrive as resolved strings —
resolving a slug is the caller's job. That is the standard the rest of the
backend is measured against, and it is why the review engine is the one part of
this system you can test with no Docker, no keys and no network.
