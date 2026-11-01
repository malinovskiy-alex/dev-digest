/**
 * Onboarding Tour (L05) — the gate between the model's answer and the stored
 * tour (plan step 25).
 *
 * Expected values come from AC-31, AC-33, AC-36, AC-41, AC-49, AC-50, AC-54 …
 * AC-56, AC-61, AC-72, AC-85, AC-88 and D-10, D-11, D-13, D-20, D-26. The code
 * is only the seam (`grounding/helpers.ts`, plus `generatedSections` for the
 * end-to-end path check of AC-61).
 */
import { describe, it, expect } from 'vitest';
import {
  buildKnownSet,
  buildRefSet,
  classifyGenerationError,
  groundComponents,
  groundTasks,
  mergeReasons,
  orderCommands,
  scrubProse,
  type ModelComponent,
} from '../src/modules/onboarding/grounding/helpers.js';
import { generatedSections } from '../src/modules/onboarding/helpers.js';
import type { TourNarrative } from '../src/modules/onboarding/schema.js';
import type { TourFileRow } from '@devdigest/shared';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import { TimeoutError } from '../src/platform/resilience.js';
import { ConfigError, ExternalServiceError } from '../src/platform/errors.js';
import { z } from 'zod';
import { makeFacts, prCandidate, todoCandidate } from './helpers/onboarding-facts.js';

const comp = (id: string, ref: string, kind: ModelComponent['kind'] = 'service'): ModelComponent => ({ id, label: id, kind, ref });
const row = (path: string): TourFileRow => ({ path, reason: null, importers: 1, top_percent: 10 });

describe('diagram grounding (AC-33, AC-85, D-11)', () => {
  const refs = buildRefSet({
    indexedPaths: ['src/server.ts', 'web/app.tsx'],
    folders: ['src', 'web'],
    deps: ['pg', 'fastify'],
  });

  it('AC-33 — an unknown ref is dropped with every connection naming it; a dependency ref survives', () => {
    const out = groundComponents(
      [comp('api', 'src/server.ts'), comp('db', 'pg', 'data'), comp('ghost', 'src/ghost.ts'), comp('ui', 'web')],
      [
        { from: 'api', to: 'db' },
        { from: 'api', to: 'ghost' },
        { from: 'ghost', to: 'db' },
        { from: 'ui', to: 'api' },
      ],
      refs,
    );
    expect(out.components.map((c) => c.id)).toEqual(['api', 'db', 'ui']);
    expect(out.connections).toEqual([
      { from: 'api', to: 'db' },
      { from: 'ui', to: 'api' },
    ]);
  });

  it('AC-33 — tree-only files (Dockerfile, docker-compose.yml) are not references', () => {
    const out = groundComponents(
      [comp('api', 'src/server.ts'), comp('docker', 'Dockerfile'), comp('compose', 'docker-compose.yml'), comp('db', 'pg')],
      [
        { from: 'api', to: 'docker' },
        { from: 'compose', to: 'db' },
        { from: 'api', to: 'db' },
      ],
      refs,
    );
    expect(out.components.map((c) => c.id)).toEqual(['api', 'db']);
    expect(out.connections).toEqual([{ from: 'api', to: 'db' }]);
  });

  it('AC-33 — a `postgres` component with ref `pg` survives; matching is case-insensitive and ignores a trailing /', () => {
    const out = groundComponents(
      [comp('postgres', 'pg', 'data'), comp('web', 'WEB/'), comp('api', 'Src/Server.ts')],
      [
        { from: 'web', to: 'api' },
        { from: 'api', to: 'postgres' },
      ],
      refs,
    );
    expect(out.components.map((c) => c.id)).toEqual(['postgres', 'web', 'api']);
    expect(out.connections).toHaveLength(2);
  });

  it('AC-85 — one surviving component → no diagram at all', () => {
    expect(groundComponents([comp('api', 'src/server.ts'), comp('x', 'nope')], [{ from: 'api', to: 'x' }], refs)).toEqual({
      components: [],
      connections: [],
    });
  });

  it('AC-85 — components but no surviving connection → no diagram at all', () => {
    expect(groundComponents([comp('api', 'src/server.ts'), comp('db', 'pg')], [], refs)).toEqual({ components: [], connections: [] });
  });
});

describe('row reasons (AC-36, AC-49, AC-50, D-13)', () => {
  it('AC-36 — a reason for a listed path fills that row; an unlisted path is ignored; others stay null', () => {
    const rows = mergeReasons(
      [row('a'), row('b'), row('c')],
      [
        { path: 'b', text: 'the router' },
        { path: 'zzz', text: 'invented' },
      ],
      { ordered: false },
    );
    expect(rows.map((r) => [r.path, r.reason])).toEqual([
      ['a', null],
      ['b', 'the router'],
      ['c', null],
    ]);
  });

  it('AC-49, AC-50 — ranked order and set stay; out-of-order and unknown entries are ignored', () => {
    const rows = mergeReasons(
      [row('a'), row('b'), row('c'), row('d')],
      [
        { path: 'b', text: 'wb' },
        { path: 'a', text: 'wa' },
        { path: 'x', text: 'wx' },
        { path: 'd', text: 'wd' },
      ],
      { ordered: true },
    );
    expect(rows.map((r) => [r.path, r.reason])).toEqual([
      ['a', null],
      ['b', 'wb'],
      ['c', null],
      ['d', 'wd'],
    ]);
  });
});

describe('commands (AC-41, AC-88, D-10)', () => {
  const derived = [1, 2, 3, 4].map((n) => ({ id: `cmd-${n}`, command: `derived command ${n}` }));

  it('AC-41, AC-88 — unknown ids dropped; omitted commands appended in derivation order with no comment', () => {
    const out = orderCommands(derived, [
      { id: 'cmd-3', comment: 'c3' },
      { id: 'cmd-9', comment: 'zz' },
      { id: 'cmd-1', comment: 'c1' },
    ]);
    expect(out).toEqual([
      { step: 1, command: 'derived command 3', comment: 'c3' },
      { step: 2, command: 'derived command 1', comment: 'c1' },
      { step: 3, command: 'derived command 2', comment: null },
      { step: 4, command: 'derived command 4', comment: null },
    ]);
    // no row's command text is model-written
    expect(out.every((r) => derived.some((d) => d.command === r.command))).toBe(true);
    expect(JSON.stringify(out)).not.toContain('zz');
  });

  it('AC-88 — model [] → every derived command in derivation order, all comments null', () => {
    expect(orderCommands(derived, [])).toEqual(derived.map((d, i) => ({ step: i + 1, command: d.command, comment: null })));
  });

  it('AC-41 — a repeated id keeps its first position only', () => {
    const out = orderCommands(derived, [
      { id: 'cmd-2', comment: 'first' },
      { id: 'cmd-2', comment: 'again' },
    ]);
    expect(out.map((r) => [r.command, r.comment])).toEqual([
      ['derived command 2', 'first'],
      ['derived command 1', null],
      ['derived command 3', null],
      ['derived command 4', null],
    ]);
  });
});

describe('tasks (AC-54, AC-55, AC-56, D-19)', () => {
  const candidates = [
    todoCandidate('src/a.ts', 1),
    todoCandidate('src/a.ts', 2),
    todoCandidate('src/b.ts', 3),
    todoCandidate('src/c.ts', 4),
    todoCandidate('src/d.ts', 5),
    todoCandidate('src/e.ts', 6),
    prCandidate(7, 'Fix login'),
  ];
  const t = (candidate_id: string) => ({ candidate_id, title: `T ${candidate_id}`, reason: 'r' });

  it('AC-54, AC-55 — unknown, missing and reused ids are dropped; 7 valid → 5', () => {
    const out = groundTasks(candidates, [
      t('todo:src/a.ts:1'),
      t('nope'),
      t(''),
      t('todo:src/a.ts:1'),
      t('todo:src/a.ts:2'),
      t('todo:src/b.ts:3'),
      t('todo:src/c.ts:4'),
      t('todo:src/d.ts:5'),
      t('todo:src/e.ts:6'),
      t('open-pr:7'),
    ]);
    expect(out).toHaveLength(5);
    expect(out.every((x) => x.source === 'model')).toBe(true);
    expect(out.map((x) => x.candidate_id)).toEqual([
      'todo:src/a.ts:1',
      'todo:src/a.ts:2',
      'todo:src/b.ts:3',
      'todo:src/c.ts:4',
      'todo:src/d.ts:5',
    ]);
  });

  it('AC-56 — 2 valid model tasks → the top 5 candidates as fallback tasks', () => {
    const out = groundTasks(candidates, [t('todo:src/a.ts:1'), t('open-pr:7')]);
    expect(out.map((x) => [x.candidate_id, x.source, x.title])).toEqual(
      candidates.slice(0, 5).map((c) => [c.id, 'fallback', null]),
    );
  });

  it('AC-56 — 0 candidates → []', () => {
    expect(groundTasks([], [t('todo:src/a.ts:1')])).toEqual([]);
  });
});

describe('prose scrub (AC-31, AC-61, D-26)', () => {
  const known = buildKnownSet({ treePaths: ['src/my_file.ts', 'src/__init__.py', 'docs/guide.md'], indexedPaths: [] });

  it('AC-61 — an unknown path in code is removed', () => {
    const out = scrubProse('Start at `src/ghost.ts` today.', known);
    expect(out).not.toContain('src/ghost.ts');
  });

  it('AC-61 — a relative link to an unknown file becomes its text', () => {
    const out = scrubProse('Read [see](docs/ghost.md) first.', known);
    expect(out).toContain('see');
    expect(out).not.toContain('docs/ghost.md');
    expect(out).not.toContain('](');
  });

  it('AC-31 — a bare known path is wrapped in backticks, underscores intact', () => {
    expect(scrubProse('Open src/my_file.ts now.', known)).toContain('`src/my_file.ts`');
  });

  it('AC-31 — a known path in code keeps both underscores', () => {
    expect(scrubProse('See `src/__init__.py`.', known)).toContain('`src/__init__.py`');
  });

  it('D-26 (3) — an absolute http(s) link becomes its text, no URL left in a link', () => {
    const out = scrubProse('Please [login](https://evil.example/x) here.', known);
    expect(out).toContain('login');
    expect(out).not.toMatch(/\]\(https?:/);
  });
});

describe('structured paths come from the facts (AC-61)', () => {
  it('AC-61 — a model task naming src/ghost.ts links only to its candidate path; no row path outside the facts', () => {
    const facts = makeFacts({
      treePaths: ['src/a.ts', 'src/b.ts'],
      indexed: [
        { path: 'src/a.ts', rank: 1, percentile: 99, importers: 2 },
        { path: 'src/b.ts', rank: 0.5, percentile: 50, importers: 1 },
      ],
      readingPaths: ['src/a.ts', 'src/b.ts'],
      chains: [['src/a.ts', 'src/b.ts']],
    });
    const candidates = [todoCandidate('src/a.ts', 1), todoCandidate('src/a.ts', 2), todoCandidate('src/b.ts', 3)];
    const narrative: TourNarrative = {
      architecture: { prose: 'See `src/ghost.ts`.', components: [], connections: [] },
      critical_paths: [{ path: 'src/ghost.ts', reason: 'x' }],
      commands: [],
      reading_path: [{ path: 'src/ghost.ts', why: 'x' }],
      tasks: candidates.map((c) => ({ candidate_id: c.id, title: 'Rewrite src/ghost.ts', reason: 'see src/ghost.ts' })),
    };
    const s = generatedSections(facts, candidates, narrative);
    const allowed = new Set(['src/a.ts', 'src/b.ts']);
    expect(s.first_tasks.tasks.map((t) => t.path)).toEqual(['src/a.ts', 'src/a.ts', 'src/b.ts']);
    for (const r of [...s.critical_paths.rows, ...s.reading_path.rows]) expect(allowed.has(r.path)).toBe(true);
    expect(s.architecture.prose ?? '').not.toContain('src/ghost.ts');
  });
});

describe('failure classification (AC-72, D-20)', () => {
  it('AC-72 — the OpenRouter schema message → invalid_output with the fixed message', () => {
    expect(classifyGenerationError(new Error('OpenRouter structured output failed schema validation for OnboardingTour'))).toEqual({
      code: 'invalid_output',
      message: 'the model returned invalid output',
    });
  });

  it('AC-72 — the OpenAI and Anthropic adapter errors → invalid_output', () => {
    // the errors the adapters throw (`openai.ts:132`, `anthropic.ts:232`)
    for (const msg of ['OpenAI structured output failed schema validation', 'Anthropic structured output failed schema validation']) {
      expect(classifyGenerationError(new ExternalServiceError(msg, {}))).toEqual({
        code: 'invalid_output',
        message: 'the model returned invalid output',
      });
    }
  });

  it('AC-72 — the MockLLMProvider schema failure → invalid_output', async () => {
    const err = await new MockLLMProvider('openai', { structured: { nope: 1 } })
      .completeStructured({ model: 'm', schema: z.object({ a: z.string() }), schemaName: 'X', messages: [] })
      .catch((e: unknown) => e);
    expect(classifyGenerationError(err)).toEqual({ code: 'invalid_output', message: 'the model returned invalid output' });
  });

  it('D-20 — TimeoutError → timeout, ConfigError → no_api_key', () => {
    expect(classifyGenerationError(new TimeoutError(50)).code).toBe('timeout');
    expect(classifyGenerationError(new ConfigError('OPENROUTER_API_KEY is not configured')).code).toBe('no_api_key');
  });

  it('D-20 — anything else → provider_error with the message', () => {
    const out = classifyGenerationError(new Error('OpenRouter returned no choices for OnboardingTour: quota'));
    expect(out.code).toBe('provider_error');
    expect(out.message).toContain('OpenRouter returned no choices');
    expect(classifyGenerationError('weird').code).toBe('provider_error');
  });
});

// ---------------------------------------------------------------------------
// Regression F-17 (D-26 (3), AC-61, AC-62): GFM turns more than `[t](http…)`
// into a link — `www.` and email autolinks, `<scheme:…>` autolinks, and
// reference-style links whose definition sits elsewhere in the prose. None of
// them may survive the scrub as a clickable external link.
// ---------------------------------------------------------------------------

/** The prose with every code span removed: what GFM could still turn into a link. */
const outsideCode = (s: string) => s.replace(/```[\s\S]*?```|`[^`\n]+`/g, '');

function expectNoExternalLink(out: string) {
  const plain = outsideCode(out);
  expect(plain, out).not.toMatch(/www\./i); // www. autolink
  expect(plain, out).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]/); // email autolink
  expect(plain, out).not.toMatch(/<[a-z][a-z0-9+.-]*:/i); // <scheme:…> autolink
  expect(plain, out).not.toMatch(/https?:/i); // any http(s) URL
  expect(plain, out).not.toMatch(/\]\(/); // inline link
  expect(plain, out).not.toMatch(/^ {0,3}\[[^\]^][^\]]*\]:/m); // reference definition
  expect(plain, out).not.toContain('evil.example');
}

describe('regression F-17 — no clickable external link of any GFM kind (D-26, AC-61)', () => {
  const known = buildKnownSet({ treePaths: ['src/my_file.ts', 'docs/guide.md'], indexedPaths: [] });

  it.each([
    ['www. autolink', 'Log in at www.evil.example/login today.'],
    ['email autolink', 'Mail admin@evil.example for access.'],
    ['<mailto:…> autolink', 'Write to <mailto:admin@evil.example> now.'],
    ['<https://…> autolink', 'See <https://evil.example/x> now.'],
    ['<javascript:…> autolink', 'Click <javascript:alert(1)> here.'],
  ])('F-17 — %s', (_kind, prose) => {
    expectNoExternalLink(scrubProse(prose, known));
  });

  it('F-30, F-34 — a reference-style link and its definitions are neutralised by insertion only: `\\[`, URL in code or not an autolink', () => {
    const prose = ['Please [log in here][a] and read [b].', '', '[a]: https:evil.example', '[b]:', '  https://evil.example/b "t"'].join('\n');
    const out = scrubProse(prose, known);
    // nothing deleted (F-30): the output is the input plus inserted `\` / backticks
    expectInsertionsOnly(prose, out);
    const lines = out.split('\n');
    // each definition line now starts with `\[`: no definition, so [t][a] / [b] have no target
    expect(lines[2]).toBe('\\[a]: https:evil.example'); // `https:` without `//` is no GFM autolink: inert plain text
    expect(lines[3]).toBe('\\[b]:');
    expect(lines[4]).toBe('  `https://evil.example/b` "t"'); // an autolink literal → code
    expect(lines[0]).toBe('Please [log in here][a] and read [b].'); // the visible text is kept
    expect(outsideCode(out)).not.toMatch(/https?:\/\//i);
  });

  it('F-17 — recoverability: ordinary prose with code spans, known paths and no links is unchanged', () => {
    const prose = [
      'Run `pnpm test` before you push; the `--watch` flag helps.',
      'Requests enter at `src/my_file.ts`, then see `docs/guide.md` and/or the `user@example.com` sample.',
      '',
      '1. Install with `pnpm install`.',
      '2. Version 1.2.3 is the minimum, e.g. on Node 22.',
      '',
      '```sh',
      'curl https://example.com/health',
      '```',
    ].join('\n');
    expect(scrubProse(prose, known)).toBe(prose);
  });
});

// ---------------------------------------------------------------------------
// Round 3 (F-30, F-31). reviewer-core/INSIGHTS.md: an escape must be
// insertion-only. The scrub may insert a `\` before a `[` and backticks; on
// this corpus — which holds no unknown path in code, no inline link and no
// `<scheme:…>` autolink, the deliberate removals of D-26 (1)/(2) and F-31 — it
// may do nothing else.
// ---------------------------------------------------------------------------

/**
 * `out` is `input` with only `\` (right before a `[`) and backtick characters
 * inserted, in order: undoing those insertions gives the input byte-for-byte.
 */
function expectInsertionsOnly(input: string, out: string) {
  let i = 0;
  for (let o = 0; o < out.length; o += 1) {
    if (i < input.length && out[o] === input[i]) {
      i += 1;
    } else if (out[o] !== '`' && !(out[o] === '\\' && out[o + 1] === '[')) {
      throw new Error(
        `not insertion-only at output offset ${o}\ninput:  ${JSON.stringify(input)}\noutput: ${JSON.stringify(out)}`,
      );
    }
  }
  expect(input.slice(i), `input chars lost\noutput: ${JSON.stringify(out)}`).toBe('');
}

describe('round-trip — scrubProse escapes are insertion-only (F-30, reviewer-core INSIGHTS)', () => {
  const known = buildKnownSet({ treePaths: ['src/my_file.ts', 'docs/guide.md'], indexedPaths: [] });

  const corpus = [
    'Requests enter at src/my_file.ts and leave through docs/guide.md.',
    '[TODO]: fix this later',
    'Note:\n[TODO]: fix this later\n- and [this] too',
    'use `x` [a]: https://e',
    'Run `pnpm test` first; `--watch` helps.\n\n1. one\n2. two\n   - nested `src/my_file.ts`',
    "[a]: https://evil.example\n[b]: https://evil.example/b \"title\"\n   [c]: www.evil.example 't'\n[^1]: a footnote",
    'Read [x][a] and [y].\n\n[a]:\n  https://evil.example/a\n(paren title)',
    'See https://e.example/x). Then (https://e.example/y), "https://e.example/z"* and www.e.example.',
    '**https://e.example/bold** and ~https://e.example/strike~ and _https://e.example/em_',
    '<x:https://e>',
    'Mail admin@e.example, or see e.g. 1.2.3.',
    '```sh\ncurl https://e.example/health\n[a]: https://e\n```\nafter the fence',
  ];

  it.each(corpus.map((c) => [c]))('F-30 — insertion-only on %j', (prose) => {
    expectInsertionsOnly(prose, scrubProse(prose, known));
  });

  it('F-30 — the definitions of the corpus are escaped; `[^1]:` and fenced code are not', () => {
    const out = scrubProse(corpus[5]!, known).split('\n');
    expect(out[0]!.startsWith('\\[a]:')).toBe(true);
    expect(out[1]!.startsWith('\\[b]:')).toBe(true);
    expect(out[2]!.startsWith('   \\[c]:')).toBe(true);
    expect(out[3]).toBe('[^1]: a footnote');
    expect(scrubProse(corpus[11]!, known)).toBe(corpus[11]);
  });

  it('F-30 — `[TODO]: fix this later` and a mid-line `[a]:` after a code span are not definitions: no `\\[` inserted', () => {
    expect(scrubProse('[TODO]: fix this later', known)).toBe('[TODO]: fix this later');
    expect(scrubProse('Note:\n[TODO]: fix this later', known)).toBe('Note:\n[TODO]: fix this later');
    // `[a]:` follows a code span on its line, so it is no definition and keeps
    // its `[`. The bare `https://e` IS a GFM autolink literal (remark-gfm
    // renders <a href="https://e">), so per F-17 backticks are added around it.
    expect(scrubProse('use `x` [a]: https://e', known)).toBe('use `x` [a]: `https://e`');
  });

  it('F-31 — trailing punctuation stays outside the code span; `<x:https://e>` keeps its `>`', () => {
    expect(scrubProse('See https://e.example/x). Then (https://e.example/y), "https://e.example/z"*', known)).toBe(
      'See `https://e.example/x`). Then (`https://e.example/y`), "`https://e.example/z`"*',
    );
    // `_https://…_` is not here: `\b` sees no boundary after `_`, so the server
    // leaves it alone — one of the F-29 bypasses the client's inertLinks covers.
    expect(scrubProse('**https://e.example/b** and ~https://e.example/s~', known)).toBe(
      '**`https://e.example/b`** and ~`https://e.example/s`~',
    );
    expect(scrubProse('Go to www.e.example.', known)).toBe('Go to `www.e.example`.');
    // a one-letter scheme is no CommonMark autolink (2–32 chars): `<` and `>` stay
    expect(scrubProse('<x:https://e>', known)).toBe('<x:`https://e`>');
    // a real angle autolink loses both brackets together, never only one
    expect(scrubProse('See <https://e.example/x> now.', known)).toBe('See `https://e.example/x` now.');
  });
});
