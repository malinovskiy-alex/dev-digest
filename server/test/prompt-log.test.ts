/**
 * Prompt-assembly logging — what reaches the log, and when the local-only
 * verbose line is allowed. The point of the design is that no prompt text can
 * be logged in any mode; these tests pin that.
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '@devdigest/reviewer-core';
import { logPromptAssembly } from '../src/platform/prompt-log.js';
import { loadConfig } from '../src/platform/config.js';
import { buildClassifierInput } from '../src/modules/reviews/intent/sources.js';

const DIFF = '+const apiKey = "sk-live-DO-NOT-LOG";';
const SPEC = 'PRIVATE SPEC: acquisition of Acme closes in Q4';

function capture() {
  const lines: { obj: Record<string, unknown>; msg?: string }[] = [];
  return {
    lines,
    sink: { info: (obj: unknown, msg?: string) => lines.push({ obj: obj as Record<string, unknown>, msg }) },
  };
}

const ctx = {
  correlationId: 'run-123',
  kind: 'review' as const,
  provider: 'openrouter',
  model: 'deepseek/deepseek-v4-flash',
  prId: 'pr-1',
  runId: 'run-123',
  agent: 'Security Reviewer',
  chunk: { index: 0, total: 1, label: 'src/secret-path.ts' },
};

describe('logPromptAssembly', () => {
  const { sections } = assemblePrompt({ system: 'sys', specs: [SPEC], prDescription: 'author text', diff: DIFF });

  it('writes one prompt.assembled line with model, correlation id and per-section sizes', () => {
    const { lines, sink } = capture();
    logPromptAssembly(sink, ctx, sections, false);
    expect(lines).toHaveLength(1);
    const o = lines[0]!.obj;
    expect(o).toMatchObject({
      event: 'prompt.assembled',
      correlation_id: 'run-123',
      kind: 'review',
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      run_id: 'run-123',
      chunk: { index: 0, total: 1 },
    });
    expect((o.sections as { name: string }[]).map((s) => s.name)).toEqual([
      'system',
      'pr_description',
      'specs',
      'diff',
    ]);
    expect(o.total_chars).toBe(sections.reduce((n, s) => n + s.chars, 0));
    // The chunk label (a file path) is verbose-only.
    expect(JSON.stringify(o)).not.toContain('secret-path');
  });

  it('never logs the diff, a spec or the description — in either mode', () => {
    for (const verbose of [false, true]) {
      const { lines, sink } = capture();
      logPromptAssembly(sink, ctx, sections, verbose);
      const all = JSON.stringify(lines);
      expect(all).not.toContain('sk-live');
      expect(all).not.toContain('Acme');
      expect(all).not.toContain('author text');
    }
  });

  it('adds the detail line only in verbose mode', () => {
    const { lines, sink } = capture();
    logPromptAssembly(sink, ctx, sections, true);
    expect(lines.map((l) => l.obj.event)).toEqual(['prompt.assembled', 'prompt.assembled.detail']);
    const detail = lines[1]!.obj;
    expect(detail.chunk_label).toBe('src/secret-path.ts');
    expect((detail.sections as { fingerprint: string }[]).every((s) => /^[0-9a-f]{8}$/.test(s.fingerprint))).toBe(true);
  });

  it('logs the intent classifier prompt from metadata only', () => {
    const { sections: intentSections } = buildClassifierInput({
      title: 'Add limiter',
      description: 'We need this because of abuse',
      meaningfulDescription: true,
      ticket: null,
      specs: [{ path: 'specs/plan.md', content: SPEC }],
      branch: 'feat/limiter',
      commits: ['feat: limiter'],
      files: [{ path: 'src/limiter.ts', additions: 10, deletions: 0 }],
      hunks: [],
      unavailable: [],
    } as Parameters<typeof buildClassifierInput>[0]);
    const { lines, sink } = capture();
    logPromptAssembly(sink, { ...ctx, kind: 'intent' }, intentSections, true);
    const all = JSON.stringify(lines);
    expect(all).not.toContain('Acme');
    expect(all).not.toContain('abuse');
    expect((lines[0]!.obj.sections as { name: string }[]).map((s) => s.name)).toContain('spec-0');
  });

  it('is a no-op without a logger', () => {
    expect(() => logPromptAssembly(undefined, ctx, sections, true)).not.toThrow();
  });
});

describe('PROMPT_LOG_VERBOSE is local-only', () => {
  const base = { DATABASE_URL: 'postgres://x', PROMPT_LOG_VERBOSE: 'true' };

  it('is honoured in development', () => {
    const c = loadConfig({ ...base, NODE_ENV: 'development' });
    expect(c.promptLogVerbose).toBe(true);
    expect(c.promptLogVerboseRefused).toBe(false);
  });

  it('is refused in production and test', () => {
    for (const NODE_ENV of ['production', 'test'] as const) {
      const c = loadConfig({ ...base, NODE_ENV });
      expect(c.promptLogVerbose).toBe(false);
      expect(c.promptLogVerboseRefused).toBe(true);
    }
  });

  it('is off by default', () => {
    const c = loadConfig({ DATABASE_URL: 'postgres://x', NODE_ENV: 'development' });
    expect(c.promptLogVerbose).toBe(false);
    expect(c.promptLogVerboseRefused).toBe(false);
  });
});
