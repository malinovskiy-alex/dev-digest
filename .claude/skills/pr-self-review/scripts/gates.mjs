#!/usr/bin/env node
// Deterministic pre-PR gates G1-G12 + diff inventory + lens routing.
// No model, no network, no package install. Writes gates.json, prints a summary.
//
//   node .claude/skills/pr-self-review/scripts/gates.mjs [--json]
//
// Rules and reasoning: references/gates.md. Exit code is always 0 — the verdict
// lives in the JSON, because the caller (the skill) decides what to do with it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, repoRoot, collectDiff, addedLines, cacheDir } from './lib/repo.mjs';
import { route, touchedPackages } from './lib/routing.mjs';

const root = repoRoot();
const d = collectDiff(root);
const added = addedLines(d);
const findings = [];
const paths = d.files.map((f) => f.path);
const has = (re) => paths.filter((p) => re.test(p));
const read = (p) => {
  try {
    return readFileSync(join(root, p), 'utf8');
  } catch {
    return null;
  }
};

const flag = (id, severity, title, detail, file = null, line = null) =>
  findings.push({ id, severity, title, detail, file, line, lens: 'gate', grounded: Boolean(file) });

// ---------------------------------------------------------------- G1 vendor mirror
// @devdigest/shared is vendored twice. The gate is content equality, not "both
// files appear in the diff" — mirroring it wrongly fails the same way.
for (const p of has(/^(server|client)\/src\/vendor\/shared\//)) {
  const rel = p.replace(/^(server|client)\/src\/vendor\/shared\//, '');
  const a = read(`server/src/vendor/shared/${rel}`);
  const b = read(`client/src/vendor/shared/${rel}`);
  const norm = (s) => (s === null ? null : s.replace(/\r\n/g, '\n'));
  if (norm(a) !== norm(b)) {
    flag('G1', 'CRITICAL', 'Вендорена копія @devdigest/shared розійшлася',
      `server/src/vendor/shared/${rel} і client/src/vendor/shared/${rel} відрізняються. Дзеркалити треба в тому ж коміті.`,
      p);
  }
}

// ---------------------------------------------------------------- G2 lockfiles
for (const p of has(/(pnpm-lock\.yaml|package-lock\.json)$/)) {
  const subjects = d.mergeBase
    ? git(['log', '--format=%s', `${d.mergeBase}..HEAD`, '--', p], root).split('\n').filter(Boolean)
    : [];
  const depSubject = /^(chore|build|fix|feat)?\(?deps?\)?|dependenc|bump |upgrade |downgrade |add .*(package|dependency)/i;
  if (!subjects.length) {
    flag('G2', 'WARNING', 'Лок-файл змінено, але не закомічено',
      `${p} змінений у робочому дереві. Він змінюється лише в коміті, subject якого — саме ця зміна залежності.`, p);
  } else if (!subjects.every((s) => depSubject.test(s))) {
    flag('G2', 'CRITICAL', 'Лок-файл змінено в коміті не про залежності',
      `${p} чіпають коміти: ${subjects.join(' | ')}. Лок-файл змінюється тільки в коміті, subject якого — ця зміна залежності.`, p);
  }
}

// ---------------------------------------------------------------- G3 branch
const codeChanged = paths.some((p) => /\.(ts|tsx|mjs|sql)$/.test(p) && !/^\.claude\//.test(p));
if (d.branch === 'main' && codeChanged) {
  flag('G3', 'CRITICAL', 'Робота на main',
    'main — курсовий стартер. Робота лекції належить гілці або форку (AGENTS.md, Hard rules).');
}

// ---------------------------------------------------------------- G4 secrets
const SECRETS = [
  [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub personal access token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
  [/\bsk-ant-[A-Za-z0-9-]{20,}/, 'Anthropic API key'],
  [/\bsk-[A-Za-z0-9]{32,}/, 'OpenAI API key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
];
for (const { file, line, text } of added) {
  if (/\.(example|sample)$|(^|\/)\.env\.example$|^\.claude\/skills\//.test(file)) continue;
  for (const [re, what] of SECRETS) {
    if (re.test(text)) flag('G4', 'CRITICAL', `Схоже на секрет у діфі (${what})`,
      'Секрети живуть у ~/.devdigest/secrets.json за SecretsProvider — ніколи в git, БД чи AppConfig.', file, line);
  }
}
for (const p of paths) {
  if (/(^|\/)\.env$|(^|\/)\.env\.local$/.test(p)) {
    flag('G4', 'CRITICAL', '.env у діфі', `${p} не має потрапляти в коміт.`, p);
  }
}

// ---------------------------------------------------------------- G5 migrations
const migrations = has(/^server\/drizzle\/.*\.sql$/);
if (migrations.length) {
  flag('G5', 'WARNING', 'Нова міграція — застосуй її вручну',
    'Міграції не застосовуються на старті. На Windows `pnpm db:migrate` виходить із кодом 0, нічого не зробивши, — перевіряй кількість таблиць, а не exit-код.',
    migrations[0]);
}

// ---------------------------------------------------------------- G8 route registration
const index = read('server/src/modules/index.ts') ?? '';
for (const p of has(/^server\/src\/modules\/[^/]+\/routes\.ts$/)) {
  const mod = p.split('/')[3];
  if (!index.includes(`modules/${mod}`) && !index.includes(`./${mod}`)) {
    flag('G8', 'CRITICAL', `Модуль ${mod} не зареєстрований`,
      `${p} існує, але server/src/modules/index.ts його не підключає — роут не потрапить у застосунок.`, p);
  }
}

// ---------------------------------------------------------------- G9 schema <-> migration
if (has(/^server\/src\/db\/schema\.ts$/).length && !migrations.length) {
  flag('G9', 'CRITICAL', 'Схему змінено без міграції',
    'server/src/db/schema.ts у діфі, а нової міграції в server/drizzle/ немає. Прожени `pnpm db:generate`.',
    'server/src/db/schema.ts');
}

// ---------------------------------------------------------------- G10 contract <-> consumer
if (has(/\/vendor\/shared\/contracts\//).length && !paths.some((p) => /^client\/src\//.test(p) && !/vendor\//.test(p))) {
  flag('G10', 'WARNING', 'Контракт змінено, клієнт — ні',
    'Змінено контракт у vendor/shared/contracts, але жоден файл client/src поза vendor/ не оновлено. Перевір, чи не відстав споживач.',
    has(/\/vendor\/shared\/contracts\//)[0]);
}

// ---------------------------------------------------------------- G11 test suite placement
for (const p of has(/^server\/src\/.*\.test\.ts$/)) {
  if (/\.it\.test\.ts$/.test(p)) continue;
  const body = read(p) ?? '';
  if (/testcontainers|PostgreSqlContainer|startPostgres/.test(body)) {
    flag('G11', 'WARNING', 'DB-тест без суфікса .it.test.ts',
      `${p} піднімає Postgres, але назва не має суфікса .it.test.ts — він потрапить у герметичну сюїту і зламає її (TESTING.md).`, p);
  }
}

// ---------------------------------------------------------------- G12 hardcoded UI text
for (const { file, line, text } of added) {
  if (!/^client\/src\/.*\.tsx$/.test(file) || /\.test\.tsx$/.test(file)) continue;
  if (/>\s*[A-ZА-ЯІЇЄ][A-Za-zА-Яа-яІіЇїЄє ,.'!?-]{4,}\s*</.test(text) && !/\{t\(|aria-|data-/.test(text)) {
    flag('G12', 'WARNING', 'Текст в UI повз next-intl',
      'Літерал тексту в JSX замість ключа з client/messages/en/*.json.', file, line);
  }
}

// ---------------------------------------------------------------- CRLF trap
const plain = d.mergeBase ? git(['diff', '--numstat', d.mergeBase], root) : '';
const ignoreCr = d.mergeBase ? git(['diff', '--numstat', '--ignore-cr-at-eol', d.mergeBase], root) : '';
const tally = (s) => Object.fromEntries(s.split('\n').filter(Boolean).map((l) => {
  const [a, b, ...r] = l.split('\t');
  return [r.join('\t'), (Number(a) || 0) + (Number(b) || 0)];
}));
const tPlain = tally(plain);
const tCr = tally(ignoreCr);
for (const [p, n] of Object.entries(tPlain)) {
  if (n >= 20 && (tCr[p] ?? 0) * 5 < n) {
    flag('CRLF', 'WARNING', 'Перевернуті закінчення рядків',
      `${p} виглядає як переписаний цілком (${n} рядків), але без CR-різниці змін майже немає. Це CRLF-фліп, а не зміна — не рев'юй ці рядки.`, p);
  }
}

// ---------------------------------------------------------------- output
const counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
findings.forEach((f) => counts[f.severity]++);

const report = {
  generated_at: new Date().toISOString(),
  base: d.base || '(none)',
  merge_base: d.mergeBase,
  head_sha: d.headSha,
  branch: d.branch,
  diff_hash: d.diffHash,
  files: d.files,
  routing: route(d.files, added),
  packages: touchedPackages(d.files),
  counts,
  findings,
};

const dir = cacheDir(root);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'gates.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const groups = Object.entries(report.routing);
  console.log(`base ${report.base} · ${d.files.length} files · diff ${d.diffHash} · branch ${d.branch}`);
  for (const [g, v] of groups) console.log(`  ${g}: ${v.files.length} files -> ${v.lenses.join(', ') || '(gates only)'}`);
  for (const p of report.packages) console.log(`  ${p.package}: ${p.commands.join(' · ')}`);
  console.log(`gates: CRITICAL ${counts.CRITICAL} · WARNING ${counts.WARNING} · SUGGESTION ${counts.SUGGESTION}`);
  for (const f of findings) console.log(`  [${f.severity}] ${f.id} ${f.file ?? ''}${f.line ? ':' + f.line : ''} — ${f.title}`);
  console.log(`written: ${join(dir, 'gates.json')}`);
}
if (!existsSync(join(root, '.git'))) process.exitCode = 0;
