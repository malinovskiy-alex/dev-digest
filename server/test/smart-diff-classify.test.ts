import { describe, it, expect } from 'vitest';
import { SmartDiffRole } from '@devdigest/shared';
import { classifyFile } from '../src/modules/reviews/smart-diff/helpers.js';
import { ROLE_ORDER } from '../src/modules/reviews/smart-diff/constants.js';

/**
 * The Smart Diff classifier, as a table. Rules are checked in precedence
 * order boilerplate → tests → wiring → docs, with core as the fallback — which
 * is NOT the display order (`ROLE_ORDER`).
 */
describe('classifyFile', () => {
  // Precedence: boilerplate before tests. A snapshot lives in a test folder
  // but is generated output, so it is skimmed, not reviewed.
  it('★ __tests__/__snapshots__/x.snap is boilerplate (boilerplate beats tests)', () => {
    expect(classifyFile('__tests__/__snapshots__/x.snap')).toBe('boilerplate');
  });

  // Precedence: wiring before docs. A skill is markdown, but it configures the
  // agent tooling rather than explaining the change.
  it('★ .claude/skills/security/SKILL.md is wiring (wiring beats docs)', () => {
    expect(classifyFile('.claude/skills/security/SKILL.md')).toBe('wiring');
  });

  // Precedence: tests before docs. Anything under e2e/ is test material,
  // including its README.
  it('★ e2e/README.md is tests (tests beats docs)', () => {
    expect(classifyFile('e2e/README.md')).toBe('tests');
  });

  const table: [string, SmartDiffRole][] = [
    // lock-files (S2)
    ['pnpm-lock.yaml', 'boilerplate'],
    ['server/pnpm-lock.yaml', 'boilerplate'],
    ['package-lock.json', 'boilerplate'],
    ['yarn.lock', 'boilerplate'],
    ['Cargo.lock', 'boilerplate'],
    // generated / build output
    ['dist/index.js', 'boilerplate'],
    ['build/app.js', 'boilerplate'],
    ['src/api.generated.ts', 'boilerplate'],
    ['public/vendor.min.js', 'boilerplate'],
    // build/ matches only as the first segment (D-12)
    ['src/build/plan.ts', 'core'],
    // tests
    ['src/billing/discount.test.ts', 'tests'],
    ['server/test/reviews.it.test.ts', 'tests'],
    ['src/a.spec.tsx', 'tests'],
    ['src/__tests__/a.ts', 'tests'],
    ['e2e/specs/05-pr-diff.flow.json', 'tests'],
    // test/spec patterns also match .js/.jsx (decision 3, kept)
    ['src/legacy/util.test.js', 'tests'],
    ['src/legacy/Widget.spec.jsx', 'tests'],
    // wiring
    ['src/components/index.ts', 'wiring'],
    ['vitest.config.ts', 'wiring'],
    ['tsconfig.json', 'wiring'],
    ['tsconfig.build.json', 'wiring'],
    ['.eslintrc.json', 'wiring'],
    ['.env.example', 'wiring'],
    ['docker-compose.yml', 'wiring'],
    ['.github/workflows/ci.yml', 'wiring'],
    // package.json is wiring at any depth (D-10, kept)
    ['package.json', 'wiring'],
    ['client/package.json', 'wiring'],
    // docs
    ['README.md', 'docs'],
    ['CHANGELOG.md', 'docs'],
    ['LICENSE', 'docs'],
    ['server/docs/overview.png', 'docs'],
    ['specs/L04-smart-diff.md', 'docs'],
    // core
    ['src/config.ts', 'core'],
    ['src/api/routes.ts', 'core'],
    // backslash normalisation (D-12)
    ['src\\billing\\x.test.ts', 'tests'],
  ];

  it.each(table)('%s → %s', (path, role) => {
    expect(classifyFile(path)).toBe(role);
  });
});

describe('ROLE_ORDER', () => {
  it('is the display order and covers exactly the contract roles', () => {
    expect(ROLE_ORDER).toEqual(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
    expect([...ROLE_ORDER].sort()).toEqual([...SmartDiffRole.options].sort());
  });
});
