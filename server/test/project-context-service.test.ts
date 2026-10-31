/**
 * project-context — ProjectContextService with MockGitClient and stub deps (no
 * DB, no container), plus SimpleGitClient.listFilesAt over a real throwaway git
 * repo for the one thing a mock cannot show: symlinks and submodules drop out
 * of the tree, so the listing never sees them.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GitTreeFile } from '@devdigest/shared';
import { MockGitClient } from '../src/adapters/mocks.js';
import { SimpleGitClient } from '../src/adapters/git/simple-git.js';
import {
  ProjectContextService,
  type RepoLocator,
} from '../src/modules/project-context/service.js';
import { AppError, NotFoundError, ValidationError } from '../src/platform/errors.js';

const REPO: RepoLocator = { owner: 'acme', name: 'api', clonePath: '/mock/clones/acme/api' };
const UNCLONED: RepoLocator = { ...REPO, clonePath: null };

function makeService(
  git: MockGitClient | SimpleGitClient,
  opts: { repo?: RepoLocator; usage?: Map<string, number>; docGlobs?: readonly string[] } = {},
) {
  const getById = vi.fn(async (_ws: string, id: string) => (id === 'repo-1' ? (opts.repo ?? REPO) : undefined));
  const usage = vi.fn(async () => opts.usage ?? new Map<string, number>());
  const service = new ProjectContextService({ git, repos: { getById }, usage, docGlobs: opts.docGlobs });
  return { service, getById, usage };
}

const FILES: Record<string, string> = {
  'docs/README.md': '# Readme',
  'README.md': 'root readme — outside every search root (R-74)',
  'server/notes/x.md': 'outside every search root',
  'docs/security-baseline.md': 'sec',
  'specs/feature.md': 'feature spec',
  'src/index.ts': 'export {}',
  'notes.txt': 'not markdown',
  'node_modules/pkg/README.md': 'dependency readme',
  'packages/web/dist/out.md': 'build output',
};

describe('ProjectContextService.listDocs', () => {
  it('lists only non-excluded .md files, sorted, with category, tokens and used_by', async () => {
    const git = new MockGitClient({ files: FILES, head: 'abc1234' });
    const { service } = makeService(git, { usage: new Map([['docs/security-baseline.md', 2]]) });
    const list = await service.listDocs('ws', 'repo-1');

    expect(list.cloned).toBe(true);
    expect(list.sha).toBe('abc1234');
    expect(list.total).toBe(3);
    expect(list.capped).toBe(false);
    expect(list.docs.map((d) => d.path)).toEqual(['docs/README.md', 'docs/security-baseline.md', 'specs/feature.md']);
    const sec = list.docs[1]!;
    expect(sec).toMatchObject({ name: 'security-baseline.md', folder: 'docs', category: 'docs', chars: 3, used_by: 2 });
    expect(list.docs[0]).toMatchObject({ category: 'docs', folder: 'docs', used_by: 0 });
  });

  it('a .md outside specs/, docs/, insights/ is not listed, not readable and not_found in a prompt (R-74)', async () => {
    const git = new MockGitClient({ files: FILES, head: 'abc1234' });
    const { service } = makeService(git);
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs.map((d) => d.path)).not.toContain('README.md');
    expect(list.docs.map((d) => d.path)).not.toContain('server/notes/x.md');
    const err = await service.readDoc('ws', 'repo-1', 'README.md').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(404);
    const out = await service.resolveForPrompt(REPO, { agent: ['README.md', 'docs/README.md'], skills: [] });
    expect(out.docs.map((d) => d.path)).toEqual(['docs/README.md']);
    expect(out.skipped).toEqual([{ path: 'README.md', reason: 'not_found' }]);
  });

  it('nested search roots count, with the root folder as category (R-74, R-09)', async () => {
    const git = new MockGitClient({ files: { 'server/docs/a.md': 'a', 'client/specs/b/c.md': 'c', 'insights/i.md': 'i' } });
    const { service } = makeService(git);
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs.map((d) => [d.path, d.category])).toEqual([
      ['client/specs/b/c.md', 'specs'],
      ['insights/i.md', 'insights'],
      ['server/docs/a.md', 'docs'],
    ]);
  });

  it('configured globs replace the default (CONTEXT_DOC_GLOBS)', async () => {
    const git = new MockGitClient({ files: FILES });
    const { service } = makeService(git, { docGlobs: ['*.md'] });
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs.map((d) => d.path)).toEqual(['README.md']);
    expect(list.docs[0]).toMatchObject({ category: 'root' });
  });

  it('listing reads no blob: an unreadable entry stays listed with its tree size (F-14)', async () => {
    const tree: GitTreeFile[] = [
      { path: 'docs/a.md', size: 1 },
      { path: 'docs/gone.md', size: 4_000 },
    ];
    const git = new MockGitClient({ files: { 'docs/a.md': 'A' }, tree });
    const readFileAt = vi.spyOn(git, 'readFileAt');
    const { service } = makeService(git);
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs.map((d) => d.path)).toEqual(['docs/a.md', 'docs/gone.md']);
    expect(list.docs[1]).toMatchObject({ chars: 4_000, approx_tokens: 1_000 });
    expect(readFileAt).toHaveBeenCalledTimes(0);
  });

  it('a failed listFilesAt is not cached: the next call retries and succeeds (F-14)', async () => {
    const git = new MockGitClient({ files: FILES, head: 'abc1234' });
    const listFilesAt = vi.spyOn(git, 'listFilesAt').mockRejectedValueOnce(new Error('fatal: transient'));
    const { service } = makeService(git);
    await expect(service.listDocs('ws', 'repo-1')).rejects.toThrow('fatal: transient');
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.total).toBe(3);
    expect(listFilesAt).toHaveBeenCalledTimes(2);
  });

  it('an uncloned repo answers cloned:false and never touches git', async () => {
    const git = new MockGitClient({ files: FILES });
    const listFilesAt = vi.spyOn(git, 'listFilesAt');
    const { service } = makeService(git, { repo: UNCLONED });
    const list = await service.listDocs('ws', 'repo-1');
    expect(list).toMatchObject({ cloned: false, sha: null, total: 0, capped: false, docs: [] });
    expect(listFilesAt).not.toHaveBeenCalled();
  });

  it('an unknown repo is a NotFoundError', async () => {
    const { service } = makeService(new MockGitClient());
    await expect(service.listDocs('ws', 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists and reads at the sha from currentHead (R-64)', async () => {
    const git = new MockGitClient({ files: FILES, head: 'feedface' });
    const listFilesAt = vi.spyOn(git, 'listFilesAt');
    const readFileAt = vi.spyOn(git, 'readFileAt');
    const { service } = makeService(git);
    await service.listDocs('ws', 'repo-1');
    await service.readDoc('ws', 'repo-1', 'docs/README.md');
    expect(listFilesAt).toHaveBeenCalled();
    // MockGitClient.listFilesAt declares no params; the service passes (ref, sha)
    expect(listFilesAt.mock.calls.every((c) => (c as unknown[])[1] === 'feedface')).toBe(true);
    expect(readFileAt.mock.calls.length).toBeGreaterThan(0);
    expect(readFileAt.mock.calls.every((c) => c[1] === 'feedface')).toBe(true);
  });

  it('an unchanged sha is answered from cache; a moved HEAD re-lists (R-06)', async () => {
    const git = new MockGitClient({ files: FILES, head: 'aaaaaaa', syncedHead: 'bbbbbbb' });
    const listFilesAt = vi.spyOn(git, 'listFilesAt');
    const readFileAt = vi.spyOn(git, 'readFileAt');
    const { service } = makeService(git);

    await service.listDocs('ws', 'repo-1');
    expect(listFilesAt).toHaveBeenCalledTimes(1);
    await service.listDocs('ws', 'repo-1');
    expect(listFilesAt).toHaveBeenCalledTimes(1);
    // sizes come from the tree: listing never reads a blob (F-14)
    expect(readFileAt).toHaveBeenCalledTimes(0);

    await git.sync({ owner: 'acme', name: 'api' }, 'main'); // HEAD → bbbbbbb
    const again = await service.listDocs('ws', 'repo-1');
    expect(again.sha).toBe('bbbbbbb');
    expect(listFilesAt).toHaveBeenCalledTimes(2);
    expect((listFilesAt.mock.calls[1] as unknown[])[1]).toBe('bbbbbbb');
  });

  it('caps the list at 1,000 but the 1,001st doc stays readable and resolvable (D-REC5)', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i <= 1000; i++) files[`docs/d${String(i).padStart(4, '0')}.md`] = `doc ${i}`;
    const git = new MockGitClient({ files });
    const { service } = makeService(git);

    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs).toHaveLength(1000);
    expect(list.total).toBe(1001);
    expect(list.capped).toBe(true);
    expect(list.docs.some((d) => d.path === 'docs/d1000.md')).toBe(false);

    const content = await service.readDoc('ws', 'repo-1', 'docs/d1000.md');
    expect(content.content).toBe('doc 1000');
    const resolved = await service.resolveForPrompt(REPO, { agent: ['docs/d1000.md'], skills: [] });
    expect(resolved.docs.map((d) => d.path)).toEqual(['docs/d1000.md']);
    expect(resolved.skipped).toEqual([]);
  });
});

describe('ProjectContextService.readDoc', () => {
  it('returns content and sha for a doc at HEAD', async () => {
    const { service } = makeService(new MockGitClient({ files: FILES, head: 'abc1234' }));
    expect(await service.readDoc('ws', 'repo-1', 'specs/feature.md')).toEqual({
      path: 'specs/feature.md',
      sha: 'abc1234',
      content: 'feature spec',
      chars: 12,
    });
  });

  it.each(['../x.md', 'x.txt', 'node_modules/pkg/README.md', '/etc/passwd.md'])(
    'a bad path %j is a 422 ValidationError before any git call (R-16)',
    async (path) => {
      const git = new MockGitClient({ files: FILES });
      const readFileAt = vi.spyOn(git, 'readFileAt');
      const { service } = makeService(git);
      const err = await service.readDoc('ws', 'repo-1', path).catch((e) => e);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.statusCode).toBe(422);
      expect(readFileAt).not.toHaveBeenCalled();
    },
  );

  it('a valid path absent at HEAD is 404 context_doc_not_found, and git show is never run (R-14)', async () => {
    const git = new MockGitClient({ files: FILES });
    const readFileAt = vi.spyOn(git, 'readFileAt');
    const { service } = makeService(git);
    const err = await service.readDoc('ws', 'repo-1', 'docs/missing.md').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('context_doc_not_found');
    expect(readFileAt).not.toHaveBeenCalled();
  });

  it('a blob over 1 MiB is 413 context_doc_too_large, refused before git show (F-16)', async () => {
    const tree: GitTreeFile[] = [
      { path: 'docs/huge.md', size: 1_048_577 },
      { path: 'docs/edge.md', size: 1_048_576 },
    ];
    const git = new MockGitClient({ files: { 'docs/edge.md': 'edge' }, tree });
    const readFileAt = vi.spyOn(git, 'readFileAt');
    const { service } = makeService(git);
    const err = await service.readDoc('ws', 'repo-1', 'docs/huge.md').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe('context_doc_too_large');
    expect(readFileAt).not.toHaveBeenCalled();
    // exactly 1 MiB is still served
    expect((await service.readDoc('ws', 'repo-1', 'docs/edge.md')).content).toBe('edge');
    expect(readFileAt).toHaveBeenCalledTimes(1);
  });

  it('an uncloned repo is 409 context_not_cloned', async () => {
    const { service } = makeService(new MockGitClient({ files: FILES }), { repo: UNCLONED });
    const err = await service.readDoc('ws', 'repo-1', 'docs/README.md').catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('context_not_cloned');
  });
});

describe('ProjectContextService.resolveForPrompt', () => {
  it('resolves in merge order, deduplicated, with all three skip reasons and truncation', async () => {
    const big = 'b'.repeat(32_001);
    const tree: GitTreeFile[] = [
      { path: 'docs/agent.md', size: 1 },
      { path: 'docs/big.md', size: big.length },
      { path: 'docs/broken.md', size: 1 },
      { path: 'docs/skill.md', size: 1 },
    ];
    const git = new MockGitClient({
      files: { 'docs/agent.md': 'AGENT', 'docs/big.md': big, 'docs/skill.md': 'SKILL' },
      tree,
    });
    const { service } = makeService(git);
    const out = await service.resolveForPrompt(REPO, {
      agent: ['docs/agent.md', 'docs/big.md', 'docs/missing.md'],
      skills: [{ skillName: 'Sec', paths: ['docs/skill.md', 'docs/agent.md', 'docs/broken.md'] }],
    });

    expect(out.docs.map((d) => d.path)).toEqual(['docs/agent.md', 'docs/big.md', 'docs/skill.md']);
    expect(out.docs[0]).toEqual({ path: 'docs/agent.md', text: 'AGENT', chars: 5, truncated: false });
    const bigDoc = out.docs[1]!;
    expect(bigDoc.truncated).toBe(true);
    expect(bigDoc.chars).toBe(32_001);
    expect(bigDoc.text.startsWith('b'.repeat(32_000) + '\n\n[truncated:')).toBe(true);
    expect(out.skipped).toEqual([
      { path: 'docs/missing.md', reason: 'not_found' },
      { path: 'docs/broken.md', reason: 'read_error' },
    ]);
  });

  it('an uncloned repo skips every ref as not_cloned', async () => {
    const { service } = makeService(new MockGitClient({ files: FILES }));
    const out = await service.resolveForPrompt(UNCLONED, { agent: ['docs/README.md'], skills: [{ skillName: 's', paths: ['specs/feature.md'] }] });
    expect(out).toEqual({
      docs: [],
      skipped: [
        { path: 'docs/README.md', reason: 'not_cloned' },
        { path: 'specs/feature.md', reason: 'not_cloned' },
      ],
    });
  });

  it('a failing git tree read never throws: every ref is read_error', async () => {
    const git = new MockGitClient({ files: FILES });
    vi.spyOn(git, 'listFilesAt').mockRejectedValue(new Error('fatal: bad object'));
    const { service } = makeService(git);
    const out = await service.resolveForPrompt(REPO, { agent: ['docs/README.md'], skills: [] });
    expect(out).toEqual({ docs: [], skipped: [{ path: 'docs/README.md', reason: 'read_error' }] });
  });

  it('a failed readFileAt is read_error once and retried on the next call, not cached (F-14)', async () => {
    const git = new MockGitClient({ files: FILES });
    const readFileAt = vi.spyOn(git, 'readFileAt').mockRejectedValueOnce(new Error('fatal: transient'));
    const { service } = makeService(git);
    const refs = { agent: ['docs/README.md'], skills: [] };
    expect(await service.resolveForPrompt(REPO, refs)).toEqual({
      docs: [],
      skipped: [{ path: 'docs/README.md', reason: 'read_error' }],
    });
    const again = await service.resolveForPrompt(REPO, refs);
    expect(again.docs.map((d) => d.text)).toEqual(['# Readme']);
    expect(again.skipped).toEqual([]);
    expect(readFileAt).toHaveBeenCalledTimes(2);
  });

  it('a failed listFilesAt during resolve is retried on the next call, not cached (F-14)', async () => {
    const git = new MockGitClient({ files: FILES });
    const listFilesAt = vi.spyOn(git, 'listFilesAt').mockRejectedValueOnce(new Error('fatal: transient'));
    const { service } = makeService(git);
    const refs = { agent: ['docs/README.md'], skills: [] };
    expect((await service.resolveForPrompt(REPO, refs)).skipped).toEqual([{ path: 'docs/README.md', reason: 'read_error' }]);
    expect((await service.resolveForPrompt(REPO, refs)).docs.map((d) => d.path)).toEqual(['docs/README.md']);
    expect(listFilesAt).toHaveBeenCalledTimes(2);
  });

  it('no refs → nothing resolved and git untouched', async () => {
    const git = new MockGitClient({ files: FILES });
    const head = vi.spyOn(git, 'currentHead');
    const { service } = makeService(git);
    expect(await service.resolveForPrompt(REPO, { agent: [], skills: [] })).toEqual({ docs: [], skipped: [] });
    expect(head).not.toHaveBeenCalled();
  });
});

describe('SimpleGitClient.listFilesAt over a real repo', () => {
  let root: string;
  const git = (cwd: string, args: string[], input?: string) =>
    execFileSync('git', args, {
      cwd,
      input,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    }).trim();

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'ctx-docs-'));
    const repo = join(root, 'acme', 'api');
    mkdirSync(join(repo, 'docs'), { recursive: true });
    git(repo, ['init', '-q']);
    writeFileSync(join(repo, 'docs', 'real.md'), 'real doc');
    git(repo, ['add', 'docs/real.md']);
    // A symlink and a submodule, staged as index entries so no OS symlink support is needed.
    const linkBlob = git(repo, ['hash-object', '-w', '--stdin'], 'docs/real.md');
    git(repo, ['update-index', '--add', '--cacheinfo', `120000,${linkBlob},docs/link.md`]);
    git(repo, ['update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},vendored-sub.md`]);
    const tree = git(repo, ['write-tree']);
    const commit = git(repo, ['commit-tree', tree, '-m', 'init']);
    git(repo, ['update-ref', 'HEAD', commit]);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('drops the symlink and the submodule; the listing only sees the regular blob', async () => {
    const client = new SimpleGitClient(root);
    const ref = { owner: 'acme', name: 'api' };
    const sha = await client.currentHead(ref);
    expect(await client.listFilesAt(ref, sha)).toEqual([{ path: 'docs/real.md', size: 8 }]);

    const { service } = makeService(client, { repo: { ...ref, clonePath: join(root, 'acme', 'api') } });
    const list = await service.listDocs('ws', 'repo-1');
    expect(list.docs.map((d) => d.path)).toEqual(['docs/real.md']);
    const err = await service.readDoc('ws', 'repo-1', 'docs/link.md').catch((e) => e);
    expect(err.code).toBe('context_doc_not_found');
  });

  it('refuses an option-shaped sha', async () => {
    const client = new SimpleGitClient(root);
    await expect(client.listFilesAt({ owner: 'acme', name: 'api' }, '--output=x')).rejects.toThrow(/invalid sha/);
  });
});
