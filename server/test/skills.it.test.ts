import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import * as t from '../src/db/schema.js';
import { SkillsRepository, type InsertSkill } from '../src/modules/skills/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * `SkillsRepository` against a real Postgres. Covers the two rules the rest of
 * the feature leans on: every read is workspace-scoped, and ONLY a changed body
 * appends a `skill_versions` row and bumps `version`. Plus the two joins over
 * `agent_skills` — the reuse count and the ordered, enabled-only prompt read.
 */
d('SkillsRepository', () => {
  let pg: PgFixture;
  let repo: SkillsRepository;
  let ws: string;
  let otherWs: string;

  beforeAll(async () => {
    pg = await startPg();
    repo = new SkillsRepository(pg.handle.db);
    const rows = await pg.handle.db
      .insert(t.workspaces)
      .values([{ name: 'skills-ws' }, { name: 'skills-other-ws' }])
      .returning({ id: t.workspaces.id });
    ws = rows[0]!.id;
    otherWs = rows[1]!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  /** A minimal valid skill; `name` keeps each test's rows distinguishable. */
  function skillValues(name: string, over: Partial<InsertSkill> = {}): InsertSkill {
    return {
      workspaceId: ws,
      name,
      description: `Flag everything ${name} is about.`,
      type: 'rubric',
      source: 'manual',
      body: `# ${name}\n\nThe original body.`,
      ...over,
    };
  }

  /** An agent to hang `agent_skills` links off. A2 owns the write API; the
   *  link rows are inserted directly here so the test exercises only A1. */
  async function makeAgent(name: string): Promise<string> {
    const [row] = await pg.handle.db
      .insert(t.agents)
      .values({
        workspaceId: ws,
        name,
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'Review the diff.',
      })
      .returning({ id: t.agents.id });
    return row!.id;
  }

  function versionRows(skillId: string) {
    return pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(asc(t.skillVersions.version));
  }

  it('list and getById are workspace-scoped', async () => {
    const mine = await repo.insert(skillValues('scoped-mine'));
    const theirs = await repo.insert(skillValues('scoped-theirs', { workspaceId: otherWs }));

    const listed = await repo.list(ws);
    expect(listed.map((s) => s.id)).toContain(mine.id);
    expect(listed.map((s) => s.id)).not.toContain(theirs.id);

    // The other workspace's id is a miss, not a permission error — the route
    // renders that as a 404 and never confirms the id exists.
    expect(await repo.getById(ws, theirs.id)).toBeUndefined();
    expect(await repo.getById(otherWs, theirs.id)).toBeDefined();

    // getManyByIds filters the same way, and short-circuits an empty list.
    expect(await repo.getManyByIds(ws, [])).toEqual([]);
    const many = await repo.getManyByIds(ws, [mine.id, theirs.id]);
    expect(many.map((s) => s.id)).toEqual([mine.id]);
  });

  it('list is ordered by name ascending', async () => {
    const [ordered] = await pg.handle.db
      .insert(t.workspaces)
      .values({ name: 'skills-order-ws' })
      .returning({ id: t.workspaces.id });
    for (const name of ['zeta-gate', 'alpha-gate', 'mid-gate']) {
      await repo.insert(skillValues(name, { workspaceId: ordered!.id }));
    }
    const names = (await repo.list(ordered!.id)).map((s) => s.name);
    expect(names).toEqual(['alpha-gate', 'mid-gate', 'zeta-gate']);
  });

  it('insert starts at version 1 and writes the matching skill_versions row', async () => {
    const skill = await repo.insert(skillValues('insert-v1'));
    expect(skill.version).toBe(1);
    expect(skill.enabled).toBe(true); // default

    const versions = await versionRows(skill.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 1, body: skill.body });

    expect((await repo.listVersions(skill.id)).map((v) => v.version)).toEqual([1]);
  });

  it('a changed body bumps the version and appends the NEW body', async () => {
    const skill = await repo.insert(skillValues('body-bump'));
    const updated = await repo.update(ws, skill.id, { body: '# body-bump\n\nRewritten.' });

    expect(updated?.version).toBe(2);
    expect(updated?.body).toBe('# body-bump\n\nRewritten.');

    const versions = await versionRows(skill.id);
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.body)).toEqual([skill.body, '# body-bump\n\nRewritten.']);

    // listVersions is newest-first.
    expect((await repo.listVersions(skill.id)).map((v) => v.version)).toEqual([2, 1]);
  });

  it('a name-only edit does not bump the version or append a revision', async () => {
    const skill = await repo.insert(skillValues('name-only'));
    const updated = await repo.update(ws, skill.id, {
      name: 'name-only-renamed',
      description: 'Reworded.',
      type: 'convention',
      enabled: false,
    });

    expect(updated?.version).toBe(1);
    expect(updated?.name).toBe('name-only-renamed');
    expect(updated?.enabled).toBe(false);
    expect(await versionRows(skill.id)).toHaveLength(1);

    // Re-submitting the identical body is not a change either.
    const same = await repo.update(ws, skill.id, { body: skill.body });
    expect(same?.version).toBe(1);
    expect(await versionRows(skill.id)).toHaveLength(1);
  });

  it('update returns undefined for a skill in another workspace', async () => {
    const theirs = await repo.insert(skillValues('foreign-update', { workspaceId: otherWs }));
    expect(await repo.update(ws, theirs.id, { body: 'hijacked' })).toBeUndefined();

    const untouched = await repo.getById(otherWs, theirs.id);
    expect(untouched?.body).toBe(theirs.body);
    expect(untouched?.version).toBe(1);
  });

  it('deleteById removes the skill and cascades its agent_skills links', async () => {
    const skill = await repo.insert(skillValues('delete-me'));
    const agentId = await makeAgent('Deleter');
    await pg.handle.db.insert(t.agentSkills).values({ agentId, skillId: skill.id, order: 0 });

    expect(await repo.deleteById(ws, skill.id)).toBe(true);
    expect(await repo.getById(ws, skill.id)).toBeUndefined();

    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agentId));
    expect(links).toHaveLength(0);

    // Second delete is a miss; another workspace's skill is never deletable.
    expect(await repo.deleteById(ws, skill.id)).toBe(false);
    const theirs = await repo.insert(skillValues('foreign-delete', { workspaceId: otherWs }));
    expect(await repo.deleteById(ws, theirs.id)).toBe(false);
  });

  it('countAgentsUsing counts the agents a skill is attached to', async () => {
    const skill = await repo.insert(skillValues('shared-gate'));
    expect(await repo.countAgentsUsing(ws, skill.id)).toBe(0);

    const a = await makeAgent('Reuse A');
    const b = await makeAgent('Reuse B');
    await pg.handle.db.insert(t.agentSkills).values([
      { agentId: a, skillId: skill.id, order: 0 },
      { agentId: b, skillId: skill.id, order: 0 },
    ]);

    expect(await repo.countAgentsUsing(ws, skill.id)).toBe(2);
    // The join is workspace-scoped through `agents`, so another tenant sees none.
    expect(await repo.countAgentsUsing(otherWs, skill.id)).toBe(0);
  });

  it('promptBodiesForAgent returns enabled bodies in attached order', async () => {
    const agentId = await makeAgent('Prompt Reader');
    const first = await repo.insert(skillValues('prompt-first'));
    const second = await repo.insert(skillValues('prompt-second'));
    const off = await repo.insert(skillValues('prompt-disabled', { enabled: false }));

    // Attached out of insertion order on purpose: `order` is what decides.
    await pg.handle.db.insert(t.agentSkills).values([
      { agentId, skillId: second.id, order: 0 },
      { agentId, skillId: off.id, order: 1 },
      { agentId, skillId: first.id, order: 2 },
    ]);

    const bodies = await repo.promptBodiesForAgent(agentId);
    expect(bodies.map((s) => s.name)).toEqual(['prompt-second', 'prompt-first']);
    expect(bodies.map((s) => s.body)).toEqual([second.body, first.body]);
    expect(bodies.every((s) => s.version === 1)).toBe(true);

    // The globally-disabled skill is attached but contributes nothing.
    expect(bodies.map((s) => s.id)).not.toContain(off.id);
    const stillLinked = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, agentId), eq(t.agentSkills.skillId, off.id)));
    expect(stillLinked).toHaveLength(1);

    // Enabling it puts it back, in its stored position.
    await repo.update(ws, off.id, { enabled: true });
    const withOff = await repo.promptBodiesForAgent(agentId);
    expect(withOff.map((s) => s.name)).toEqual([
      'prompt-second',
      'prompt-disabled',
      'prompt-first',
    ]);
  });

  it('promptBodiesForAgent is empty for an agent with no skills', async () => {
    const agentId = await makeAgent('Bare');
    expect(await repo.promptBodiesForAgent(agentId)).toEqual([]);
  });
});
