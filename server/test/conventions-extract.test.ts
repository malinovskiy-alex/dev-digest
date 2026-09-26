import { describe, it, expect } from 'vitest';
import {
  collectSamples,
  renderSamples,
  toSample,
} from '../src/modules/conventions/sampling.js';
import { verifyCandidates } from '../src/modules/conventions/verify.js';
import {
  composeSkillDraft,
  evidenceRef,
  repoSlug,
  ruleSlug,
} from '../src/modules/conventions/skill-draft.js';
import { SAMPLE_LINE_CAP, type ExtractedConvention } from '../src/modules/conventions/constants.js';
import type { ConventionCandidate } from '@devdigest/shared';

/**
 * The three pure halves of the conventions extractor: what the model is allowed
 * to see (`sampling`), what it is allowed to have said (`verify`), and what the
 * survivors turn into (`skill-draft`). No DB, no model, no clone — which is the
 * point: everything that decides whether a card can be trusted is testable
 * without any of them.
 */

const USERS_TS = [
  "import { db } from '../db';", // 1
  '', // 2
  'export async function getUser(id: string) {', // 3
  '  const user = await db.users.find(id);', // 4
  '  const posts = await db.posts.findMany({ userId });', // 5
  '  return { user, posts };', // 6
  '}', // 7
].join('\n');

const files: Record<string, string> = {
  'package.json': '{ "name": "payments-api" }',
  'src/api/users.ts': USERS_TS,
};

const read = async (path: string) => files[path] ?? null;

describe('conventions · sampling (code only, no model)', () => {
  it('collects the config probes that exist and the ranked sources, in that order', async () => {
    const samples = await collectSamples(read, ['src/api/users.ts']);
    expect(samples.map((s) => s.path)).toEqual(['package.json', 'src/api/users.ts']);
  });

  it('skips missing and blank files instead of failing the scan', async () => {
    const samples = await collectSamples(read, ['src/does-not-exist.ts', 'src/api/users.ts']);
    expect(samples.map((s) => s.path)).not.toContain('src/does-not-exist.ts');
    expect(samples).toHaveLength(2);
  });

  it('never samples the same path twice, even when repo-intel ranks a config file', async () => {
    const samples = await collectSamples(read, ['package.json', 'src/api/users.ts']);
    expect(samples.map((s) => s.path)).toEqual(['package.json', 'src/api/users.ts']);
  });

  it('truncates a long file on a line boundary and says so', () => {
    const long = Array.from({ length: SAMPLE_LINE_CAP + 40 }, (_, i) => `line ${i + 1}`).join('\n');
    const sample = toSample('src/big.ts', long);
    expect(sample.lines).toHaveLength(SAMPLE_LINE_CAP);
    expect(sample.lines[SAMPLE_LINE_CAP - 1]).toBe(`line ${SAMPLE_LINE_CAP}`);
    expect(sample.truncated).toBe(true);
  });

  it('numbers every line from 1 so a cited line means what it says', async () => {
    const samples = await collectSamples(read, ['src/api/users.ts']);
    const rendered = renderSamples(samples);
    expect(rendered).toContain('--- src/api/users.ts ---');
    expect(rendered).toContain('4 |   const user = await db.users.find(id);');
  });
});

describe('conventions · the evidence gate', () => {
  const sample = toSample('src/api/users.ts', USERS_TS);

  const candidate = (over: Partial<ExtractedConvention> = {}): ExtractedConvention => ({
    category: 'async',
    rule: 'Always use async/await instead of .then() chains.',
    evidence_path: 'src/api/users.ts',
    evidence_start_line: 4,
    evidence_end_line: 5,
    evidence_snippet:
      '  const user = await db.users.find(id);\n  const posts = await db.posts.findMany({ userId });',
    confidence: 0.91,
    ...over,
  });

  it('keeps a candidate whose evidence is really in the file', () => {
    const [kept] = verifyCandidates([candidate()], [sample]);
    expect(kept).toMatchObject({
      evidencePath: 'src/api/users.ts',
      evidenceStartLine: 4,
      evidenceEndLine: 5,
      confidence: 0.91,
    });
  });

  it('drops a candidate citing a file that was never sampled', () => {
    expect(verifyCandidates([candidate({ evidence_path: 'src/api/ghost.ts' })], [sample])).toEqual(
      [],
    );
  });

  it('drops a candidate whose snippet is not in the file', () => {
    const invented = candidate({ evidence_snippet: '  const user = db.users.findSync(id);' });
    expect(verifyCandidates([invented], [sample])).toEqual([]);
  });

  it('corrects a drifted line number rather than dropping a true rule', () => {
    const [kept] = verifyCandidates(
      [candidate({ evidence_start_line: 17, evidence_end_line: 18 })],
      [sample],
    );
    expect(kept?.evidenceStartLine).toBe(4);
    expect(kept?.evidenceEndLine).toBe(5);
  });

  it('stores the file’s own bytes, not the model’s copy of them', () => {
    // Same lines, reformatted by the model — the stored snippet must be the file's.
    const reformatted = candidate({
      evidence_snippet:
        'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({userId});',
    });
    const [kept] = verifyCandidates([reformatted], [sample]);
    expect(kept?.evidenceSnippet).toBe(
      '  const user = await db.users.find(id);\n  const posts = await db.posts.findMany({ userId });',
    );
  });

  /**
   * Regression. `locate`'s last resort used to be "the first occurrence of the
   * snippet's FIRST line anywhere in the file", so a one-line snippet whose text
   * repeats (`}`, `});`, an import) was silently re-anchored near the top and
   * stored as verified — a true rule pinned to code that says nothing about it.
   * The claim below is >EVIDENCE_LINE_CAP lines from BOTH occurrences, so the
   * windowed search cannot help and that last resort is what decides.
   */
  describe('a claim that drifts past the search window', () => {
    const DECOY = "import { z } from 'zod';";
    const REAL = 'await db.transaction(async (tx) => {';
    const repeated = toSample(
      'src/x.ts',
      [
        DECOY, // 1 — the decoy
        'export const A = z.object({});', // 2
        ...Array.from({ length: 120 }, (_, i) => `const filler${i} = ${i};`), // 3..122
        DECOY, // 123 — where the quote really is
        REAL, // 124
      ].join('\n'),
    );

    const drifted = (snippet: string): ExtractedConvention => ({
      category: 'error-handling',
      rule: 'Multi-statement writes run inside one transaction.',
      evidence_path: 'src/x.ts',
      evidence_start_line: 60,
      evidence_end_line: 61,
      evidence_snippet: snippet,
      confidence: 0.9,
    });

    it('repairs it when a second anchor line confirms the match', () => {
      const [kept] = verifyCandidates([drifted(`${DECOY}\n${REAL}`)], [repeated]);
      expect(kept?.evidenceStartLine).toBe(123);
      expect(kept?.evidenceEndLine).toBe(124);
    });

    it('DROPS it when a one-line snippet could be either occurrence', () => {
      expect(verifyCandidates([drifted(DECOY)], [repeated])).toEqual([]);
    });

    it('still places a one-line snippet that occurs exactly once', () => {
      const [kept] = verifyCandidates([drifted(REAL)], [repeated]);
      expect(kept?.evidenceStartLine).toBe(124);
    });
  });

  it('collapses a repeated rule to its most confident evidence', () => {
    const kept = verifyCandidates(
      [candidate({ confidence: 0.4 }), candidate({ confidence: 0.95 })],
      [sample],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]?.confidence).toBe(0.95);
  });

  it('returns the most confident candidate first', () => {
    const kept = verifyCandidates(
      [
        candidate({ rule: 'Route handlers return a typed Result.', confidence: 0.6 }),
        candidate({ confidence: 0.91 }),
      ],
      [sample],
    );
    expect(kept.map((c) => c.confidence)).toEqual([0.91, 0.6]);
  });
});

describe('conventions · the skill draft', () => {
  const candidates: ConventionCandidate[] = [
    {
      id: 'c1',
      repo_id: 'r1',
      category: 'async',
      rule: 'Always use async/await instead of .then() chains.',
      evidence_path: 'src/api/users.ts',
      evidence_start_line: 4,
      evidence_end_line: 5,
      evidence_snippet: '  const user = await db.users.find(id);',
      confidence: 0.91,
      status: 'accepted',
      created_at: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'c2',
      repo_id: 'r1',
      category: 'structure',
      rule: 'Redis access goes through the src/lib/redis.ts singleton.',
      evidence_path: 'src/lib/redis.ts',
      evidence_start_line: 1,
      evidence_end_line: 1,
      evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
      confidence: 0.85,
      status: 'accepted',
      created_at: '2026-09-20T10:00:00.000Z',
    },
  ];

  it('proposes one fixed name, with the repo in the description', () => {
    // Fixed rather than derived: a reader looking for "the house rules skill"
    // finds the same name whichever repo produced it, and which repo that was
    // is in the description instead of encoded in an identifier.
    const draft = composeSkillDraft('acme/payments-api', candidates);
    expect(draft.name).toBe('repo-conventions');
    expect(draft.description).toContain('payments-api');
    expect(repoSlug('acme/payments-api')).toBe('payments-api');
  });

  it('writes a heading per rule and fences the evidence with the file’s language', () => {
    const draft = composeSkillDraft('acme/payments-api', candidates);
    expect(draft.body).toContain('# repo-conventions');
    expect(draft.body).toContain('## async-await-instead');
    expect(draft.body).toContain('Detected in `src/api/users.ts:4-5`:');
    expect(draft.body).toContain('```ts');
    expect(draft.body).toContain('export const redis = new Redis(config.redisUrl);');
  });

  it('carries the cited ids and files so the skill records its provenance', () => {
    const draft = composeSkillDraft('acme/payments-api', candidates);
    expect(draft.convention_ids).toEqual(['c1', 'c2']);
    expect(draft.evidence_files).toEqual(['src/api/users.ts', 'src/lib/redis.ts']);
    expect(draft.type).toBe('convention');
    expect(draft.description).toBe('2 house conventions extracted from payments-api');
  });

  it('reads a one-line evidence range as a single line', () => {
    expect(evidenceRef(candidates[1]!)).toBe('src/lib/redis.ts:1');
  });

  it('falls back to a slug when a rule is all stop-words', () => {
    expect(ruleSlug('The and for all')).toBe('rule');
  });

  it('counts one convention in the singular', () => {
    const draft = composeSkillDraft('acme/payments-api', [candidates[0]!]);
    expect(draft.description).toBe('1 house convention extracted from payments-api');
  });
});
