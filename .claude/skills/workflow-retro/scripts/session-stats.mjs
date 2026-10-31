#!/usr/bin/env node
// Deterministic half of /workflow-retro: reads Claude Code session transcripts
// (~/.claude/projects/<project>/<session>.jsonl and <session>/subagents/*) and
// prints a compact markdown summary — tokens, agents, launch order, tool calls,
// errors and files read by more than one agent. Never prints transcript text.
//
// Usage: node session-stats.mjs [--session <id>|latest] [--project <dir>] [--json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IDLE_GAP_MS = 5 * 60 * 1000; // a gap longer than this is waiting, not work

function parseArgs(argv) {
  const args = { session: 'latest', project: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--session') args.session = argv[++i];
    else if (argv[i] === '--project') args.project = argv[++i];
    else if (argv[i] === '--json') args.json = true;
  }
  if (!args.session || args.session.startsWith('${')) args.session = 'latest';
  return args;
}

function projectDir(explicit) {
  if (explicit) return explicit;
  const slug = process.cwd().replace(/[^a-zA-Z0-9]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', slug);
}

function resolveSession(dir, session) {
  if (session !== 'latest') return session;
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) throw new Error(`no transcripts in ${dir}`);
  return files[0].f.replace(/\.jsonl$/, '');
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

// One API response is split into several records (one per content block) that
// repeat the same usage, so usage is counted once per message id.
function tokenTotals(records) {
  const seen = new Set();
  const t = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, thinking: 0, requests: 0 };
  for (const r of records) {
    if (r.type !== 'assistant' || !r.message?.usage) continue;
    const id = r.message.id ?? r.requestId ?? r.uuid;
    if (seen.has(id)) continue;
    seen.add(id);
    const u = r.message.usage;
    t.input += u.input_tokens ?? 0;
    t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    t.cacheRead += u.cache_read_input_tokens ?? 0;
    t.output += u.output_tokens ?? 0;
    t.thinking += u.output_tokens_details?.thinking_tokens ?? 0;
    t.requests += 1;
  }
  t.totalInput = t.input + t.cacheWrite + t.cacheRead;
  t.cacheHit = t.totalInput ? t.cacheRead / t.totalInput : 0;
  return t;
}

function toolUses(records) {
  const out = [];
  for (const r of records) {
    if (r.type !== 'assistant' || !Array.isArray(r.message?.content)) continue;
    for (const b of r.message.content) if (b.type === 'tool_use') out.push(b);
  }
  return out;
}

function toolErrors(records, uses) {
  const byId = new Map(uses.map((u) => [u.id, u]));
  const out = [];
  for (const r of records) {
    if (r.type !== 'user' || !Array.isArray(r.message?.content)) continue;
    for (const b of r.message.content) {
      if (b.type !== 'tool_result' || !b.is_error) continue;
      const text = typeof b.content === 'string' ? b.content
        : (b.content ?? []).map((c) => c.text ?? '').join(' ');
      out.push({ tool: byId.get(b.tool_use_id)?.name ?? '?', text: text.replace(/\s+/g, ' ').slice(0, 160) });
    }
  }
  return out;
}

function timing(records) {
  const ts = records.map((r) => Date.parse(r.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!ts.length) return { start: null, end: null, activeMs: 0 };
  let active = 0;
  for (let i = 1; i < ts.length; i++) {
    const gap = ts[i] - ts[i - 1];
    if (gap < IDLE_GAP_MS) active += gap;
  }
  return { start: new Date(ts[0]).toISOString(), end: new Date(ts.at(-1)).toISOString(), activeMs: active };
}

// Prompts the agent received after its first one: coordinator messages / resumes.
function followUps(records) {
  return records.filter((r) => r.type === 'user' && typeof r.message?.content === 'string'
    && !r.message.content.startsWith('<system-reminder>')).length - 1;
}

function countBy(list, key) {
  const m = {};
  for (const x of list) m[key(x)] = (m[key(x)] ?? 0) + 1;
  return m;
}

function filePathOf(use) {
  const p = use.input?.file_path ?? use.input?.path;
  return typeof p === 'string' ? path.normalize(p).toLowerCase() : null;
}

function summarize(name, records, meta = {}) {
  const uses = toolUses(records);
  return {
    name,
    type: meta.agentType ?? 'main',
    description: meta.description ?? '',
    model: records.find((r) => r.type === 'assistant')?.message?.model ?? '?',
    tokens: tokenTotals(records),
    timing: timing(records),
    followUps: Math.max(0, followUps(records)),
    tools: countBy(uses, (u) => u.name),
    errors: toolErrors(records, uses),
    reads: [...new Set(uses.filter((u) => u.name === 'Read').map(filePathOf).filter(Boolean))],
    writes: [...new Set(uses.filter((u) => ['Write', 'Edit', 'NotebookEdit'].includes(u.name)).map(filePathOf).filter(Boolean))],
    spawned: uses.filter((u) => u.name === 'Agent' || u.name === 'Task')
      .map((u) => ({ type: u.input?.subagent_type ?? 'general-purpose', description: u.input?.description ?? '' })),
    asked: uses.filter((u) => u.name === 'AskUserQuestion').length,
  };
}

function collect(dir, sessionId) {
  const main = readJsonl(path.join(dir, `${sessionId}.jsonl`));
  const agents = [summarize('main', main)];
  const subDir = path.join(dir, sessionId, 'subagents');
  if (fs.existsSync(subDir)) {
    for (const f of fs.readdirSync(subDir).filter((x) => x.endsWith('.jsonl'))) {
      const id = f.replace(/^agent-/, '').replace(/\.jsonl$/, '');
      const metaFile = path.join(subDir, f.replace(/\.jsonl$/, '.meta.json'));
      const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
      agents.push(summarize(id, readJsonl(path.join(subDir, f)), meta));
    }
  }
  const subs = agents.slice(1).sort((a, b) => (a.timing.start ?? '').localeCompare(b.timing.start ?? ''));

  // Overlapping active windows = agents that ran in parallel.
  for (const a of subs) {
    a.parallelWith = subs.filter((b) => b !== a && b.timing.start < a.timing.end && a.timing.start < b.timing.end)
      .map((b) => b.type);
  }

  const readers = new Map();
  for (const a of agents) for (const p of a.reads) readers.set(p, [...(readers.get(p) ?? []), a.type]);
  const sharedReads = [...readers].filter(([, who]) => who.length > 1)
    .map(([file, who]) => ({ file, who })).sort((x, y) => y.who.length - x.who.length);

  const total = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, totalInput: 0, requests: 0 };
  for (const a of agents) for (const k of Object.keys(total)) total[k] += a.tokens[k];
  total.cacheHit = total.totalInput ? total.cacheRead / total.totalInput : 0;

  return { sessionId, main: agents[0], subagents: subs, total, sharedReads };
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const pct = (x) => `${Math.round(x * 100)}%`;
const mins = (ms) => `${(ms / 60000).toFixed(1)} min`;
const short = (p) => p.replace(process.cwd().toLowerCase(), '.').replace(/\\/g, '/');

function render(s) {
  const out = [];
  const row = (a) => `| ${a.type} | ${a.description || '—'} | ${a.model} | ${k(a.tokens.totalInput)} | ${k(a.tokens.output)} | ${pct(a.tokens.cacheHit)} | ${a.tokens.requests} | ${mins(a.timing.activeMs)} | ${a.followUps} | ${a.errors.length} |`;
  out.push(`# Session ${s.sessionId}`, '');
  out.push(`**Total:** ${k(s.total.totalInput)} input (${k(s.total.cacheRead)} cache read, ${k(s.total.cacheWrite)} cache write, ${k(s.total.input)} uncached) · ${k(s.total.output)} output · ${s.total.requests} API requests · cache hit ${pct(s.total.cacheHit)} · ${s.subagents.length} subagent(s)`, '');
  out.push('## Agents (launch order)', '');
  out.push('| Agent | Task | Model | Input | Output | Cache hit | Requests | Active | Follow-ups | Tool errors |', '|---|---|---|---|---|---|---|---|---|---|');
  out.push(row(s.main));
  s.subagents.forEach((a) => out.push(row(a)));
  out.push('');
  out.push('## Timeline', '');
  s.subagents.forEach((a, i) => out.push(`${i + 1}. ${a.timing.start?.slice(11, 19)}–${a.timing.end?.slice(11, 19)} UTC \`${a.type}\` (${a.name})${a.parallelWith.length ? ` — parallel with ${a.parallelWith.join(', ')}` : ''}${a.spawned.length ? ` — spawned ${a.spawned.map((x) => x.type).join(', ')}` : ''}`));
  if (!s.subagents.length) out.push('_no subagents in this session_');
  out.push('');
  out.push('## Tool calls', '');
  for (const a of [s.main, ...s.subagents]) {
    const t = Object.entries(a.tools).sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} ${c}`).join(' · ');
    out.push(`- **${a.type}:** ${t || 'none'}${a.asked ? ` · asked the user ${a.asked}×` : ''}`);
  }
  out.push('');
  out.push('## Tool errors', '');
  const errs = [s.main, ...s.subagents].flatMap((a) => a.errors.map((e) => `- **${a.type}** \`${e.tool}\`: ${e.text}`));
  out.push(...(errs.length ? errs : ['_none_']), '');
  out.push('## Files read by more than one agent (duplication signal)', '');
  out.push(...(s.sharedReads.length ? s.sharedReads.slice(0, 25).map((r) => `- \`${short(r.file)}\` — ${r.who.join(', ')}`) : ['_none_']), '');
  out.push('## Files written', '');
  const w = [s.main, ...s.subagents].flatMap((a) => a.writes.map((p) => `- \`${short(p)}\` — ${a.type}`));
  out.push(...(w.length ? w : ['_none_']));
  return out.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const dir = projectDir(args.project);
const stats = collect(dir, resolveSession(dir, args.session));
process.stdout.write(args.json ? JSON.stringify(stats, null, 2) : `${render(stats)}\n`);
