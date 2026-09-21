/**
 * The L03 set seeds as a set.
 *
 * PRs #485/#486 carry notes telling the reader to run them on the API Contract
 * Reviewer with four named skills. Seeding the fixtures without the agent, or
 * the agent without its links, leaves a demo that points at an empty picker —
 * and nothing in a type check or a compile notices, because the note is prose.
 * These assertions are the thing that notices.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[seed-l03] Docker not available — skipping integration tests.');
}

const AGENT = 'API Contract Reviewer';
const SKILLS = ['breaking-change', 'deprecation-policy', 'response-schema', 'semver-discipline'];

d('seed: the L03 API-contract set', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
  });

  afterAll(async () => {
    await pg?.stop();
  });

  it('creates the agent the fixtures name', async () => {
    const [agent] = await pg.handle.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, AGENT)));

    expect(agent).toBeDefined();
    expect(agent!.enabled).toBe(true);
    // The pair the A/B in seed-fixtures.ts was measured on.
    expect(agent!.provider).toBe('anthropic');
    expect(agent!.model).toBe('claude-sonnet-5');
    expect(agent!.systemPrompt).toContain('API contract');
  });

  it('creates the four skills it sends, enabled', async () => {
    const rows = await pg.handle.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId));

    for (const name of SKILLS) {
      const skill = rows.find((r) => r.name === name);
      expect(skill, `${name} is not seeded`).toBeDefined();
      expect(skill!.enabled).toBe(true);
      expect(skill!.source).toBe('manual');
      // Each body carries its own severity scale: a skill can be attached to an
      // agent whose prompt never mentions it.
      expect(skill!.body).toContain('CRITICAL');
    }
  });

  it('links all four to the agent, in prompt order, and they reach the prompt', async () => {
    const [agent] = await pg.handle.db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, AGENT)));

    const links = await pg.handle.db
      .select({ skillId: t.agentSkills.skillId, order: t.agentSkills.order })
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agent!.id));

    expect(links).toHaveLength(SKILLS.length);
    expect(links.map((l) => l.order).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);

    const byId = new Map(
      (await pg.handle.db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId))).map(
        (s) => [s.id, s.name],
      ),
    );
    const ordered = [...links]
      .sort((a, b) => a.order - b.order)
      .map((l) => byId.get(l.skillId));
    expect(ordered).toEqual(SKILLS);
  });

  it('seeds both fixture PRs with reviewable patch text', async () => {
    const [repo] = await pg.handle.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.fullName, 'acme/payments-api'));

    for (const number of [485, 486]) {
      const [pr] = await pg.handle.db
        .select()
        .from(t.pullRequests)
        .where(and(eq(t.pullRequests.repoId, repo!.id), eq(t.pullRequests.number, number)));
      expect(pr, `PR #${number} is not seeded`).toBeDefined();

      const files = await pg.handle.db
        .select()
        .from(t.prFiles)
        .where(eq(t.prFiles.prId, pr!.id));
      expect(files.length).toBeGreaterThan(0);

      // A seeded PR has no clone, so `loadDiff` rebuilds the diff from these
      // patches. Empty patch text reviews an empty diff and shows nothing.
      for (const f of files) {
        expect(f.patch, `${number} ${f.path} has no patch`).toBeTruthy();
        expect(f.patch!).toContain('@@');
      }

      // The listed size has to match the diff the reader is about to open.
      const counted = files.reduce(
        (acc, f) => {
          for (const line of (f.patch ?? '').split('\n')) {
            if (line.startsWith('@@')) continue;
            if (line.startsWith('+')) acc.add += 1;
            else if (line.startsWith('-')) acc.del += 1;
          }
          return acc;
        },
        { add: 0, del: 0 },
      );
      expect({ add: pr!.additions, del: pr!.deletions }).toEqual(counted);
    }
  });
});
