#!/usr/bin/env node
// Compact, baseline-aware verification for one package.
//
// Run it from INSIDE the package directory:
//   node ../scripts/verify.mjs                          # typecheck · arch · lint · full suite
//   node ../scripts/verify.mjs --related src/a.ts ...   # only the tests that import these files
//   node ../scripts/verify.mjs --save-baseline L05-x    # record today's failures before editing
//   node ../scripts/verify.mjs --baseline L05-x         # fail only on failures that are NEW
//   node ../scripts/verify.mjs --it                     # server: add the integration suite
//   node ../scripts/verify.mjs --no-typecheck --no-arch # tests only
//   node ../scripts/verify.mjs --no-lint                # client: skip eslint
//
// Prints ~10–30 lines: one row per check, then the new failures trimmed to their
// assertion. Baselines live in <repo>/.devdigest/cache/verify/ (gitignored).
// Exit 1 iff something failed that the baseline does not already contain.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CWD = process.cwd();
const PKG = basename(CWD);

// The single source of the per-package commands. Agents and TESTING.md point here.
const PACKAGES = {
  server: { pm: 'pnpm', typecheck: true, arch: true, tests: true, unitExclude: '**/*.it.test.ts', it: true },
  client: { pm: 'pnpm', typecheck: true, lint: true, tests: true },
  'reviewer-core': { pm: 'npm', typecheck: true, tests: true, extra: ['--passWithNoTests'] },
  mcp: { pm: 'npm', typecheck: true, tests: true, build: true },
  e2e: { pm: 'npm', typecheck: true },
};

const cfg = PACKAGES[PKG];
if (!cfg || dirname(CWD) !== REPO) {
  console.error(`verify: run from inside a package directory (${Object.keys(PACKAGES).join(', ')}); cwd is ${CWD}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const related = flag('--related')
  ? args.slice(args.indexOf('--related') + 1).filter((a) => !a.startsWith('--'))
  : null;
const saveAs = value('--save-baseline');
const compareTo = value('--baseline');
const baselineDir = join(REPO, '.devdigest', 'cache', 'verify');
const baselinePath = (name) => join(baselineDir, `${name}.${PKG}.json`);

const ANSI = /\x1b\[[0-9;]*m/g;
const run = (cmd) => {
  const r = spawnSync(cmd, { cwd: CWD, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(ANSI, '') };
};
const tail = (text, n) => text.trim().split('\n').slice(-n).map((l) => `    ${l}`).join('\n');
const script = (name) => `${cfg.pm} run ${name}`;

let baseline = null;
if (compareTo) {
  if (!existsSync(baselinePath(compareTo))) {
    console.error(`verify: no baseline ${baselinePath(compareTo)} — create it with --save-baseline ${compareTo} on the clean tree`);
    process.exit(2);
  }
  baseline = JSON.parse(readFileSync(baselinePath(compareTo), 'utf8'));
}

const rows = [];
const details = [];
const record = { pkg: PKG, createdAt: new Date().toISOString(), head: run('git rev-parse --short HEAD').out.trim(), typecheckErrors: 0, archOk: true, lintOk: true, failures: [] };
let blocking = false;

if (cfg.typecheck && !flag('--no-typecheck')) {
  const r = run(script('typecheck'));
  const errors = r.out.split('\n').filter((l) => /error TS\d+/.test(l));
  record.typecheckErrors = r.code === 0 ? 0 : Math.max(errors.length, 1);
  const allowed = baseline?.typecheckErrors ?? 0;
  const bad = record.typecheckErrors > allowed;
  blocking ||= bad;
  rows.push(`typecheck   ${r.code === 0 ? '✅ 0 errors' : `${bad ? '❌' : '➖'} ${record.typecheckErrors} errors${baseline ? ` (baseline ${allowed})` : ''}`}`);
  if (r.code !== 0) details.push(`typecheck:\n${(errors.length ? errors.slice(0, 15).map((l) => `    ${l}`).join('\n') : tail(r.out, 15))}`);
}

if (cfg.arch && !flag('--no-arch')) {
  const r = run(script('arch'));
  record.archOk = r.code === 0;
  const bad = !record.archOk && (baseline?.archOk ?? true);
  blocking ||= bad;
  rows.push(`arch        ${record.archOk ? '✅ no new violation' : `${bad ? '❌ new violation(s)' : '➖ failing, as in the baseline'}`}`);
  if (!record.archOk) details.push(`arch:\n${tail(r.out, 20)}`);
}

// eslint catches what typecheck and the tests do not (e.g. `no-restricted-imports`,
// which otherwise surfaces only at `next build`). With --related, only those files.
if (cfg.lint && !flag('--no-lint')) {
  const files = related?.filter((f) => /\.[cm]?[jt]sx?$/.test(f));
  if (!related || files.length) {
    const r = run(related ? `${cfg.pm} exec eslint ${files.map((f) => JSON.stringify(f)).join(' ')}` : script('lint'));
    record.lintOk = r.code === 0;
    const bad = !record.lintOk && (baseline?.lintOk ?? true);
    blocking ||= bad;
    const errors = r.out.match(/\((\d+) errors?/)?.[1];
    rows.push(`lint        ${record.lintOk ? '✅ no errors' : `${bad ? '❌' : '➖'} ${errors ? `${errors} errors` : 'failing'}${bad ? '' : ', as in the baseline'}`}`);
    if (!record.lintOk) details.push(`lint:\n${tail(r.out, 20)}`);
  }
}

const vitest = (label, extraArgs) => {
  const out = join(tmpdir(), `verify-${PKG}-${process.pid}-${label.replace(/\W/g, '')}.json`);
  const bin = join('node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest');
  const mode = related ? `related --run ${related.map((f) => JSON.stringify(f)).join(' ')}` : 'run';
  const cmd = [JSON.stringify(bin), mode, ...extraArgs, ...(cfg.extra ?? []), '--reporter=json', `--outputFile=${JSON.stringify(out)}`].join(' ');
  const r = run(cmd);
  if (!existsSync(out)) {
    blocking = true;
    rows.push(`${label.padEnd(11)} ❌ runner crashed (exit ${r.code})`);
    details.push(`${label}:\n${tail(r.out, 25)}`);
    return;
  }
  const json = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(out, { force: true });

  const failures = [];
  for (const file of json.testResults ?? []) {
    const rel = relative(CWD, file.name).split('\\').join('/');
    const failed = (file.assertionResults ?? []).filter((a) => a.status === 'failed');
    for (const a of failed) failures.push({ id: `${rel} > ${a.fullName}`, msg: (a.failureMessages ?? []).join('\n') });
    if (file.status === 'failed' && failed.length === 0) failures.push({ id: `${rel} > (file failed to load)`, msg: file.message ?? '' });
  }
  record.failures.push(...failures.map((f) => f.id));

  const known = new Set(baseline?.failures ?? []);
  const fresh = baseline ? failures.filter((f) => !known.has(f.id)) : failures;
  const skipped = (json.numPendingTests ?? 0) + (json.numTodoTests ?? 0);
  const bad = fresh.length > 0;
  blocking ||= bad;
  const split = baseline ? ` (${failures.length - fresh.length} baseline, ${fresh.length} new)` : '';
  rows.push(`${label.padEnd(11)} ${bad ? '❌' : failures.length ? '➖' : '✅'} ${json.numPassedTests} passed · ${failures.length} failed${split} · ${skipped} skipped`);
  if (label === 'integration' && skipped > 0) rows.push(`            ⚠ ${skipped} skipped — the integration suite did not really run (Docker? parallelism?)`);
  for (const f of fresh.slice(0, 10)) {
    const lines = f.msg.replace(ANSI, '').split('\n').filter((l) => l.trim() && !/^\s+at /.test(l)).slice(0, 8);
    details.push(`${baseline ? 'NEW ' : ''}FAIL ${f.id}\n${lines.map((l) => `    ${l}`).join('\n')}`);
  }
  if (fresh.length > 10) details.push(`… and ${fresh.length - 10} more failure(s)`);
  if (baseline && label === 'tests') {
    const now = new Set(failures.map((f) => f.id));
    const fixed = [...known].filter((id) => !now.has(id) && !id.includes('.it.test.'));
    if (fixed.length) rows.push(`            ℹ ${fixed.length} baseline failure(s) now pass`);
  }
};

if (cfg.tests && !flag('--no-tests')) {
  vitest(related ? 'related' : 'tests', cfg.unitExclude ? [`--exclude ${JSON.stringify(cfg.unitExclude)}`] : []);
  if (cfg.it && flag('--it') && !related) vitest('integration', ['.it.test', '--no-file-parallelism']);
}

if (cfg.build && !flag('--no-build') && !related) {
  const r = run(script('build'));
  blocking ||= r.code !== 0;
  rows.push(`build       ${r.code === 0 ? '✅' : '❌'}`);
  if (r.code !== 0) details.push(`build:\n${tail(r.out, 15)}`);
}

if (saveAs) {
  mkdirSync(baselineDir, { recursive: true });
  writeFileSync(baselinePath(saveAs), `${JSON.stringify(record, null, 2)}\n`);
}

const head = baseline ? `baseline ${compareTo} @ ${baseline.head}` : saveAs ? `saved as baseline ${saveAs}` : 'no baseline — every failure is listed';
console.log(`verify ${PKG}${related ? ` · related to ${related.length} file(s)` : ''} · ${head}`);
for (const row of rows) console.log(`  ${row}`);
if (details.length) console.log(`\n${details.join('\n\n')}`);
if (saveAs) console.log(`\nbaseline written: ${relative(REPO, baselinePath(saveAs)).split('\\').join('/')}`);

process.exit(saveAs ? 0 : blocking ? 1 : 0);
