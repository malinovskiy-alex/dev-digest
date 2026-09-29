#!/usr/bin/env node
// Cases for read-only-bash.mjs. Run: `node .claude/hooks/read-only-bash.test.mjs`.
// Fed through stdin exactly as Claude Code does (INSIGHTS.md, 2026-09-19: test
// a command-text hook from a script, never from a Bash command it would see).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const guard = join(dirname(fileURLToPath(import.meta.url)), 'read-only-bash.mjs');

function decide(command, cwd = '/repo/server') {
  const out = execFileSync('node', [guard], {
    input: JSON.stringify({ tool_input: { command }, cwd, agent_type: 'plan-verifier' }),
  }).toString();
  return out.includes('"deny"') ? 'deny' : 'allow';
}

const cases = [
  // What the read-only agents actually ran in practice — must stay allowed.
  ['allow', 'pnpm arch'],
  ['allow', 'cd server && pnpm typecheck'],
  ['allow', "pnpm exec vitest run --exclude '**/*.it.test.ts'"],
  ['allow', 'pnpm exec vitest run .it.test --no-file-parallelism 2>&1 | tail -20'],
  ['allow', 'cd reviewer-core && npm run typecheck && npm test', '/repo'],
  ['allow', 'git diff --name-only origin/main...HEAD'],
  ['allow', 'git status --short --untracked-files=all'],
  ['allow', 'git log --oneline -5'],
  ['allow', 'grep -rn "intent" server/src | head'],
  ['allow', `node -e "const j=require('./x.json');console.log(Object.keys(j).length)"`],
  ['allow', `node -e "[1,2].map((x) => x >= 1)"`],
  ['allow', 'claude plugin validate .claude/agents'],
  ['allow', 'docker ps >/dev/null 2>&1; echo $?'.replace('docker ps', 'ls')],
  ['allow', 'sed -n 1,40p server/src/app.ts'],
  ['allow', 'find server/src -name "*.ts" | wc -l'],
  // Writes — must be refused.
  ['deny', 'pnpm typecheck', '/repo/reviewer-core'],
  ['deny', 'cd reviewer-core && pnpm typecheck', '/repo'],
  ['deny', 'echo hi > notes.txt'],
  ['deny', 'git diff >> patch.diff'],
  ['deny', 'cat a | tee b'],
  ['deny', 'rm -rf server/dist'],
  ['deny', 'mv a b'],
  ['deny', 'touch x'],
  ['deny', 'mkdir tmp'],
  ['deny', "sed -i 's/a/b/' file.ts"],
  ['deny', 'git commit -m x'],
  ['deny', 'git checkout main'],
  ['deny', 'git stash'],
  ['deny', 'git add -A'],
  ['deny', 'pnpm install'],
  ['deny', 'pnpm add left-pad'],
  ['deny', 'npm ci'],
  ['deny', 'pnpm arch:baseline'],
  ['deny', 'pnpm db:migrate'],
  ['deny', `node -e "require('fs').writeFileSync('x','y')"`],
  ['deny', `node -e "require('child_process').execSync('rm x')"`],
  ['deny', 'node scripts/anything.mjs'],
  ['deny', 'find . -name "*.log" -delete'],
  ['deny', 'curl -o out.html https://example.com'],
  ['deny', 'python -c "open(\'x\',\'w\')"'],
];

let failed = 0;
for (const [want, command, cwd] of cases) {
  const got = decide(command, cwd);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${want.padEnd(5)} ${command}${cwd ? `   (cwd ${cwd})` : ''}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
