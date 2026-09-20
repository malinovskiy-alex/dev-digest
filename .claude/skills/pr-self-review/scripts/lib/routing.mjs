// Path -> review lenses. The prose version, with the reasoning, is in
// references/routing.md; this file is what the gate actually evaluates.
// Keep the two in sync — the doc is the contract, this is the implementation.

/** @type {{re: RegExp, group: 'frontend'|'backend'|'crosscutting', lenses: string[]}[]} */
export const RULES = [
  // --- client -------------------------------------------------------------
  { re: /^client\/src\/app\/.*\/(page|layout|route|template|error|loading)\.tsx?$/,
    group: 'frontend', lenses: ['frontend-ui-architecture', 'next-best-practices', 'react-best-practices'] },
  { re: /^client\/src\/(app|components)\/.*\.tsx?$/,
    group: 'frontend', lenses: ['frontend-ui-architecture', 'react-best-practices', 'next-best-practices'] },
  { re: /^client\/src\/.*\.test\.tsx?$/,
    group: 'frontend', lenses: ['react-testing-library'] },
  { re: /^client\/src\/lib\//,
    group: 'frontend', lenses: ['frontend-ui-architecture', 'typescript-expert'] },
  { re: /^client\/messages\//,
    group: 'frontend', lenses: [] }, // gate-only: G12 cares, no lens does

  // --- server / reviewer-core --------------------------------------------
  { re: /^server\/src\/modules\/[^/]+\/routes\.ts$|^server\/src\/app\.ts$|^server\/src\/platform\//,
    group: 'backend', lenses: ['fastify-best-practices', 'onion-architecture', 'security', 'perf-prompt'] },
  { re: /^server\/src\/modules\/[^/]+\/(service|run-executor)\.ts$|^server\/src\/modules\/[^/]+\/pipeline\//,
    group: 'backend', lenses: ['onion-architecture', 'perf-prompt'] },
  { re: /^server\/src\/modules\/[^/]+\/repository[^/]*\.ts$|^server\/src\/db\//,
    group: 'backend', lenses: ['drizzle-orm-patterns', 'onion-architecture', 'perf-prompt'] },
  { re: /^server\/src\/db\/schema\.ts$|^server\/drizzle\//,
    group: 'backend', lenses: ['postgresql-table-design', 'drizzle-orm-patterns'] },
  { re: /^server\/src\/adapters\//,
    group: 'backend', lenses: ['onion-architecture', 'security', 'perf-prompt'] },
  { re: /^reviewer-core\/src\//,
    group: 'backend', lenses: ['onion-architecture', 'typescript-expert'] },
  { re: /^server\/src\/.*\.ts$/,
    group: 'backend', lenses: ['onion-architecture'] },

  // --- cross-cutting ------------------------------------------------------
  { re: /\/vendor\/shared\/contracts\/[^/]+\.ts$/,
    group: 'crosscutting', lenses: ['zod'] },
  { re: /^e2e\//, group: 'crosscutting', lenses: [] },        // checklist in e2e/AGENTS.md
  { re: /^docs\/agent-prompts\//, group: 'crosscutting', lenses: [] },
  { re: /^\.claude\/skills\//, group: 'crosscutting', lenses: [] }, // never lens the reviewer itself
  { re: /\.(md|ya?ml|json)$/, group: 'crosscutting', lenses: [] },
];

/** Added-line content that pulls in a lens regardless of path. */
export const CONTENT_TRIGGERS = [
  { re: /process\.env|secretsProvider|SecretsProvider|\btoken\b|\bauth\b|password|credential/i, lens: 'security' },
  { re: /\bz\.(object|string|number|enum|union|array)\b/, lens: 'zod' },
];

export function route(files, added) {
  const groups = { frontend: new Set(), backend: new Set(), crosscutting: new Set() };
  const lenses = { frontend: new Set(), backend: new Set(), crosscutting: new Set() };

  for (const f of files) {
    const rule = RULES.find((r) => r.re.test(f.path));
    if (!rule) continue;
    groups[rule.group].add(f.path);
    rule.lenses.forEach((l) => lenses[rule.group].add(l));
  }

  for (const { file, text } of added) {
    if (/^\.claude\/skills\//.test(file)) continue;
    for (const t of CONTENT_TRIGGERS) {
      if (!t.re.test(text)) continue;
      const g = /^client\//.test(file) ? 'frontend' : /^(server|reviewer-core)\//.test(file) ? 'backend' : 'crosscutting';
      groups[g].add(file);
      lenses[g].add(t.lens);
    }
  }

  const out = {};
  for (const g of ['frontend', 'backend', 'crosscutting']) {
    if (!groups[g].size) continue;
    out[g] = { files: [...groups[g]].sort(), lenses: [...lenses[g]].sort() };
  }
  return out;
}

/** Which packages were touched -> which commands the gate must run. */
export function touchedPackages(files) {
  const pkgs = new Set();
  for (const f of files) {
    const m = /^(server|client|reviewer-core|e2e)\//.exec(f.path);
    if (m) pkgs.add(m[1]);
  }
  const cmds = {
    server: ['pnpm typecheck', 'pnpm arch', 'pnpm test'],
    client: ['pnpm typecheck', 'pnpm test'],
    'reviewer-core': ['npm run typecheck', 'npm test'],
    e2e: ['npm run typecheck'],
  };
  return [...pkgs].sort().map((p) => ({ package: p, commands: cmds[p] }));
}
