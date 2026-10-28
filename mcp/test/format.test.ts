import { describe, expect, it } from 'vitest';
import {
  compactAgents,
  compactBlast,
  compactConventions,
  compactReview,
  renderBlastText,
  renderConventionsText,
  renderReviewText,
  type ConventionLike,
} from '../src/format.js';
import { makeAgent, makeBlast, makeFinding, makeReview } from './fixtures.js';

const WHERE = { repo: 'acme/api', pr: 42 };

function convention(over: Partial<ConventionLike> = {}): ConventionLike {
  return {
    id: 'c-1',
    category: 'naming',
    rule: 'Use kebab-case file names.',
    evidence_path: 'src/a.ts',
    evidence_start_line: 3,
    evidence_end_line: 7,
    status: 'accepted',
    ...over,
  };
}

describe('compactReview', () => {
  it('orders CRITICAL→WARNING→SUGGESTION, then file, then line; drops dismissed but counts them', () => {
    const review = makeReview({
      findings: [
        makeFinding({ id: 'sug-a', severity: 'SUGGESTION', file: 'a.ts', start_line: 1 }),
        makeFinding({ id: 'warn-b-9', severity: 'WARNING', file: 'b.ts', start_line: 9 }),
        makeFinding({ id: 'crit-z', severity: 'CRITICAL', file: 'z.ts', start_line: 1 }),
        makeFinding({ id: 'warn-b-2', severity: 'WARNING', file: 'b.ts', start_line: 2 }),
        makeFinding({ id: 'warn-a', severity: 'WARNING', file: 'a.ts', start_line: 50 }),
        makeFinding({ id: 'crit-a', severity: 'CRITICAL', file: 'a.ts', start_line: 100 }),
        makeFinding({ id: 'gone', severity: 'CRITICAL', file: 'a.ts', start_line: 1, dismissed_at: '2026-10-02T00:00:00Z' }),
      ],
    });

    const r = compactReview(review, WHERE);

    expect(r.findings.map((f) => f.id)).toEqual(['crit-a', 'crit-z', 'warn-a', 'warn-b-2', 'warn-b-9', 'sug-a']);
    expect(r.dismissed).toBe(1);
    expect(r.counts).toEqual({ CRITICAL: 2, WARNING: 3, SUGGESTION: 1 });
    expect(r.shown).toBe(6);
    expect(r.total).toBe(6);
    expect(r.next).toBeUndefined();
    expect(r.status).toBe('done');
    // Only the concise fields — suggestion/evidence/confidence are dropped.
    expect(Object.keys(r.findings[0]!).sort()).toEqual(
      ['category', 'end_line', 'file', 'id', 'line', 'message', 'severity', 'title'].sort(),
    );
  });

  it('computes counts before limit and min_severity, and says how to get the rest', () => {
    const findings = [
      ...Array.from({ length: 3 }, () => makeFinding({ severity: 'CRITICAL' })),
      ...Array.from({ length: 20 }, () => makeFinding({ severity: 'WARNING' })),
      ...Array.from({ length: 2 }, () => makeFinding({ severity: 'SUGGESTION' })),
    ];
    const review = makeReview({ run_id: 'run-7', findings });

    const byDefault = compactReview(review, WHERE);
    expect(byDefault.shown).toBe(20);
    expect(byDefault.total).toBe(25);
    expect(byDefault.counts).toEqual({ CRITICAL: 3, WARNING: 20, SUGGESTION: 2 });
    expect(byDefault.next).toBe(
      '5 more finding(s) not shown — call get_findings with run_id="run-7" limit=25, or narrow with min_severity.',
    );

    const warningUp = compactReview(review, { ...WHERE, minSeverity: 'WARNING', limit: 5 });
    expect(warningUp.findings.every((f) => f.severity !== 'SUGGESTION')).toBe(true);
    expect(warningUp.total).toBe(23);
    expect(warningUp.shown).toBe(5);
    expect(warningUp.findings.slice(0, 3).map((f) => f.severity)).toEqual(['CRITICAL', 'CRITICAL', 'CRITICAL']);
    // counts still describe the whole review
    expect(warningUp.counts).toEqual({ CRITICAL: 3, WARNING: 20, SUGGESTION: 2 });

    const critical = compactReview(review, { ...WHERE, minSeverity: 'CRITICAL' });
    expect(critical.total).toBe(3);
    expect(critical.next).toBeUndefined();
  });

  it('at the max limit, next points at min_severity or the UI instead of a bigger limit', () => {
    const review = makeReview({
      run_id: null,
      findings: Array.from({ length: 120 }, () => makeFinding({ severity: 'SUGGESTION' })),
    });
    const r = compactReview(review, { ...WHERE, limit: 100 });
    expect(r.shown).toBe(100);
    expect(r.next).toBe('20 more finding(s) not shown — narrow with min_severity, or open the PR in the DevDigest UI.');
  });

  it('cuts message to 280 and summary to 500 characters, collapsing whitespace in the message', () => {
    const exact = 'x'.repeat(280);
    const review = makeReview({
      summary: 's'.repeat(600),
      findings: [
        makeFinding({ id: 'long', severity: 'CRITICAL', rationale: 'r'.repeat(400) }),
        makeFinding({ id: 'exact', severity: 'WARNING', rationale: exact }),
        makeFinding({ id: 'ws', severity: 'SUGGESTION', rationale: 'line one\n\n  line   two ' }),
      ],
    });
    const r = compactReview(review, WHERE);
    const byId = Object.fromEntries(r.findings.map((f) => [f.id, f.message]));

    expect(byId.long).toHaveLength(280);
    expect(byId.long!.endsWith('…')).toBe(true);
    expect(byId.exact).toBe(exact); // at the limit: untouched
    expect(byId.ws).toBe('line one line two');
    expect(r.summary).toHaveLength(500);
    expect(r.summary!.endsWith('…')).toBe(true);
  });

  it('renders the spec header line, one line per finding, then next', () => {
    const findings = [
      ...Array.from({ length: 2 }, (_, i) => makeFinding({ severity: 'CRITICAL', file: 'src/x.ts', start_line: i + 1, title: `T${i}`, rationale: `M${i}` })),
      ...Array.from({ length: 5 }, () => makeFinding({ severity: 'WARNING' })),
      ...Array.from({ length: 3 }, () => makeFinding({ severity: 'SUGGESTION' })),
    ];
    const r = compactReview(makeReview({ agent_name: 'security', verdict: 'request_changes', score: 41, findings }), {
      ...WHERE,
      limit: 2,
    });
    const lines = renderReviewText(r).split('\n');
    expect(lines[0]).toBe('acme/api#42 · security · request_changes · score 41 · 2 CRITICAL 5 WARNING 3 SUGGESTION');
    expect(lines[1]).toBe('CRITICAL bug src/x.ts:1 — T0: M0');
    expect(lines[2]).toBe('CRITICAL bug src/x.ts:2 — T1: M1');
    expect(lines[3]).toBe(r.next);
    expect(lines).toHaveLength(4);
  });
});

describe('compactAgents', () => {
  it('returns only id/name/description/enabled/model and cuts description to 160', () => {
    const r = compactAgents([makeAgent({ description: 'd'.repeat(300), enabled: false })]);
    const a = r.agents[0]!;
    expect(Object.keys(a).sort()).toEqual(['description', 'enabled', 'id', 'model', 'name']);
    expect(a.description).toHaveLength(160);
    expect(a.description.endsWith('…')).toBe(true);
    expect(a.enabled).toBe(false);
    expect(JSON.stringify(r)).not.toContain('SECRET SYSTEM PROMPT');
  });
});

describe('compactConventions', () => {
  it('keeps accepted conventions only, formats evidence as path:start-end, and truncates with next', () => {
    const view = {
      scan: { sample_count: 12, created_at: '2026-09-30T00:00:00Z' },
      candidates: [
        convention({ id: 'a1' }),
        convention({ id: 'r1', status: 'rejected' }),
        convention({ id: 'a2', evidence_path: 'lib/b.ts', evidence_start_line: 10, evidence_end_line: 12 }),
        convention({ id: 'a3' }),
      ],
    };

    const all = compactConventions(view, { repo: 'acme/api' });
    expect(all.conventions.map((c) => c.id)).toEqual(['a1', 'a2', 'a3']);
    expect(all.conventions[1]!.evidence).toBe('lib/b.ts:10-12');
    expect(all).toMatchObject({ scanned_at: '2026-09-30T00:00:00Z', sample_count: 12, total: 3, shown: 3 });
    expect(all.next).toBeUndefined();

    const two = compactConventions(view, { repo: 'acme/api', limit: 2 });
    expect(two.shown).toBe(2);
    expect(two.total).toBe(3);
    expect(two.next).toBe('1 more convention(s) not shown — call get_conventions with limit=3.');
  });

  it('defaults the limit to 30', () => {
    const view = {
      scan: { sample_count: 1, created_at: 'x' },
      candidates: Array.from({ length: 35 }, (_, i) => convention({ id: `c${i}` })),
    };
    const r = compactConventions(view, { repo: 'acme/api' });
    expect(r.shown).toBe(30);
    expect(r.total).toBe(35);
  });

  it('scan:null → empty list with a next step (not an error)', () => {
    const r = compactConventions({ scan: null, candidates: [convention()] }, { repo: 'acme/api' });
    expect(r).toMatchObject({ repo: 'acme/api', scanned_at: null, sample_count: 0, total: 0, shown: 0, conventions: [] });
    expect(r.next).toContain('has not been scanned');
    expect(renderConventionsText(r).split('\n')[0]).toBe('acme/api · no conventions scan');
  });
});

describe('compactBlast', () => {
  it('keeps every entry and count — nothing is capped', () => {
    const callers = Array.from({ length: 150 }, (_, i) => ({ name: `c${i}`, file: `f${i}.ts`, line: i + 1, endpoints: [], crons: [] }));
    const b = makeBlast({
      downstream: [{ symbol: 'hub', callers, endpoints_affected: ['GET /a'], crons_affected: [] }],
      counts: { symbols: 2, callers: 150, endpoints: 1, crons: 0 },
    });
    const r = compactBlast(b, WHERE);
    expect(r.downstream[0]!.callers).toHaveLength(150);
    expect(r.counts).toEqual({ symbols: 2, callers: 150, endpoints: 1, crons: 0 });
    expect(r.changed_symbols).toHaveLength(2);
    expect(r.next).toBeUndefined();
  });

  it('renders the no-callers line', () => {
    const r = compactBlast(makeBlast({ downstream: [], summary: '2 symbols changed · no downstream callers' }), WHERE);
    expect(renderBlastText(r).split('\n')).toEqual([
      'acme/api#42 · 2 symbols changed · no downstream callers',
      'No downstream callers found.',
    ]);
  });
});
