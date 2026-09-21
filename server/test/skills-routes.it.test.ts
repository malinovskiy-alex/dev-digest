import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { makeZipBase64, makeNonZip } from './helpers/make-zip.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills-routes] Docker not available — skipping integration tests.');
}

/** The committed reference archive: SKILL.md (front matter) + README.md + install.sh (0755). */
const FIXTURE_ZIP = new URL('../fixtures/skills/flake-patterns.zip', import.meta.url);

/**
 * The `/skills` HTTP surface end to end (spec §6.3), driven through
 * `app.inject` against a real Postgres.
 *
 * The two claims worth an integration test are the ones no unit test can make:
 * that provenance is decided by the endpoint and not the payload, and that the
 * two-step import writes NOTHING on preview and lands DISABLED on confirm.
 * Everything in between (versioning, 404-not-403, the delete count) is
 * verified against the real tables rather than a stubbed repository.
 */
d('/skills routes', () => {
  let pg: PgFixture;
  let app: FastifyInstance;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  });

  /**
   * Every test starts from an empty library — `POST /skills/import/preview`
   * proves it wrote nothing by the list still being empty afterwards, which
   * only means something if it was empty going in. The seeded demo skills go
   * with it; `agent_skills` links cascade.
   */
  beforeEach(async () => {
    await pg.handle.db.delete(t.skills);
  });

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  const skillBody = {
    name: 'uncovered-branch-gate',
    description: 'Name the branches of every changed function that no test reaches.',
    type: 'rubric' as const,
    body: '# Uncovered branch gate\n\nEnumerate the branches.',
  };

  async function createSkill(over: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...skillBody, ...over },
    });
    expect(res.statusCode).toBe(201);
    return res.json();
  }

  /** An agent to hang `agent_skills` links off, created through its own API. */
  async function createAgent(name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name,
        provider: 'openai',
        model: 'gpt-4o-mini',
        system_prompt: 'Review the diff.',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  // ---- CRUD ---------------------------------------------------------------

  it('POST /skills creates v1 and forces source "manual", whatever the client claims', async () => {
    // `source` is not a field of the create schema: a client that sends one is
    // claiming a provenance it did not go through, and zod strips it.
    const skill = await createSkill({ source: 'community' });

    expect(skill).toMatchObject({
      name: skillBody.name,
      description: skillBody.description,
      type: 'rubric',
      body: skillBody.body,
      source: 'manual',
      enabled: true,
      version: 1,
    });
    expect(typeof skill.id).toBe('string');

    const versions = await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` });
    expect(versions.statusCode).toBe(200);
    expect(versions.json()).toHaveLength(1);
    expect(versions.json()[0]).toMatchObject({ version: 1, body: skillBody.body });
  });

  it('GET /skills lists the workspace; GET /skills/:id reads one back', async () => {
    const created = await createSkill();

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].id).toBe(created.id);

    const one = await app.inject({ method: 'GET', url: `/skills/${created.id}` });
    expect(one.statusCode).toBe(200);
    expect(one.json()).toMatchObject({ id: created.id, name: skillBody.name });
  });

  it('an unknown uuid is 404 not_found; a non-uuid fails validation with 422', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/skills/00000000-0000-4000-8000-000000000000',
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');

    // Schema-first: `:id` never reaches the handler, so this is not a DB error.
    const malformed = await app.inject({ method: 'GET', url: '/skills/not-a-uuid' });
    expect(malformed.statusCode).toBe(422);
    expect(malformed.json().error.code).toBe('validation_error');
  });

  it('PUT bumps the version only when the body changes', async () => {
    const created = await createSkill();

    const edited = await app.inject({
      method: 'PUT',
      url: `/skills/${created.id}`,
      payload: { body: '# Uncovered branch gate\n\nEnumerate the branches, then name them.' },
    });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().version).toBe(2);

    // Name / description / type / enabled are metadata: the prompt text did not
    // change, so the version a user sees in a run trace must not move either.
    const renamed = await app.inject({
      method: 'PUT',
      url: `/skills/${created.id}`,
      payload: { name: 'branch-gate', enabled: false },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ name: 'branch-gate', enabled: false, version: 2 });

    const versions = await app.inject({ method: 'GET', url: `/skills/${created.id}/versions` });
    expect(versions.json().map((v: { version: number }) => v.version)).toEqual([2, 1]);

    const gone = await app.inject({
      method: 'PUT',
      url: '/skills/00000000-0000-4000-8000-000000000000',
      payload: { name: 'nope' },
    });
    expect(gone.statusCode).toBe(404);
  });

  it('DELETE reports how many agents lost the skill', async () => {
    const created = await createSkill();
    const first = await createAgent('Delete Count A');
    const second = await createAgent('Delete Count B');
    for (const agentId of [first, second]) {
      const linked = await app.inject({
        method: 'POST',
        url: `/agents/${agentId}/skills`,
        payload: { skill_ids: [created.id] },
      });
      expect(linked.statusCode).toBe(200);
    }

    // Read BEFORE the delete: `agent_skills` cascades, so asking afterwards
    // would always answer 0.
    const res = await app.inject({ method: 'DELETE', url: `/skills/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, unlinked_from: 2 });

    const again = await app.inject({ method: 'DELETE', url: `/skills/${created.id}` });
    expect(again.statusCode).toBe(404);
  });

  it('DELETE of an unused skill reports unlinked_from: 0', async () => {
    const created = await createSkill();
    const res = await app.inject({ method: 'DELETE', url: `/skills/${created.id}` });
    expect(res.json()).toEqual({ ok: true, unlinked_from: 0 });
  });

  // ---- Import: preview ----------------------------------------------------

  const markdownUpload = {
    kind: 'markdown' as const,
    filename: 'flake-patterns.md',
    text: '# Flake patterns\n\nFlag sleeps, real clocks and live network in unit tests.',
  };

  it('POST /skills/import/preview parses the upload and writes nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: markdownUpload,
    });
    expect(res.statusCode).toBe(200);

    const preview = res.json();
    expect(preview).toMatchObject({
      name: 'Flake patterns',
      description: 'Flag sleeps, real clocks and live network in unit tests.',
      source: 'imported_file',
    });
    expect(preview.token).toMatch(/^[0-9a-f]{64}$/);

    // The whole point of a two-step import: step one persists nothing at all.
    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.json()).toEqual([]);
  });

  // ---- Import: confirm ----------------------------------------------------

  it('POST /skills/import stores the previewed skill disabled, as imported_file', async () => {
    const preview = (
      await app.inject({
        method: 'POST',
        url: '/skills/import/preview',
        payload: markdownUpload,
      })
    ).json();

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import',
      payload: {
        ...markdownUpload,
        token: preview.token,
        // The user corrected the name in the preview form; the BODY still comes
        // from re-parsing the upload, never from the request.
        name: 'flake-patterns',
        description: preview.description,
        type: 'convention',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      name: 'flake-patterns',
      type: 'convention',
      source: 'imported_file',
      enabled: false,
      version: 1,
      body: preview.body,
    });
  });

  it('a token that does not match the re-parsed upload is 409 import_changed', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import',
      payload: {
        ...markdownUpload,
        token: 'f'.repeat(64),
        name: 'flake-patterns',
        description: 'Tampered.',
        type: 'convention',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('import_changed');

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.json()).toEqual([]);
  });

  it('an upload that is not a ZIP is 422 unsupported_archive', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: {
        kind: 'archive',
        filename: 'not-a-zip.gz',
        base64: makeNonZip().toString('base64'),
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('unsupported_archive');
  });

  it('an archive with no markdown is 422 no_skill_core', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: {
        kind: 'archive',
        filename: 'scripts-only.zip',
        base64: makeZipBase64([{ path: 'install.sh', content: '#!/bin/sh\n' }]),
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('no_skill_core');
  });

  // ---- The reference archive ---------------------------------------------

  it('the committed flake-patterns.zip previews and imports end to end', async () => {
    const base64 = readFileSync(FIXTURE_ZIP).toString('base64');
    const upload = { kind: 'archive' as const, filename: 'flake-patterns.zip', base64 };

    const previewRes = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: upload,
    });
    expect(previewRes.statusCode).toBe(200);
    const preview = previewRes.json();

    // Front matter wins over the heading and the filename.
    expect(preview).toMatchObject({ name: 'flake-patterns', type: 'convention' });
    expect(preview.source).toBe('imported_file');
    expect(preview.body.startsWith('---')).toBe(false); // front matter stripped

    const byPath = Object.fromEntries(
      preview.entries.map((e: { path: string }) => [e.path, e]),
    );
    expect(byPath['SKILL.md']).toMatchObject({ kind: 'core', ignored: false });
    // The product's central claim: the executable part is listed, never read.
    expect(byPath['install.sh']).toMatchObject({ kind: 'executable', ignored: true });
    expect(byPath['README.md']).toMatchObject({ ignored: true });
    expect(preview.warnings.some((w: string) => w.includes('install.sh'))).toBe(true);

    const confirmed = await app.inject({
      method: 'POST',
      url: '/skills/import',
      payload: {
        ...upload,
        token: preview.token,
        name: preview.name,
        description: preview.description,
        type: preview.type,
      },
    });
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json()).toMatchObject({
      name: 'flake-patterns',
      source: 'imported_file',
      enabled: false,
      version: 1,
    });

    // Only the core markdown made it into the stored body.
    const stored = confirmed.json();
    expect(stored.body).toBe(preview.body);
    expect(stored.body).not.toContain('#!/bin/sh');

    // …and a disabled skill contributes no body to any agent's prompt.
    const rows = await pg.handle.db.select().from(t.skills);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.enabled).toBe(false);
    expect(Buffer.byteLength(rows[0]!.body, 'utf8')).toBeGreaterThan(0);
  });
});
