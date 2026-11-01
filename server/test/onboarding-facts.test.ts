/**
 * Onboarding Tour (L05) — the deterministic fact builders (plan step 23).
 *
 * Expected values come from the acceptance criteria in
 * `specs/L05-onboarding-generator.requirements.md` and the plan's D-n decisions;
 * the code is only the seam (`facts/helpers.ts`, Ring 1, pure). Each `it` names
 * the AC it proves.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveCommands,
  detectStack,
  envExampleNames,
  excerpt,
  manifestPaths,
  isTestPath,
  missingTestCandidates,
  openPrCandidates,
  orderCandidates,
  parseManifest,
  pickSubManifestDirs,
  readingRows,
  criticalRows,
  scanTodos,
  topLevelFolders,
  type IndexedFile,
  type ManifestFact,
  type OpenPull,
  type TaskCandidate,
} from '../src/modules/onboarding/facts/helpers.js';
import { EXCLUDED_DIRS as ONBOARDING_EXCLUDED_DIRS } from '../src/modules/onboarding/constants.js';
import { EXCLUDED_DIRS as REPO_INTEL_EXCLUDED_DIRS } from '../src/modules/repo-intel/constants.js';

const manifest = (dir: string, json: unknown): Pick<ManifestFact, 'dir' | 'parsed'> => ({
  dir,
  parsed: parseManifest(JSON.stringify(json)),
});

const commandsOf = (treePaths: string[], manifests: Array<Pick<ManifestFact, 'dir' | 'parsed'>>) =>
  deriveCommands({ treePaths, manifests }).map((c) => c.command);

const ALLOW_LIST = ['dev', 'start', 'serve', 'build', 'test', 'migrate', 'db:migrate', 'seed', 'db:seed'];

function shuffled<T>(xs: T[], seed: number): T[] {
  const out = [...xs];
  let s = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('run commands (AC-40, AC-45, AC-88, D-7, D-9)', () => {
  it('AC-40, AC-88 — derivation order: env copy, compose, install, allow-listed scripts in allow-list order', () => {
    const tree = ['pnpm-lock.yaml', 'package.json', '.env.example', 'docker-compose.yml'];
    const scripts = {
      'db:seed': 'x',
      test: 'x',
      serve: 'x',
      dev: 'x',
      lint: 'x',
      typecheck: 'x',
      setup: 'x',
      'dev:api': 'x',
      release: 'x',
    };
    const derived = deriveCommands({ treePaths: tree, manifests: [manifest('', { scripts })] });
    expect(derived.map((c) => c.command)).toEqual([
      'cp .env.example .env',
      'docker compose up -d',
      'pnpm install',
      'pnpm run dev',
      'pnpm run serve',
      'pnpm run test',
      'pnpm run db:seed',
    ]);
    // ids are cmd-1 … cmd-n in derivation order (D-9)
    expect(derived.map((c) => c.id)).toEqual(['cmd-1', 'cmd-2', 'cmd-3', 'cmd-4', 'cmd-5', 'cmd-6', 'cmd-7']);
    const all = derived.map((c) => c.command).join('\n');
    for (const notAllowed of ['lint', 'typecheck', 'setup', 'dev:api', 'release']) {
      expect(all).not.toContain(`run ${notAllowed}`);
    }
  });

  it('AC-40 — every allow-list script name becomes a command when declared', () => {
    const scripts = Object.fromEntries(ALLOW_LIST.map((s) => [s, 'echo']));
    expect(commandsOf(['package.json', 'pnpm-lock.yaml'], [manifest('', { scripts })])).toEqual([
      'pnpm install',
      ...ALLOW_LIST.map((s) => `pnpm run ${s}`),
    ]);
  });

  it('AC-40, D-7 — the lockfile names the package manager', () => {
    const m = [manifest('', { scripts: { dev: 'x' } })];
    expect(commandsOf(['package.json', 'package-lock.json'], m)).toEqual(['npm ci', 'npm run dev']);
    expect(commandsOf(['package.json', 'yarn.lock'], m)).toEqual(['yarn install', 'yarn run dev']);
    expect(commandsOf(['package.json', 'bun.lock'], m)).toEqual(['bun install', 'bun run dev']);
  });

  it('AC-40, D-7 — no lockfile → no install command, scripts use npm run, packageManager ignored', () => {
    const m = [manifest('', { packageManager: 'pnpm@9.0.0', scripts: { dev: 'x', test: 'y' } })];
    expect(commandsOf(['package.json'], m)).toEqual(['npm run dev', 'npm run test']);
  });

  it('AC-40, D-9 — a sub-manifest gets the `cd <dir> && ` prefix', () => {
    const tree = ['package.json', 'server/package.json', 'server/pnpm-lock.yaml', 'server/.env.example'];
    const cmds = commandsOf(tree, [manifest('', { scripts: {} }), manifest('server', { scripts: { dev: 'x' } })]);
    expect(cmds).toEqual(['cp server/.env.example server/.env', 'cd server && pnpm install', 'cd server && pnpm run dev']);
  });

  it('AC-40 — no compose file and no env example → no compose and no copy command', () => {
    const cmds = commandsOf(['package.json', 'pnpm-lock.yaml'], [manifest('', { scripts: { dev: 'x' } })]);
    expect(cmds).toEqual(['pnpm install', 'pnpm run dev']);
    expect(cmds.some((c) => c.startsWith('cp ') || c.includes('docker'))).toBe(false);
  });

  it('AC-40 — the compose command needs only the tree path (content is never needed)', () => {
    // The builder receives tree paths and parsed manifests only: no compose text exists to read.
    expect(commandsOf(['compose.yaml'], [])).toEqual(['docker compose up -d']);
  });

  it('AC-45 — no package.json and no lockfile → an empty command list', () => {
    expect(commandsOf(['README.md', 'src/a.ts'], [])).toEqual([]);
  });

  it('AC-40, INV-15, D-44 — unsafe directory names produce no command at all', () => {
    const unsafe = ['a b', 'x;rm -rf ~', '$(id)', '`id`'];
    const tree = ['package.json', 'pnpm-lock.yaml', 'web-app_2/package.json', 'web-app_2/pnpm-lock.yaml', 'web-app_2/.env.example'];
    for (const dir of unsafe) {
      tree.push(`${dir}/package.json`, `${dir}/pnpm-lock.yaml`, `${dir}/.env.example`);
    }
    const indexed = [...unsafe.flatMap((d) => [`${d}/a.ts`, `${d}/b.ts`, `${d}/c.ts`]), 'web-app_2/x.ts'];

    // the pipeline: pick manifests from the tree, then derive
    const picked = manifestPaths(tree, indexed);
    expect(picked.map((m) => m.dir)).toEqual(['', 'web-app_2']);

    // and directly: even if an unsafe dir (or a `..` path) reached deriveCommands
    const manifests = [
      manifest('', { scripts: { dev: 'x' } }),
      manifest('web-app_2', { scripts: { dev: 'x' } }),
      ...[...unsafe, '..', 'a/../b', 'a/..'].map((d) => manifest(d, { scripts: { dev: 'x', test: 'y' } })),
    ];
    const cmds = commandsOf(tree, manifests);
    expect(cmds).toEqual([
      'cp web-app_2/.env.example web-app_2/.env',
      'pnpm install',
      'pnpm run dev',
      'cd web-app_2 && pnpm install',
      'cd web-app_2 && pnpm run dev',
    ]);
    for (const c of cmds) {
      expect(c).not.toMatch(/[;|`]|\$\(/);
      const ands = c.split('&&').length - 1;
      expect(ands).toBeLessThanOrEqual(1);
      if (ands === 1) expect(c).toMatch(/^cd [A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)* && [^&]+$/);
      for (const d of unsafe) expect(c).not.toContain(d);
      expect(c).not.toContain('..');
    }
  });
});

describe('env example, excerpts and manifest pick (AC-64, AC-68)', () => {
  it('AC-64 — only the variable names come out, never a value', () => {
    const names = envExampleNames('A=1\nexport B_KEY=secret\n# C=3\nD = x');
    expect(names).toEqual(['A', 'B_KEY', 'D']);
    expect(JSON.stringify(names)).not.toContain('secret');
  });

  it('AC-68 — an excerpt of a 10,000-char text is 6,000 chars', () => {
    expect(excerpt('x'.repeat(10_000))).toHaveLength(6_000);
  });

  it('AC-68, D-6 — of 6 first-level package.json, at most 4 dirs, by indexed-file count', () => {
    const dirs = ['a', 'b', 'c', 'd', 'e', 'f'];
    const tree = dirs.map((d) => `${d}/package.json`);
    // counts: f=6, e=5, d=4, c=3, b=2, a=1
    const indexed = dirs.flatMap((d, i) => Array.from({ length: i + 1 }, (_, k) => `${d}/src/f${k}.ts`));
    expect(pickSubManifestDirs(tree, indexed)).toEqual(['f', 'e', 'd', 'c']);
  });

  it('D-6 — excluded dirs (node_modules, dist, …) are never picked as manifest dirs', () => {
    const tree = ['node_modules/package.json', 'dist/package.json', 'web/package.json'];
    const indexed = ['node_modules/a.ts', 'node_modules/b.ts', 'dist/a.ts', 'web/a.ts'];
    expect(pickSubManifestDirs(tree, indexed)).toEqual(['web']);
  });
});

describe('stack and folders (AC-20, AC-34)', () => {
  it('AC-34, AC-20 — languages by indexed file count, frameworks in table order', () => {
    const manifests: ManifestFact[] = [
      { dir: '', path: 'package.json', text: '', parsed: parseManifest(JSON.stringify({ dependencies: { fastify: '5', react: '19' } })) },
    ];
    const stack = detectStack({ indexedPaths: ['a.ts', 'b.tsx', 'c.js'], manifests, treePaths: ['package.json'] });
    expect(stack.languages).toEqual([
      { name: 'TypeScript', files: 2 },
      { name: 'JavaScript', files: 1 },
    ]);
    expect(stack.frameworks).toEqual(['React', 'Fastify']);
  });

  it('AC-34, D-6 — top-level folders: count desc, then name asc, root files excluded, at most 30', () => {
    const paths = ['src/a.ts', 'src/b.ts', 'lib/a.ts', 'app/a.ts', 'root.ts', 'index.js'];
    expect(topLevelFolders(paths)).toEqual([
      { path: 'src', files: 2 },
      { path: 'app', files: 1 },
      { path: 'lib', files: 1 },
    ]);
    const many = Array.from({ length: 40 }, (_, i) => `d${String(i).padStart(2, '0')}/x.ts`);
    expect(topLevelFolders(many)).toHaveLength(30);
  });
});

describe('file rows (AC-35, AC-36, AC-38, AC-49)', () => {
  const idx = (path: string, percentile: number, importers: number): IndexedFile => ({ path, rank: 1, percentile, importers });

  it('AC-35 — chains flatten in chain order, each file once', () => {
    const rows = criticalRows([['a', 'b', 'c'], ['a', 'd'], ['e', 'b', 'f']], []);
    expect(rows.map((r) => r.path)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('AC-35 — at most 6 rows with 7+ distinct files', () => {
    const rows = criticalRows([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h']], []);
    expect(rows.map((r) => r.path)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('AC-38 — no chains → no rows', () => {
    expect(criticalRows([], [idx('a', 90, 1)])).toEqual([]);
  });

  it('AC-36, AC-49, D-14 — importers and top_percent = max(1, 100 − percentile); reason null', () => {
    const rows = readingRows(['a.ts', 'b.ts'], [idx('a.ts', 100, 7), idx('b.ts', 95, 3)]);
    expect(rows).toEqual([
      { path: 'a.ts', reason: null, importers: 7, top_percent: 1 },
      { path: 'b.ts', reason: null, importers: 3, top_percent: 5 },
    ]);
  });
});

describe('task candidates (AC-52, AC-53, D-15 … D-18)', () => {
  it('AC-52, D-15 — TODO/FIXME/HACK inside comments, 1-based lines, todo:<path>:<line> ids', () => {
    const text = [
      'const a = 1;',
      'const b = 2;',
      '// TODO: x',
      '/* FIXME y */',
      '# HACK z',
      'const s = "TODO not a comment";',
    ].join('\n');
    const c = scanTodos('src/a.ts', text);
    expect(c.map((t) => [t.id, t.kind, t.path, t.line, t.detail])).toEqual([
      ['todo:src/a.ts:3', 'todo', 'src/a.ts', 3, 'x'],
      ['todo:src/a.ts:4', 'todo', 'src/a.ts', 4, 'y'],
      ['todo:src/a.ts:5', 'todo', 'src/a.ts', 5, 'z'],
    ]);
  });

  it('AC-52, D-15 — TODO text is capped at 200 chars', () => {
    const [c] = scanTodos('a.ts', `// TODO: ${'w'.repeat(500)}`);
    expect(c!.detail!.length).toBeLessThanOrEqual(200);
    expect(c!.detail!.length).toBeGreaterThan(100);
  });

  it('AC-52, D-16 — a file with a matching test file is no candidate; one without is', () => {
    const c = missingTestCandidates(['src/a.ts', 'src/b.ts'], ['src/a.ts', 'src/a.test.ts', 'src/b.ts']);
    expect(c.map((x) => [x.id, x.kind, x.path])).toEqual([['missing-tests:src/b.ts', 'missing-tests', 'src/b.ts']]);
  });

  it('AC-52, D-17 — open-PR candidates skip merged and closed PRs', () => {
    const pulls: OpenPull[] = [
      { number: 1, title: 'one', author: 'x', status: 'open', updatedAt: new Date('2026-01-01') },
      { number: 2, title: 'two', author: 'x', status: 'merged', updatedAt: new Date('2026-01-03') },
      { number: 3, title: 'three', author: 'x', status: 'closed', updatedAt: new Date('2026-01-04') },
      { number: 4, title: 'four', author: 'y', status: 'needs_review', updatedAt: new Date('2026-01-02') },
    ];
    const c = openPrCandidates(pulls);
    expect(c.map((x) => x.id)).toEqual(['open-pr:4', 'open-pr:1']);
    expect(c[0]).toMatchObject({ kind: 'open-pr', pr_number: 4, pr_title: 'four' });
  });

  it('AC-53, D-18 — files by rank, todo before missing-tests in a file, then open PRs; 20 → 15', () => {
    const todo = (path: string, line: number): TaskCandidate => ({
      id: `todo:${path}:${line}`, kind: 'todo', path, line, pr_number: null, pr_title: null, detail: 't', importers: null, top_percent: null,
    });
    const missing = (path: string): TaskCandidate => ({
      id: `missing-tests:${path}`, kind: 'missing-tests', path, line: null, pr_number: null, pr_title: null, detail: null, importers: null, top_percent: null,
    });
    const rankIndex = new Map([['hi.ts', 0], ['mid.ts', 1], ['lo.ts', 2]]);
    const files = [missing('lo.ts'), todo('mid.ts', 9), missing('hi.ts'), todo('hi.ts', 7), todo('hi.ts', 2)];
    const prs = openPrCandidates([
      { number: 1, title: 'old', author: 'a', status: 'open', updatedAt: new Date('2026-01-01') },
      { number: 2, title: 'new', author: 'a', status: 'open', updatedAt: new Date('2026-02-01') },
    ]);
    expect(orderCandidates(files, prs, rankIndex).map((c) => c.id)).toEqual([
      'todo:hi.ts:2',
      'todo:hi.ts:7',
      'missing-tests:hi.ts',
      'todo:mid.ts:9',
      'missing-tests:lo.ts',
      'open-pr:2',
      'open-pr:1',
    ]);

    const twenty = Array.from({ length: 20 }, (_, i) => todo('hi.ts', i + 1));
    expect(orderCandidates(twenty, [], rankIndex)).toHaveLength(15);
  });
});

describe('determinism (AC-23)', () => {
  const tree = ['package.json', 'pnpm-lock.yaml', 'web/package.json', 'api/package.json', 'src/a.ts', 'src/a.test.ts', 'src/b.ts', 'lib/c.ts'];
  const indexed = ['src/a.ts', 'src/b.ts', 'lib/c.ts', 'web/x.ts', 'api/y.ts'];
  const pulls: OpenPull[] = [
    { number: 1, title: 'one', author: 'x', status: 'open', updatedAt: new Date('2026-01-01') },
    { number: 2, title: 'two', author: 'x', status: 'open', updatedAt: new Date('2026-01-01') },
    { number: 3, title: 'three', author: 'x', status: 'open', updatedAt: null },
  ];
  const manifests: ManifestFact[] = [
    { dir: '', path: 'package.json', text: '', parsed: parseManifest('{"scripts":{"dev":"x"},"dependencies":{"react":"1","zod":"3"}}') },
  ];

  const build = (t: string[], ix: string[], p: OpenPull[], seed = 0) => {
    const fileCands = [...scanTodos('src/b.ts', '// TODO one\n// FIXME two'), ...missingTestCandidates(['src/a.ts', 'src/b.ts', 'lib/c.ts'], t)];
    return {
      manifests: manifestPaths(t, ix),
      commands: deriveCommands({ treePaths: t, manifests }),
      stack: detectStack({ indexedPaths: ix, manifests, treePaths: t }),
      folders: topLevelFolders(ix),
      missing: missingTestCandidates(['src/a.ts', 'src/b.ts', 'lib/c.ts'], t),
      prs: openPrCandidates(p),
      // equal-rank files: every path shares rank index 0
      ordered: orderCandidates(seed ? shuffled(fileCands, seed) : fileCands, [], new Map(ix.map((x) => [x, 0]))),
    };
  };

  it('AC-23 — equal inputs give deep-equal outputs, twice', () => {
    expect(build(tree, indexed, pulls)).toEqual(build(tree, indexed, pulls));
  });

  it('AC-23 — shuffled input arrays (equal-rank files, equal-time PRs) give the same output', () => {
    const base = build(tree, indexed, pulls);
    for (const seed of [1, 7, 42]) {
      expect(build(shuffled(tree, seed), shuffled(indexed, seed + 1), shuffled(pulls, seed + 2), seed)).toEqual(base);
    }
  });
});

describe('the EXCLUDED_DIRS copy (AC-40, AC-47, findings F-02)', () => {
  it('onboarding EXCLUDED_DIRS equals the indexer EXCLUDED_DIRS', () => {
    // A copy exists because `no-cross-module` forbids the import; this pins it.
    expect([...ONBOARDING_EXCLUDED_DIRS]).toEqual([...REPO_INTEL_EXCLUDED_DIRS]);
  });
});

// ---------------------------------------------------------------------------
// Regressions for the round-2 findings. Expected values come from the finding
// text and D-15 / D-44, not from the fixed code.
// ---------------------------------------------------------------------------

describe('regression F-15 — a `#` that is not a comment is no TODO (AC-52, D-15)', () => {
  it('F-15, AC-52 — a JS private field and a quoted "# TODO" are not candidates; real # comments still are', () => {
    const text = [
      "const label = this.#prefix + 'TODO';", // 1: private field, TODO in a string
      "const s = '# TODO later';", // 2: '# TODO' inside a single-quoted string
      'const d = "#TODO: not a comment";', // 3: same, double-quoted
      'return this.#cache.get(k); // ok', // 4: private field, a comment without a marker
      '# TODO real shell comment', // 5: line-start # comment (D-15)
      'x = 1  # FIXME python comment', // 6: # comment after whitespace (D-15)
    ].join('\n');
    expect(scanTodos('src/a.ts', text).map((c) => [c.line, c.detail])).toEqual([
      [5, 'real shell comment'],
      [6, 'python comment'],
    ]);
  });
});

describe('regression F-20 — a dir segment starting with `-` gives no command (AC-40, D-44, INV-15)', () => {
  it('F-20, INV-15 — `-P`, `--help` and `a/-x` are skipped like any unsafe dir: no cd, cp, install or script', () => {
    const dashed = ['-P', '--help', 'a/-x'];
    const tree = ['package.json', 'pnpm-lock.yaml'];
    for (const dir of dashed) tree.push(`${dir}/package.json`, `${dir}/pnpm-lock.yaml`, `${dir}/.env.example`);

    // the pipeline: a first-level `-P/` / `--help/` manifest is never picked
    const picked = manifestPaths(tree, ['-P/a.ts', '-P/b.ts', '--help/c.ts']);
    expect(picked.map((m) => m.dir)).toEqual(['']);

    // and directly, even if such a dir reached deriveCommands
    const manifests = [manifest('', { scripts: { dev: 'x' } }), ...dashed.map((d) => manifest(d, { scripts: { dev: 'x', test: 'y' } }))];
    const cmds = commandsOf(tree, manifests);
    expect(cmds).toEqual(['pnpm install', 'pnpm run dev']);
    for (const c of cmds) expect(c).not.toMatch(/(^|\s|\/)-/);
  });
});

// ---------------------------------------------------------------------------
// Round 5 — F-39 (D-16 rev. 4, AC-52): a file a test imports is covered, even
// when no test has its name (ky keeps its suites in `test/*.ts`).
// ---------------------------------------------------------------------------

describe('regression F-39 — missing-tests uses who imports the file (AC-52, D-16)', () => {
  it('F-39 — isTestPath: a *.test/*.spec basename, or any file under a test directory', () => {
    for (const p of ['src/a.test.ts', 'src/a.spec.tsx', 'test/main.ts', 'tests/x/y.js', 'pkg/__tests__/z.ts', 'spec/a.ts', 'specs/b.mjs']) {
      expect(isTestPath(p), p).toBe(true);
    }
    for (const p of ['src/a.ts', 'source/index.ts', 'src/testing.ts', 'src/latest/a.ts', 'docs/spec.md.ts', 'contest/a.ts']) {
      expect(isTestPath(p), p).toBe(false);
    }
  });

  it('F-39 — a file imported by a test path is no candidate; imports from non-test files do not count', () => {
    const scan = ['source/index.ts', 'source/core.ts', 'source/util.ts'];
    const tree = [...scan, 'test/main.ts', 'source/other.ts'];
    const importers = [
      { from: 'test/main.ts', to: 'source/index.ts' }, // ky's case: a test suite imports it
      { from: 'source/other.ts', to: 'source/core.ts' }, // a plain import does not cover it
    ];
    expect(missingTestCandidates(scan, tree, importers).map((c) => c.path)).toEqual(['source/core.ts', 'source/util.ts']);
  });

  it('F-39 — the name rule still works with no import edges, and a test file is never a candidate', () => {
    // a: covered by name (a test anywhere in the tree); c: covered by `.spec.`; b: no test
    // test/helpers.ts and src/d.spec.ts are tests themselves, never candidates
    const scan = ['src/a.ts', 'test/helpers.ts', 'src/b.ts', 'src/c.ts', 'src/d.spec.ts'];
    const tree = [...scan, 'other/a.test.ts', 'src/c.spec.tsx'];
    expect(missingTestCandidates(scan, tree, []).map((c) => c.id)).toEqual(['missing-tests:src/b.ts']);
    // default argument: the same as no edges
    expect(missingTestCandidates(scan, tree).map((c) => c.id)).toEqual(['missing-tests:src/b.ts']);
  });

  it('F-39, AC-52, AC-53 — candidates keep the scan (rank) order, and the 15-cap of orderCandidates still applies', () => {
    const scan = Array.from({ length: 20 }, (_, i) => `src/f${String(i).padStart(2, '0')}.ts`);
    const covered = new Set(['src/f03.ts', 'src/f10.ts']);
    const importers = [...covered].map((to) => ({ from: 'test/all.ts', to }));
    const c = missingTestCandidates(scan, [...scan, 'test/all.ts'], importers);
    expect(c.map((x) => x.path)).toEqual(scan.filter((p) => !covered.has(p)));
    const rankIndex = new Map(scan.map((p, i) => [p, i]));
    const ordered = orderCandidates(c, [], rankIndex);
    expect(ordered).toHaveLength(15);
    expect(ordered.map((x) => x.path)).toEqual(scan.filter((p) => !covered.has(p)).slice(0, 15));
  });
});
