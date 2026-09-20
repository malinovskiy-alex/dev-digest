#!/usr/bin/env node
// PreToolUse gatekeeper: refuses `gh pr create` unless a FRESH pr-self-review
// report exists and it did not block. It reviews nothing itself — it only
// checks the verdict's freshness, which is what makes "не мержити" real.
//
// Wired from .claude/settings.json; see references/hook.md.
// Bypass for one call: PR_SELF_REVIEW_SKIP=1 gh pr create ...
import { join } from 'node:path';
import { repoRoot, collectDiff, cacheDir, readJson } from './lib/repo.mjs';

const deny = (reason) => {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
};
const allow = () => process.exit(0);

let stdin = '';
for await (const chunk of process.stdin) stdin += chunk;

let cmd = '';
try {
  cmd = JSON.parse(stdin || '{}')?.tool_input?.command ?? '';
} catch {
  allow(); // malformed payload is not this hook's problem
}

// Only PR creation. `gh pr view/list/checkout/merge` and everything else pass.
// The command must START a shell command — anchored at the beginning or after a
// separator. A bare /\bgh pr create\b/ also matches the string inside
// `echo "runs gh pr create"`, which blocks commands that open nothing.
if (!/(^|[;&|(]|\n)\s*(\w+=\S+\s+)*(sudo\s+)?gh\s+pr\s+create\b/.test(cmd)) allow();

// Escape hatch. Read from the COMMAND, not only from our own environment: an
// inline `VAR=1 cmd` prefix is applied by the shell when the command runs, which
// is after this hook has already decided — so process.env alone never sees it.
if (/(^|\s)PR_SELF_REVIEW_SKIP=1(\s|$)/.test(cmd) || process.env.PR_SELF_REVIEW_SKIP === '1') allow();

const root = repoRoot();
const report = readJson(join(cacheDir(root), 'last-run.json'));
const RUN = 'Прожени /pr-self-review, полагодь CRITICAL, і повтори.';

if (!report) {
  deny(`Немає self-review для цих змін (.devdigest/cache/pr-self-review/last-run.json відсутній). ${RUN}`);
}

const d = collectDiff(root);
if (report.head_sha !== d.headSha) {
  deny(`Self-review робився на ${String(report.head_sha).slice(0, 8)}, а HEAD зараз ${d.headSha.slice(0, 8)} — звіт застарів. ${RUN}`);
}
if (report.diff_hash !== d.diffHash) {
  deny(`Робоче дерево змінилося після self-review (diff ${report.diff_hash} -> ${d.diffHash}). ${RUN}`);
}

if (report.blocked === true) {
  const crit = (report.findings ?? [])
    .filter((f) => f.severity === 'CRITICAL')
    .map((f) => `  · ${f.file ?? '—'}${f.line ? ':' + f.line : ''} — ${f.title}`)
    .join('\n');
  deny(`Self-review заблокував цей PR: ${report.counts?.CRITICAL ?? '?'} CRITICAL.\n${crit}\n` +
    'Полагодь їх і прожени /pr-self-review ще раз. Свідомий обхід: /pr-self-review --override "<причина>".');
}

allow();
