import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

/**
 * The `/conventions` HTTP surface end to end (spec §4.2), driven through
 * `app.inject` against a real Postgres with a mock model and a mock clone.
 *
 * The claims worth an integration test are the ones no unit test can make:
 * that the evidence gate runs between the model and the database (a candidate
 * the model invented never becomes a row), that a re-scan replaces rather than
 * accumulates, and that the skill this feature writes gets its provenance from
 * the endpoint rather than the payload.
 */

const USERS_TS = [
  "import { db } from '../db';",
  '',
  'export async function getUser(id: string) {',
  '  const user = await db.users.find(id);',
  '  return user;',
  '}',
].join('\n');

const CLONE_FILES: Record<string, string> = {
  'package.json': '{ "name": "payments-api" }',
  'src/api/users.ts': USERS_TS,
};

/** One real rule and one the model made up — the gate must keep exactly one. */
const MODEL_ANSWER = {
  conventions: [
    {
      category: 'async',
      rule: 'Always use async/await instead of .then() chains.',
      evidence_path: 'src/api/users.ts',
      evidence_start_line: 4,
      evidence_end_line: 4,
      evidence_snippet: '  const user = await db.users.find(id);',
      confidence: 0.91,
    },
    {
      category: 'structure',
      rule: 'Redis access goes through the src/lib/redis.ts singleton.',
      evidence_path: 'src/lib/redis.ts',
      evidence_start_line: 1,
      evidence_end_line: 1,
      evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
      confidence: 0.85,
    },
  ],
};

d('/conventions routes', () => {
  let pg: PgFixture;
  let app: FastifyInstance;
  let repoId: string;
  let llm: MockLLMProvider;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [repo] = await pg.handle.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.fullName, 'acme/payments-api'));
    repoId = repo!.id;

    llm = new MockLLMProvider('openai', {
      structuredBySchema: { ConventionExtraction: MODEL_ANSWER },
    });

    // The real facade would need an indexed clone; the scan only asks it which
    // source files to read, so a one-method stand-in is the whole dependency.
    const repoIntel = {
      getConventionSamples: async () => ['src/api/users.ts'],
    } as unknown as RepoIntel;

    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ files: CLONE_FILES }),
        github: new MockGitHubClient(),
        repoIntel,
        llm: { openai: llm },
      },
    });
  });

  beforeEach(async () => {
    await pg.handle.db.delete(t.conventionScans);
    await pg.handle.db.delete(t.conventions);
    await pg.handle.db.delete(t.skills);
    llm.calls = [];
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  const extract = async () => {
    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  it('starts empty, with no scan', async () => {
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ scan: null, candidates: [] });
  });

  it('stores only the candidate whose evidence is really in the clone', async () => {
    const view = await extract();

    expect(view.candidates).toHaveLength(1);
    expect(view.candidates[0]).toMatchObject({
      rule: 'Always use async/await instead of .then() chains.',
      evidence_path: 'src/api/users.ts',
      evidence_start_line: 4,
      evidence_end_line: 4,
      status: 'accepted',
    });
    // The invented file never reached the database either.
    const rows = await pg.handle.db.select().from(t.conventions);
    expect(rows).toHaveLength(1);
  });

  it('records the scan: how many files it read and which model read them', async () => {
    const view = await extract();
    // package.json (config probe) + src/api/users.ts (ranked).
    expect(view.scan).toMatchObject({ sample_count: 2, repo_id: repoId });
    expect(view.scan.model).toContain('openai/');
  });

  it('shows the model only the sampled files, wrapped as untrusted data', async () => {
    await extract();
    const call = llm.calls.find((c) => c.method === 'completeStructured');
    const messages = (call?.req as { messages: { role: string; content: string }[] }).messages;
    const user = messages.find((m) => m.role === 'user')!.content;
    expect(user).toContain('<untrusted source="repo">');
    expect(user).toContain('--- src/api/users.ts ---');
    expect(user).not.toContain('src/lib/redis.ts');
  });

  it('replaces the previous scan instead of accumulating', async () => {
    await extract();
    const second = await extract();
    expect(second.candidates).toHaveLength(1);
    const scans = await pg.handle.db.select().from(t.conventionScans);
    expect(scans).toHaveLength(1);
  });

  it('rejects a candidate and keeps it visible', async () => {
    const view = await extract();
    const id = view.candidates[0].id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/conventions/${id}`,
      payload: { status: 'rejected' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('rejected');

    const after = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(after.json().candidates).toHaveLength(1);
  });

  it('takes an edited rule and builds the draft from it', async () => {
    const view = await extract();
    const id = view.candidates[0].id;
    await app.inject({
      method: 'PATCH',
      url: `/conventions/${id}`,
      payload: { rule: 'Never chain .then(); await instead.' },
    });

    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` });
    expect(res.statusCode).toBe(200);
    const draft = res.json();
    expect(draft.name).toBe('payments-api-conventions');
    expect(draft.body).toContain('Never chain .then(); await instead.');
    expect(draft.body).toContain('const user = await db.users.find(id);');
    expect(draft.convention_ids).toEqual([id]);
  });

  it('refuses to draft a skill when everything was rejected', async () => {
    const view = await extract();
    await app.inject({
      method: 'PATCH',
      url: `/conventions/${view.candidates[0].id}`,
      payload: { status: 'rejected' },
    });

    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('no_accepted_conventions');
  });

  it('stores the skill with the provenance the ENDPOINT decides, not the payload', async () => {
    const view = await extract();
    const id = view.candidates[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'payments-api-conventions',
        description: '1 house convention extracted from payments-api',
        type: 'convention',
        body: '# payments-api-conventions\n\nEdited by hand before saving.',
        enabled: true,
        convention_ids: [id],
        // A client cannot claim a provenance it did not go through: zod strips
        // this and the service writes `extracted` regardless.
        source: 'manual',
      },
    });

    expect(res.statusCode).toBe(201);
    const skill = res.json();
    expect(skill.source).toBe('extracted');
    expect(skill.type).toBe('convention');
    expect(skill.enabled).toBe(true);
    expect(skill.evidence_files).toEqual(['src/api/users.ts']);
    // The body stored is the one the user read in the modal, not the draft.
    expect(skill.body).toContain('Edited by hand before saving.');

    const [row] = await pg.handle.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.id, skill.id)));
    expect(row?.source).toBe('extracted');
  });

  it('can store the skill disabled when the user turns the toggle off', async () => {
    const view = await extract();
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'payments-api-conventions',
        description: 'x',
        type: 'convention',
        body: '# x',
        enabled: false,
        convention_ids: [view.candidates[0].id],
      },
    });
    expect(res.json().enabled).toBe(false);
  });

  it('is a 404 for a repo in another workspace, never a 403', async () => {
    const [other] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: 'other' })
      .returning();
    const [foreign] = await pg.handle.db
      .insert(t.repos)
      .values({
        workspaceId: other!.id,
        owner: 'other',
        name: 'repo',
        fullName: 'other/repo',
        defaultBranch: 'main',
      })
      .returning();

    const res = await app.inject({ method: 'GET', url: `/repos/${foreign!.id}/conventions` });
    expect(res.statusCode).toBe(404);
  });

  it('404s a PATCH against an unknown convention', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/conventions/00000000-0000-0000-0000-000000000000',
      payload: { status: 'rejected' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('422s a PATCH that changes nothing', async () => {
    const view = await extract();
    const res = await app.inject({
      method: 'PATCH',
      url: `/conventions/${view.candidates[0].id}`,
      payload: {},
    });
    expect(res.statusCode).toBe(422);
  });
});
