/**
 * Test-only builders for the onboarding tour's fact set (`TourFacts`). Every
 * field defaults to a small, valid value; a test overrides what it is about.
 */
import type { TourFacts, TaskCandidate } from '../../src/modules/onboarding/facts/helpers.js';

export function makeFacts(over: Partial<TourFacts> = {}): TourFacts {
  return {
    revision: 'sha-1',
    treePaths: ['package.json', 'src/a.ts', 'src/b.ts'],
    indexed: [
      { path: 'src/a.ts', rank: 0.9, percentile: 99, importers: 3 },
      { path: 'src/b.ts', rank: 0.5, percentile: 50, importers: 1 },
    ],
    readingPaths: ['src/a.ts', 'src/b.ts'],
    scanPaths: ['src/a.ts', 'src/b.ts'],
    chains: [['src/a.ts', 'src/b.ts']],
    endpoints: [],
    manifests: [],
    readme: null,
    envExample: null,
    fileCandidates: [],
    commands: [{ id: 'cmd-1', command: 'npm run dev' }],
    stack: { languages: [{ name: 'TypeScript', files: 2 }], frameworks: [], runtime: ['Node.js'] },
    folders: [{ path: 'src', files: 2 }],
    ...over,
  };
}

export function todoCandidate(path: string, line: number, detail = 'fix me'): TaskCandidate {
  return {
    id: `todo:${path}:${line}`,
    kind: 'todo',
    path,
    line,
    pr_number: null,
    pr_title: null,
    detail,
    importers: null,
    top_percent: null,
  };
}

export function prCandidate(n: number, title: string, author = 'dev'): TaskCandidate {
  return {
    id: `open-pr:${n}`,
    kind: 'open-pr',
    path: null,
    line: null,
    pr_number: n,
    pr_title: title,
    detail: author,
    importers: null,
    top_percent: null,
  };
}

/** The text of a rendered fact set with every `<untrusted …>…</untrusted>` block removed. */
export function outsideUntrusted(text: string): string {
  return text.replace(/<untrusted source="[^"]*">\n[\s\S]*?\n<\/untrusted>/g, '');
}

/** The bodies of every untrusted block, joined. */
export function insideUntrusted(text: string): string {
  return [...text.matchAll(/<untrusted source="[^"]*">\n([\s\S]*?)\n<\/untrusted>/g)].map((m) => m[1]).join('\n');
}
