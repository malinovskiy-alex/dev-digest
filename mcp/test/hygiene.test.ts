/**
 * Hygiene: stdout stays clean, shared stays types-only, the startup budget
 * holds, the tool text is the spec's text, and the rings import inward.
 *
 * The expected strings are parsed from specs/L04-devdigest-mcp.md at test time
 * and compared against what `tools/list` actually sends, never against
 * `TOOL_TEXT` (which would compare the code with itself).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createStderrLogger } from '../src/log.js';
import { createServer } from '../src/server.js';
import { fakeApi } from './fixtures.js';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const SPEC = fileURLToPath(new URL('../../specs/L04-devdigest-mcp.md', import.meta.url));

// ---- source scanning --------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

/** `src`-relative, forward slashes: `tools/get-findings.ts`. */
const FILES = walk(SRC).map((abs) => ({
  rel: relative(SRC, abs).replace(/\\/g, '/'),
  text: readFileSync(abs, 'utf8'),
}));

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

interface ImportStmt {
  kind: 'import' | 'export';
  typeOnly: boolean;
  specifier: string;
  raw: string;
}

/** Static import/export-from statements, including multi-line `{ … }` lists, plus side-effect and dynamic imports. */
function parseImports(code: string): ImportStmt[] {
  const src = stripComments(code);
  const out: ImportStmt[] = [];
  const stmt =
    /^\s*(import|export)\s+(type\s+)?(\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/gm;
  for (const m of src.matchAll(stmt)) {
    out.push({ kind: m[1] as 'import' | 'export', typeOnly: Boolean(m[2]), specifier: m[4]!, raw: m[0] });
  }
  for (const m of src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) {
    out.push({ kind: 'import', typeOnly: false, specifier: m[1]!, raw: m[0] });
  }
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    out.push({ kind: 'import', typeOnly: false, specifier: m[1]!, raw: m[0] });
  }
  return out;
}

const file = (rel: string) => {
  const f = FILES.find((x) => x.rel === rel);
  if (!f) throw new Error(`src/${rel} not found`);
  return f;
};

// ---- spec parsing -----------------------------------------------------------

const specLines = readFileSync(SPEC, 'utf8').split(/\r?\n/);

function tableAfter(headingStartsWith: string): string[][] {
  const start = specLines.findIndex((l) => l.startsWith(headingStartsWith));
  if (start < 0) throw new Error(`spec heading not found: ${headingStartsWith}`);
  const rows: string[][] = [];
  let inTable = false;
  for (const line of specLines.slice(start + 1)) {
    if (line.startsWith('|')) {
      inTable = true;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (/^-+$/.test(cells[0] ?? '')) continue; // separator row
      rows.push(cells);
    } else if (inTable) {
      break;
    }
  }
  return rows.slice(1); // drop the header row
}

const unquote = (s: string) => s.replace(/^`|`$/g, '');
const ALL_TOOLS = ['list_agents', 'run_agent_on_pr', 'get_findings', 'get_conventions', 'get_blast_radius'];

const SPEC_TOOLS = Object.fromEntries(
  tableAfter('### Final descriptions').map(([name, title, description]) => [
    unquote(name!),
    { title: title!, description: description! },
  ]),
);

/** `${tool}.${arg}` → the verbatim `.describe()` string. */
const SPEC_ARGS: Record<string, string> = {};
for (const [arg, tools, describe] of tableAfter('Argument `.describe()` strings')) {
  const names = [...tools!.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!);
  const applies = tools!.startsWith('all except') ? ALL_TOOLS.filter((t) => !names.includes(t)) : names;
  for (const t of applies) SPEC_ARGS[`${t}.${unquote(arg!)}`] = unquote(describe!);
}

const SPEC_INSTRUCTIONS = (() => {
  const at = specLines.findIndex((l) => l.startsWith('Server `instructions`'));
  const quote = specLines.slice(at + 1).find((l) => l.startsWith('> '));
  if (at < 0 || !quote) throw new Error('spec instructions block not found');
  return quote.slice(2);
})();

// ---- the live tool surface --------------------------------------------------

let toolsListRaw = '';
let tools: { name: string; title?: string; description?: string; inputSchema: { properties?: Record<string, { description?: string }> } }[] = [];
let instructions: string | undefined;

beforeAll(async () => {
  const server = createServer({
    api: fakeApi(),
    runWaitMs: 240_000,
    pollIntervalMs: 3_000,
    log: createStderrLogger(() => {}),
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'hygiene', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  // record the raw wire message of the tools/list response
  const raw: string[] = [];
  const deliver = clientSide.onmessage;
  clientSide.onmessage = (m: JSONRPCMessage, extra?: unknown) => {
    raw.push(JSON.stringify(m));
    (deliver as ((m: JSONRPCMessage, e?: unknown) => void) | undefined)?.(m, extra);
  };

  tools = (await client.listTools()).tools;
  instructions = client.getInstructions();
  toolsListRaw = raw.find((r) => r.includes('"tools"')) ?? '';
  await client.close();
});

// ---- tests ------------------------------------------------------------------

describe('hygiene: stdout carries the protocol only', () => {
  it('no console.log / console.info / process.stdout anywhere in src', () => {
    const offenders = FILES.filter((f) => /\bconsole\.(log|info)\b|\bprocess\.stdout\b/.test(stripComments(f.text))).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

describe('hygiene: @devdigest/shared is types-only', () => {
  it('the import parser sees multi-line type imports (self-check)', () => {
    const types = parseImports(file('api/types.ts').text).filter((i) => i.specifier === '@devdigest/shared');
    expect(types).toHaveLength(1);
    expect(types[0]!.typeOnly).toBe(true);
    expect(types[0]!.raw).toContain('\n'); // it really was multi-line

    const bad = parseImports("import {\n  Agent,\n  Repo,\n} from '@devdigest/shared';\nexport { X } from '@devdigest/shared';");
    expect(bad.map((i) => i.typeOnly)).toEqual([false, false]);
  });

  it('every import/export of @devdigest/shared in src is `import type` / `export type`', () => {
    const all = FILES.flatMap((f) => parseImports(f.text).map((i) => ({ ...i, rel: f.rel })));
    const shared = all.filter((i) => i.specifier === '@devdigest/shared' || i.specifier.startsWith('@devdigest/shared/'));
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.filter((i) => !i.typeOnly).map((i) => `${i.rel}: ${i.raw.trim()}`)).toEqual([]);
  });
});

describe('hygiene: startup token budget', () => {
  it('the tools/list response is under 8 000 characters on the wire', () => {
    expect(toolsListRaw).not.toBe('');
    expect(toolsListRaw.length).toBeLessThan(8_000);
  });
});

describe('hygiene: tool text is verbatim from the spec', () => {
  it('the spec tables parsed (5 tools, 13 tool×argument pairs)', () => {
    expect(Object.keys(SPEC_TOOLS).sort()).toEqual([...ALL_TOOLS].sort());
    expect(Object.keys(SPEC_ARGS)).toHaveLength(13);
    expect(SPEC_INSTRUCTIONS.startsWith('DevDigest local PR review.')).toBe(true);
  });

  it('server instructions equal the spec', () => {
    expect(instructions).toBe(SPEC_INSTRUCTIONS);
  });

  it.each(ALL_TOOLS)('%s: title and description equal the spec', (name) => {
    const t = tools.find((x) => x.name === name);
    expect(t).toBeDefined();
    expect(t!.title).toBe(SPEC_TOOLS[name]!.title);
    expect(t!.description).toBe(SPEC_TOOLS[name]!.description);
  });

  it('every argument .describe() equals the spec, and no argument is missing from either side', () => {
    const live: Record<string, string | undefined> = {};
    for (const t of tools) {
      for (const [arg, schema] of Object.entries(t.inputSchema.properties ?? {})) {
        live[`${t.name}.${arg}`] = schema.description;
      }
    }
    expect(Object.keys(live).sort()).toEqual(Object.keys(SPEC_ARGS).sort());
    for (const [key, text] of Object.entries(SPEC_ARGS)) {
      expect({ key, text: live[key] }).toEqual({ key, text });
    }
  });
});

describe('hygiene: ring imports (spec D16)', () => {
  const RING1 = ['format.ts', 'match.ts', 'errors.ts'];
  const RING1_ALLOWED = new Set(['zod', 'zod/v3', '@devdigest/shared', './errors.js', './format.js', './match.js']);

  it.each(RING1)('%s (Ring 1) imports only zod, shared types and other Ring 1 files — and never touches process', (rel) => {
    const f = file(rel);
    const specs = parseImports(f.text).map((i) => i.specifier);
    expect(specs.filter((s) => !RING1_ALLOWED.has(s))).toEqual([]);
    expect(specs.some((s) => s.includes('api/') || s.startsWith('@modelcontextprotocol') || s.startsWith('node:'))).toBe(false);
    expect(stripComments(f.text)).not.toMatch(/\bprocess\b/);
  });

  const RING2 = FILES.map((f) => f.rel).filter(
    (rel) => rel.startsWith('tools/') || rel === 'resolve.ts' || rel === 'wait.ts' || rel === 'api/port.ts' || rel === 'api/types.ts',
  );

  it('found the Ring 2 files', () => {
    expect(RING2).toEqual(expect.arrayContaining(['resolve.ts', 'wait.ts', 'tools/run-agent-on-pr.ts', 'tools/get-findings.ts']));
  });

  it.each(RING2)('%s (Ring 2) imports neither http-client nor the MCP SDK', (rel) => {
    const specs = parseImports(file(rel).text).map((i) => i.specifier);
    expect(specs.filter((s) => /http-client/.test(s) || s.startsWith('@modelcontextprotocol'))).toEqual([]);
  });

  it('only index.ts imports http-client', () => {
    const importers = FILES.filter((f) => parseImports(f.text).some((i) => /(^|\/)http-client(\.js)?$/.test(i.specifier))).map((f) => f.rel);
    expect(importers).toEqual(['index.ts']);
  });
});

// ---- the full ring map (mcp/AGENTS.md "Rings") ------------------------------

type Ring = 1 | 2 | 3 | 4;

/** Every file in src must be listed here; a `/` suffix is a folder prefix. */
const RING_MAP: [string, Ring][] = [
  ['format.ts', 1],
  ['match.ts', 1],
  ['errors.ts', 1],
  ['tools/', 2],
  ['resolve.ts', 2],
  ['wait.ts', 2],
  ['api/port.ts', 2],
  ['api/types.ts', 2],
  ['api/http-client.ts', 3],
  ['config.ts', 3],
  ['log.ts', 3],
  ['server.ts', 4],
  ['index.ts', 4],
];

function ringOf(rel: string): Ring | undefined {
  return RING_MAP.find(([key]) => (key.endsWith('/') ? rel.startsWith(key) : rel === key))?.[1];
}

/** `../errors.js` imported from `tools/x.ts` → `errors.ts`. Undefined for a package specifier. */
function resolveRelative(fromRel: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  return posix.normalize(posix.join(posix.dirname(fromRel), specifier)).replace(/\.js$/, '.ts');
}

/** Package specifiers each ring may use. Ring 4 may use anything. */
const EXTERNAL_ALLOWED: Record<Exclude<Ring, 4>, (s: string) => boolean> = {
  1: (s) => s === 'zod' || s === 'zod/v3' || s === '@devdigest/shared',
  2: (s) => s === 'zod' || s === 'zod/v3' || s === '@devdigest/shared',
  3: (s) => s === 'zod' || s === 'zod/v3' || s === '@devdigest/shared' || s.startsWith('node:'),
};

const IMPORT_EDGES = FILES.flatMap((f) =>
  parseImports(f.text).map((i) => ({ from: f.rel, specifier: i.specifier, to: resolveRelative(f.rel, i.specifier) })),
);

describe('hygiene: ring map covers src and every import points inward (spec D16)', () => {
  it('every file in src has a ring — a new unmapped file fails here', () => {
    expect(FILES.filter((f) => ringOf(f.rel) === undefined).map((f) => f.rel)).toEqual([]);
  });

  it('every relative import resolves to an existing src file in the same or an inner ring', () => {
    const known = new Set(FILES.map((f) => f.rel));
    const internal = IMPORT_EDGES.filter((e) => e.to !== undefined);
    expect(internal.length).toBeGreaterThan(20); // the parser really saw the graph
    const missing = internal.filter((e) => !known.has(e.to!)).map((e) => `${e.from} → ${e.specifier}`);
    expect(missing).toEqual([]);
    const outward = internal
      .filter((e) => ringOf(e.to!)! > ringOf(e.from)!)
      .map((e) => `${e.from} (ring ${ringOf(e.from)}) → ${e.to} (ring ${ringOf(e.to!)})`);
    expect(outward).toEqual([]);
  });

  it('package imports stay within each ring’s allowlist (Ring 1/2: zod + shared types only; no SDK, no node:* below Ring 3)', () => {
    const bad = IMPORT_EDGES.filter((e) => e.to === undefined)
      .filter((e) => {
        const ring = ringOf(e.from)!;
        return ring !== 4 && !EXTERNAL_ALLOWED[ring](e.specifier);
      })
      .map((e) => `${e.from} → ${e.specifier}`);
    expect(bad).toEqual([]);
  });

  it('Ring 2 imports none of config.ts, log.ts, server.ts, index.ts, api/http-client.ts', () => {
    const forbidden = new Set(['config.ts', 'log.ts', 'server.ts', 'index.ts', 'api/http-client.ts']);
    const bad = IMPORT_EDGES.filter((e) => ringOf(e.from) === 2 && e.to !== undefined && forbidden.has(e.to)).map(
      (e) => `${e.from} → ${e.specifier}`,
    );
    expect(bad).toEqual([]);
  });

  it('Ring 3 imports nothing from Ring 4', () => {
    const bad = IMPORT_EDGES.filter((e) => ringOf(e.from) === 3 && e.to !== undefined && ringOf(e.to) === 4).map(
      (e) => `${e.from} → ${e.specifier}`,
    );
    expect(bad).toEqual([]);
  });

  it('Ring 1 has no async/await', () => {
    const bad = FILES.filter((f) => ringOf(f.rel) === 1 && /\b(async|await)\b/.test(stripComments(f.text))).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('fetch( appears only in api/http-client.ts', () => {
    const bad = FILES.filter((f) => f.rel !== 'api/http-client.ts' && /\bfetch\s*\(/.test(stripComments(f.text))).map((f) => f.rel);
    expect(bad).toEqual([]);
  });

  it('process.env appears only in config.ts', () => {
    const users = FILES.filter((f) => /\bprocess\.env\b/.test(stripComments(f.text))).map((f) => f.rel);
    expect(users).toEqual(['config.ts']);
  });
});
