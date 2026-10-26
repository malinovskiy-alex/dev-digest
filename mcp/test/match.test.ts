import { describe, expect, it } from 'vitest';
import { ToolError } from '../src/errors.js';
import { matchAgent, matchPr, matchRepo, parseRepo, type PrLike } from '../src/match.js';

/** Run `fn`, expect a ToolError, and return it for further assertions. */
function toolError(fn: () => unknown): ToolError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ToolError);
    return err as ToolError;
  }
  throw new Error('expected a ToolError, nothing was thrown');
}

describe('parseRepo', () => {
  it('accepts owner/name with GitHub characters and trims whitespace', () => {
    expect(parseRepo('acme/api')).toEqual({ owner: 'acme', name: 'api', full_name: 'acme/api' });
    expect(parseRepo('  My-Org_1/repo.js-2  ')).toEqual({
      owner: 'My-Org_1',
      name: 'repo.js-2',
      full_name: 'My-Org_1/repo.js-2',
    });
  });

  it.each(['acme', 'acme/api/extra', '/api', 'acme/', 'https://github.com/acme/api', 'acme api', ''])(
    'rejects %j with the expected format and an example',
    (input) => {
      const e = toolError(() => parseRepo(input));
      expect(e.code).toBe('bad_repo');
      expect(e.message).toContain('owner/name');
      expect(e.message).toContain('repo="acme/api"');
    },
  );
});

describe('matchRepo', () => {
  const repos = [
    { id: 'r1', full_name: 'acme/api' },
    { id: 'r2', full_name: 'acme/Web' },
  ];

  it('matches full_name case-insensitively', () => {
    expect(matchRepo(repos, parseRepo('ACME/API')).id).toBe('r1');
    expect(matchRepo(repos, parseRepo('acme/web')).id).toBe('r2');
  });

  it('a miss says "Add it in the UI" and lists at most 10 imported names', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ id: `r${i}`, full_name: `org/repo-${i}` }));
    const e = toolError(() => matchRepo(many, parseRepo('acme/missing')));
    expect(e.code).toBe('repo_not_found');
    expect(e.message).toContain('Add it in the UI');
    expect(e.message).toContain('org/repo-0');
    expect(e.message).toContain('org/repo-9');
    expect(e.message).not.toContain('org/repo-10');
    expect(e.message).toContain('(+3 more)');
  });

  it('a miss with nothing imported still says to add it in the UI', () => {
    const e = toolError(() => matchRepo([], parseRepo('acme/api')));
    expect(e.code).toBe('repo_not_found');
    expect(e.message).toMatch(/Add it in the UI/);
  });
});

describe('matchPr', () => {
  it('matches on number', () => {
    const pulls = [
      { id: 'p1', number: 1 },
      { id: 'p42', number: 42 },
    ];
    expect(matchPr(pulls, 42, 'acme/api').id).toBe('p42');
  });

  it('a missing PR — or one the API has not persisted (no id) — names the 50-PR sync limit and the GitHub token', () => {
    const cases: PrLike[][] = [[{ id: 'p1', number: 1 }], [{ id: null, number: 42 }], [{ id: '', number: 42 }]];
    for (const pulls of cases) {
      const e = toolError(() => matchPr(pulls, 42, 'acme/api'));
      expect(e.code).toBe('pr_not_found');
      expect(e.message).toContain('#42');
      expect(e.message).toContain('50 most recent PRs');
      expect(e.message).toContain('GitHub token');
    }
  });
});

describe('matchAgent', () => {
  it('an id match wins over a name match', () => {
    // agent B is *named* like agent A's id
    const agents = [
      { id: 'aaa', name: 'security' },
      { id: 'bbb', name: 'aaa' },
    ];
    expect(matchAgent(agents, 'aaa').id).toBe('aaa');
  });

  it('matches an exact name case-insensitively, trimmed', () => {
    const agents = [
      { id: 'a1', name: 'Security' },
      { id: 'a2', name: 'Security Plus' },
    ];
    expect(matchAgent(agents, ' security ').id).toBe('a1');
  });

  it('an ambiguous name lists the matching ids and asks for the id', () => {
    const agents = [
      { id: 'a1', name: 'perf' },
      { id: 'a2', name: 'PERF' },
      { id: 'a3', name: 'other' },
    ];
    const e = toolError(() => matchAgent(agents, 'perf'));
    expect(e.code).toBe('agent_ambiguous');
    expect(e.message).toContain('a1');
    expect(e.message).toContain('a2');
    expect(e.message).not.toContain('a3');
    expect(e.message).toContain('pass the id instead');
  });

  it('an unknown agent (no partial match) points at list_agents', () => {
    const e = toolError(() => matchAgent([{ id: 'a1', name: 'security' }], 'secur'));
    expect(e.code).toBe('agent_unknown');
    expect(e.message).toContain('list_agents');
  });
});
