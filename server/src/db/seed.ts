import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { RunTrace } from '@devdigest/shared';
import { assemblePrompt } from '@devdigest/reviewer-core';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
  TEST_QUALITY_REVIEWER_PROMPT,
  API_CONTRACT_REVIEWER_PROMPT,
} from './seed-prompts.js';
import { SEED_SKILLS } from './seed-skills.js';
import { FIXTURE_PULLS } from './seed-fixtures.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, and five built-in agents — General, Security,
 * Performance and Test Quality on the default openrouter/deepseek-v4-flash,
 * plus API Contract Reviewer on anthropic/claude-sonnet-5.
 *
 * L02 added the skills half: `skills` rows with their v1 `skill_versions`
 * snapshots (bodies in ./seed-skills.ts), the `agent_skills` links that put
 * them in an agent's prompt, and the control-experiment pull requests from
 * ./seed-fixtures.ts — #483/#484 for L02, #485/#486 for L03.
 *
 * An agent, its skills and its fixture PRs are seeded as ONE set. A fixture
 * whose note says "run this on X with skills Y" is useless if X and Y are not
 * in the workspace, which is what made the L03 pair worth seeding rather than
 * describing. `flake-patterns` is the deliberate exception: it is NOT seeded,
 * because it ships as an archive and arrives through the UI import flow, which
 * is the only end-to-end walk of that path.
 *
 * Later course lessons populate the remaining tables (conventions, memory,
 * eval, …) once their features are built — those still start empty here.
 */

/** Path of the project-context document in the seeded run's prompt (L05). */
export const SEED_DOC_PATH = 'docs/security-baseline.md';

/**
 * The seeded project-context document. Its last sentence occurs nowhere else
 * in the app, so the e2e can wait for it in the trace drawer.
 */
export const SEED_DOC = [
  '# Security baseline',
  '',
  '- Secrets (API keys, tokens, live Stripe keys) never appear in source; they come from the environment.',
  '- Public endpoints are rate limited per client before any database work.',
  '- Every list endpoint runs a bounded number of queries, independent of the page size.',
  '',
  'Payments-api rule PX-7: a committed sk_live key must be rotated within one hour of discovery.',
].join('\n');

/** The diff the seeded run "reviewed" — a slice of PR #482. */
const SEED_RUN_DIFF =
  'diff --git a/src/config.ts b/src/config.ts\n--- a/src/config.ts\n+++ b/src/config.ts\n@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,';

/**
 * One `agent_runs` + `run_traces` row for PR #482's sample review, and the
 * review pointed at it. The prompt assembly is built by reviewer-core's own
 * `assemblePrompt`, so the stored `specs` block is byte-for-byte what a real
 * run with that document attached would have sent.
 */
async function seedProjectContextRun(
  db: Db,
  input: { workspaceId: string; prId: string; agent: typeof t.agents.$inferSelect },
): Promise<void> {
  const [review] = await db
    .select()
    .from(t.reviews)
    .where(and(eq(t.reviews.prId, input.prId), eq(t.reviews.model, 'seed'), isNull(t.reviews.runId)));
  if (!review) return;

  const { assembly } = assemblePrompt({
    system: input.agent.systemPrompt,
    task: "Review PR #482 'Add rate limiting to public API endpoints'",
    specs: [{ label: SEED_DOC_PATH, text: SEED_DOC }],
    diff: SEED_RUN_DIFF,
  });

  const [run] = await db
    .insert(t.agentRuns)
    .values({
      workspaceId: input.workspaceId,
      agentId: input.agent.id,
      prId: input.prId,
      provider: input.agent.provider,
      model: 'seed',
      durationMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: null,
      status: 'done',
      findingsCount: 2,
      grounding: '2/2 passed',
      score: review.score,
    })
    .returning();

  const trace: RunTrace = {
    config: {
      agent: input.agent.name,
      version: String(input.agent.version),
      provider: input.agent.provider,
      model: 'seed',
      pr: 482,
      source: 'local',
    },
    stats: {
      duration_ms: 0,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: null,
      findings: 2,
      grounding: '2/2 passed',
    },
    prompt_assembly: assembly,
    tool_calls: [],
    raw_output: '',
    memory_pulled: [],
    specs_read: [SEED_DOC_PATH],
    log: [
      { t: '00.00', kind: 'info', msg: 'Seeded run — no model was called' },
      { t: '00.00', kind: 'info', msg: `context doc: ${SEED_DOC_PATH} (${SEED_DOC.length} chars) → prompt` },
    ],
  };
  await db.insert(t.runTraces).values({ runId: run!.id, trace });
  await db.update(t.reviews).set({ runId: run!.id }).where(eq(t.reviews.id, review.id));
}

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  // ---- L02 skills (bodies in ./seed-skills.ts) ----
  // Same idempotency rule as the agents above: look up by (workspace_id, name),
  // insert only when absent.
  //
  // The matching `skill_versions` row at version 1 is written here too.
  // `SkillsRepository.insert` writes one for every skill created through the
  // API, and the seed bypasses the repository to write rows directly — so it
  // has to do the same, or a seeded skill opens with an empty version history
  // and the first body edit produces a v2 with no v1 behind it.
  const skillIds = new Map<string, string>();
  for (const s of SEED_SKILLS) {
    let [skill] = await db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, s.name)));
    if (!skill) {
      [skill] = await db
        .insert(t.skills)
        .values({
          workspaceId,
          name: s.name,
          description: s.description,
          type: s.type,
          source: 'manual',
          body: s.body,
          enabled: true,
          version: 1,
        })
        .returning();
      await db
        .insert(t.skillVersions)
        .values({ skillId: skill!.id, version: 1, body: s.body })
        .onConflictDoNothing();
    }
    skillIds.set(s.name, skill!.id);
  }

  /** Id of a skill seeded just above. Throws rather than linking `undefined`. */
  const skillId = (name: string): string => {
    const id = skillIds.get(name);
    if (!id) throw new Error(`seed: skill "${name}" is not in SEED_SKILLS`);
    return id;
  };

  // ---- Test Quality Reviewer (the L02 agent) ----
  // Its system prompt is deliberately general — the enumerable checks live in
  // the skills linked below, which is what makes attaching/detaching them
  // visible in a review.
  const TEST_QUALITY_REVIEWER_NAME = 'Test Quality Reviewer';
  let [testQuality] = await db
    .select()
    .from(t.agents)
    .where(
      and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, TEST_QUALITY_REVIEWER_NAME)),
    );
  if (!testQuality) {
    [testQuality] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: TEST_QUALITY_REVIEWER_NAME,
        description:
          'Reviews the tests in a diff, not the code: uncovered branches, missing corner cases, over-mocking, and flake-prone patterns.',
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        systemPrompt: TEST_QUALITY_REVIEWER_PROMPT,
        enabled: true,
        version: 1,
        createdBy: userId,
      })
      .returning();
  }

  // ---- skill links ----
  // `agent_skills.order` ascending is the order the bodies are read out into
  // the prompt, so these numbers ARE the prompt order: enumerate the branches,
  // then walk the corner cases, then judge the mocks.
  //
  // Order 3 is deliberately LEFT FREE. The fourth skill, `flake-patterns`, is
  // not seeded: it ships as `server/fixtures/skills/flake-patterns.zip` and is
  // brought in by hand through the import flow, which appends it at order 3.
  // Seeding it would remove the only end-to-end walk of the import path.
  await db
    .insert(t.agentSkills)
    .values(
      ['uncovered-branch-gate', 'corner-case-checklist', 'over-mocking-gate'].map(
        (name, order) => ({ agentId: testQuality!.id, skillId: skillId(name), order }),
      ),
    )
    .onConflictDoNothing();

  // `api-contract-gate` hangs off the EXISTING General Reviewer as well — one
  // skill row reachable from two agents, edited in one place. That reuse is a
  // requirement of its own, and it is also the second arm of the control
  // experiment (PR #484 runs on General Reviewer, not on Test Quality).
  const [generalReviewer] = await db
    .select()
    .from(t.agents)
    .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, 'General Reviewer')));
  if (generalReviewer) {
    await db
      .insert(t.agentSkills)
      .values({
        agentId: generalReviewer.id,
        skillId: skillId('api-contract-gate'),
        order: 0,
      })
      .onConflictDoNothing();
  }

  // ---- L05: a seeded run (+ trace) for PR #482's sample review ----
  // Gives the Run trace drawer one run whose prompt carried a project-context
  // document, with no model call, so the e2e can walk "Project context —
  // attached specs (untrusted)" on seeded data. Reached from PR #482 → Agent
  // runs tab → Run history → "Open run trace & logs" (`?trace=<runId>`).
  // It lives HERE, not inside the `if (!pr)` block above, because it needs the
  // General Reviewer's id and the agents are seeded after the PR. Idempotent:
  // only the sample review (model 'seed') that has no run yet gets one.
  if (generalReviewer) {
    await seedProjectContextRun(db, {
      workspaceId,
      prId: pr!.id,
      agent: generalReviewer,
    });
  }

  // ---- API Contract Reviewer (the L03 agent) ----
  // Seeded WITH its four skills and with PRs #485/#486 below, because those
  // fixtures' notes name this agent and these skills: seeding the PRs alone
  // leaves a demo pointing at an agent that is not in the picker.
  //
  // It runs on Anthropic rather than the shared openrouter default — that is
  // the pair the A/B recorded in seed-fixtures.ts was measured on, and the
  // contract reasoning is the kind of work the cheap default does worst.
  const API_CONTRACT_REVIEWER_NAME = 'API Contract Reviewer';
  let [apiContract] = await db
    .select()
    .from(t.agents)
    .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, API_CONTRACT_REVIEWER_NAME)));
  if (!apiContract) {
    [apiContract] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: API_CONTRACT_REVIEWER_NAME,
        description:
          'Flags changes that break an existing caller, or that make an endpoint disagree with its declared shape.',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        systemPrompt: API_CONTRACT_REVIEWER_PROMPT,
        enabled: true,
        version: 1,
        createdBy: userId,
      })
      .returning();
  }

  // Prompt order, worst-first: is it breaking at all, does the removal carry a
  // deprecation, does the response still match its schema, does the version
  // admit any of it.
  await db
    .insert(t.agentSkills)
    .values(
      ['breaking-change', 'deprecation-policy', 'response-schema', 'semver-discipline'].map(
        (name, order) => ({ agentId: apiContract!.id, skillId: skillId(name), order }),
      ),
    )
    .onConflictDoNothing();

  // ---- control-experiment fixture PRs (#483-#486) ----
  // Idempotent by (repo_id, number), like #482 above, and on the same
  // acme/payments-api repo. No review and no findings are seeded for these on
  // purpose: the point of the experiment is that the user runs the review
  // live — once with the skills detached, once with them attached — and reads
  // the two findings lists side by side. A pre-seeded review would answer the
  // question before it was asked.
  for (const fixture of FIXTURE_PULLS) {
    const [existingPull] = await db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, fixture.number)));
    if (existingPull) continue;

    const [fixturePr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: fixture.number,
        title: fixture.title,
        author: fixture.author,
        branch: fixture.branch,
        base: fixture.base,
        headSha: fixture.headSha,
        additions: fixture.files.reduce((n, f) => n + f.additions, 0),
        deletions: fixture.files.reduce((n, f) => n + f.deletions, 0),
        filesCount: fixture.files.length,
        status: 'needs_review',
        body: fixture.body,
      })
      .returning();

    // `patch` is load-bearing here. A seeded PR has no clone, so `loadDiff`
    // fails its `git diff` attempt and reconstructs the unified diff from these
    // rows; a fixture without patch text reviews an empty diff and the
    // experiment shows nothing. (PR #482 above has no patch and stays that way
    // — it is a list fixture, not a review fixture.)
    await db.insert(t.prFiles).values(
      fixture.files.map((f) => ({
        prId: fixturePr!.id,
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    );

    await db.insert(t.prCommits).values({
      prId: fixturePr!.id,
      sha: fixture.headSha,
      message: fixture.commitMessage,
      author: fixture.author,
    });
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
