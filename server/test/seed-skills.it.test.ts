import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import { SEED_SKILLS } from '../src/db/seed-skills.js';
import { FIXTURE_PULLS } from '../src/db/seed-fixtures.js';
import * as t from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[seed-skills] Docker not available — skipping integration tests.');
}

const TEST_QUALITY = 'Test Quality Reviewer';
const GENERAL = 'General Reviewer';

/** Row counts of every table the L02 seed writes to. */
async function rowCounts(db: Db) {
  const [skills, skillVersions, agents, agentSkills, pulls, files, commits] = await Promise.all([
    db.select().from(t.skills),
    db.select().from(t.skillVersions),
    db.select().from(t.agents),
    db.select().from(t.agentSkills),
    db.select().from(t.pullRequests),
    db.select().from(t.prFiles),
    db.select().from(t.prCommits),
  ]);
  return {
    skills: skills.length,
    skillVersions: skillVersions.length,
    agents: agents.length,
    agentSkills: agentSkills.length,
    pullRequests: pulls.length,
    prFiles: files.length,
    prCommits: commits.length,
  };
}

async function agentIdByName(db: Db, workspaceId: string, name: string): Promise<string> {
  const [row] = await db
    .select()
    .from(t.agents)
    .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, name)));
  expect(row, `agent "${name}" should be seeded`).toBeDefined();
  return row!.id;
}

/** Linked skill names for one agent, in `agent_skills.order` ascending. */
async function linkedSkillNames(db: Db, agentId: string): Promise<string[]> {
  const rows = await db
    .select({ name: t.skills.name })
    .from(t.agentSkills)
    .innerJoin(t.skills, eq(t.skills.id, t.agentSkills.skillId))
    .where(eq(t.agentSkills.agentId, agentId))
    .orderBy(asc(t.agentSkills.order));
  return rows.map((r) => r.name);
}

/**
 * The L02 seed: four skills with their v1 snapshots, the Test Quality Reviewer
 * agent, the ordered links that put skill bodies into its prompt, and the two
 * control-experiment fixture PRs.
 *
 * The property most worth pinning here is **idempotency**: the seed is the one
 * piece of code that runs repeatedly against a database that already has its
 * output in it, and a lookup that misses turns a re-seed into duplicate skills,
 * duplicate links and a second copy of every fixture PR.
 */
d('seed — L02 skills, agent, links and fixture PRs', () => {
  let pg: PgFixture;
  let db: Db;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
    ({ workspaceId } = await seed(db));
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('creates the four seeded skills, enabled, manual, at version 1', async () => {
    const rows = await db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));

    expect(rows.map((r) => r.name)).toEqual(
      [...SEED_SKILLS].map((s) => s.name).sort((a, b) => a.localeCompare(b)),
    );
    for (const row of rows) {
      const source = SEED_SKILLS.find((s) => s.name === row.name)!;
      expect(row.source).toBe('manual');
      expect(row.enabled).toBe(true);
      expect(row.version).toBe(1);
      expect(row.type).toBe(source.type);
      expect(row.body).toBe(source.body);
      expect(row.body.length).toBeGreaterThan(0);
    }
  });

  it('writes the matching v1 skill_versions row for every seeded skill', async () => {
    const skills = await db.select().from(t.skills).where(eq(t.skills.workspaceId, workspaceId));
    const versions = await db
      .select()
      .from(t.skillVersions)
      .where(
        inArray(
          t.skillVersions.skillId,
          skills.map((s) => s.id),
        ),
      );

    // One snapshot per skill, at version 1, holding the current body — so the
    // version history is not empty the moment a seeded skill is first edited.
    expect(versions).toHaveLength(SEED_SKILLS.length);
    for (const skill of skills) {
      const v = versions.find((row) => row.skillId === skill.id);
      expect(v, `skill_versions row for "${skill.name}"`).toBeDefined();
      expect(v!.version).toBe(1);
      expect(v!.body).toBe(skill.body);
    }
  });

  it('creates the Test Quality Reviewer agent on the default provider/model', async () => {
    const [agent] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, TEST_QUALITY)));

    expect(agent).toBeDefined();
    expect(agent!.provider).toBe('openrouter');
    expect(agent!.model).toBe('deepseek/deepseek-v4-flash');
    expect(agent!.enabled).toBe(true);
    expect(agent!.version).toBe(1);
    expect(agent!.description).toContain('Reviews the tests in a diff, not the code');
    // The prompt carries the role and the conventions; the enumerable checks
    // live in the linked skills, which is what makes them observable.
    expect(agent!.systemPrompt).toContain('for the quality of its');
    expect(agent!.systemPrompt).not.toContain('Note for maintainers');
  });

  it('links three skills to Test Quality Reviewer in prompt order, leaving order 3 free', async () => {
    const agentId = await agentIdByName(db, workspaceId, TEST_QUALITY);
    const links = await db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order));

    expect(links.map((l) => l.order)).toEqual([0, 1, 2]);
    expect(await linkedSkillNames(db, agentId)).toEqual([
      'uncovered-branch-gate',
      'corner-case-checklist',
      'over-mocking-gate',
    ]);

    // Order 3 is the slot `flake-patterns` lands in when it is imported by hand
    // through the UI. The seed must not take it, and must not seed the skill.
    expect(links.some((l) => l.order >= 3)).toBe(false);
    const [flake] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, 'flake-patterns')));
    expect(flake).toBeUndefined();
  });

  it('attaches api-contract-gate to General Reviewer — the shared row', async () => {
    const [skill] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, 'api-contract-gate')));
    expect(skill).toBeDefined();

    const holders = await db
      .select({ name: t.agents.name, order: t.agentSkills.order })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agents.id, t.agentSkills.agentId))
      .where(eq(t.agentSkills.skillId, skill!.id));

    // The reuse requirement: one skill row, written once in ./seed-skills.ts,
    // reachable from an agent that is NOT the one the L02 lesson creates.
    // Attaching it to a second agent is a manual step in the UI (spec §12) and
    // must stay possible — hence the row is shared, never duplicated.
    expect(holders.map((h) => h.name)).toContain(GENERAL);
    expect(holders.map((h) => h.name)).not.toContain(TEST_QUALITY);
    expect(holders.find((h) => h.name === GENERAL)!.order).toBe(0);
    expect(
      await db.select().from(t.skills).where(eq(t.skills.name, 'api-contract-gate')),
    ).toHaveLength(1);
  });

  it('seeds the two fixture PRs with non-empty patch text on every file', async () => {
    for (const fixture of FIXTURE_PULLS) {
      const [pr] = await db
        .select()
        .from(t.pullRequests)
        .where(
          and(
            eq(t.pullRequests.workspaceId, workspaceId),
            eq(t.pullRequests.number, fixture.number),
          ),
        );
      expect(pr, `PR #${fixture.number}`).toBeDefined();
      expect(pr!.title).toBe(fixture.title);
      expect(pr!.filesCount).toBe(fixture.files.length);

      const files = await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr!.id));
      expect(files).toHaveLength(fixture.files.length);
      for (const file of files) {
        // `loadDiff` reconstructs the unified diff from this column when the
        // repo has no clone. Empty patch ⇒ empty diff ⇒ an empty review, and
        // the control experiment shows nothing.
        expect(file.patch, `${fixture.number} ${file.path}`).toBeTruthy();
        expect(file.patch!.length).toBeGreaterThan(0);
        expect(file.patch).toContain('@@');
      }

      const commits = await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr!.id));
      expect(commits).toHaveLength(1);
      expect(commits[0]!.sha).toBe(fixture.headSha);

      // The review is run live by the user, both arms of it. Nothing pre-baked.
      const reviews = await db.select().from(t.reviews).where(eq(t.reviews.prId, pr!.id));
      expect(reviews).toHaveLength(0);
    }
  });

  it('attaches the fixture PRs to the existing acme/payments-api repo', async () => {
    const [repo] = await db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
    expect(repo).toBeDefined();

    const numbers = await db
      .select({ number: t.pullRequests.number })
      .from(t.pullRequests)
      .where(eq(t.pullRequests.repoId, repo!.id));
    for (const fixture of FIXTURE_PULLS) {
      expect(numbers.map((n) => n.number)).toContain(fixture.number);
    }
  });

  it('is idempotent — a second seed() changes no row count', async () => {
    const before = await rowCounts(db);
    const again = await seed(db);
    const after = await rowCounts(db);

    expect(again.workspaceId).toBe(workspaceId);
    expect(after).toEqual(before);

    // And the links are still the ones the prompt order depends on — a
    // duplicate insert that silently won the (agent_id, skill_id) conflict with
    // a different `order` would keep the counts equal but reorder the prompt.
    const agentId = await agentIdByName(db, workspaceId, TEST_QUALITY);
    expect(await linkedSkillNames(db, agentId)).toEqual([
      'uncovered-branch-gate',
      'corner-case-checklist',
      'over-mocking-gate',
    ]);
  });
});
