/**
 * The full tool surface: a real SDK `Client` ↔ `createServer` over the SDK's
 * in-memory transport, with a fake `DevDigestApi`. No network.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DevDigestApi } from '../src/api/port.js';
import { HttpDevDigestApi } from '../src/api/http-client.js';
import { BlastResultSchema, ConventionsResultSchema, ReviewResultSchema } from '../src/format.js';
import { createStderrLogger } from '../src/log.js';
import { createServer } from '../src/server.js';
import { AGENT_ID, fakeApi, makeFinding, makeReview, makeRun, RUN_ID, virtualClock } from './fixtures.js';

const open: Client[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.close()));
});

async function connect(api: DevDigestApi, runWaitMs = 240_000) {
  const stderr: string[] = [];
  const clock = virtualClock();
  const server = createServer({
    api,
    runWaitMs,
    pollIntervalMs: 3_000,
    log: createStderrLogger((line) => stderr.push(line)),
    now: clock.now,
    sleep: clock.sleep,
  });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  open.push(client);
  return { client, stderr };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  return (await client.callTool({ name, arguments: args })) as CallToolResult;
}

const text = (r: CallToolResult) => r.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n');

describe('MCP tool surface', () => {
  it('lists exactly the 5 tools with their annotations; run_agent_on_pr is the only non-read-only one', async () => {
    const { client } = await connect(fakeApi());
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

    expect(tools.map((t) => t.name).sort()).toEqual(
      ['get_blast_radius', 'get_conventions', 'get_findings', 'list_agents', 'run_agent_on_pr'].sort(),
    );
    expect(tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => t.name)).toEqual(['run_agent_on_pr']);
    expect(byName.run_agent_on_pr!.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect(byName.list_agents!.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
    for (const n of ['get_findings', 'get_conventions', 'get_blast_radius']) {
      expect(byName[n]!.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
    }
    // get_blast_radius omits its outputSchema to stay inside the tools/list budget
    // (server.ts); its structuredContent is checked against BlastResultSchema below.
    expect(byName.get_blast_radius!.outputSchema).toBeUndefined();
    for (const n of ['list_agents', 'run_agent_on_pr', 'get_findings', 'get_conventions']) {
      expect(byName[n]!.outputSchema).toBeDefined();
    }
    // flat arguments only: every property is a scalar or an enum
    for (const t of tools) {
      for (const prop of Object.values(t.inputSchema.properties ?? {}) as { type?: string }[]) {
        expect(['string', 'integer', 'number']).toContain(prop.type);
      }
    }
  });

  it('happy path: run_agent_on_pr returns structuredContent + one compact text block', async () => {
    const api = fakeApi({
      runsSequence: [[makeRun({ status: 'running' })], [makeRun({ status: 'done' })]],
      reviews: [makeReview({ findings: [makeFinding({ id: 'f1', severity: 'CRITICAL', file: 'src/x.ts', start_line: 7 })] })],
    });
    const { client } = await connect(api);

    const res = await call(client, 'run_agent_on_pr', { repo: 'acme/api', pr: 42, agent: 'security' });

    expect(res.isError).not.toBe(true);
    const data = ReviewResultSchema.parse(res.structuredContent);
    expect(data).toMatchObject({ repo: 'acme/api', pr: 42, run_id: RUN_ID, status: 'done', verdict: 'request_changes' });
    expect(data.findings.map((f) => f.id)).toEqual(['f1']);
    expect(api.startReview).toHaveBeenCalledWith(expect.any(String), AGENT_ID, expect.anything());
    expect(res.content).toHaveLength(1);
    expect(text(res).split('\n')[0]).toBe(
      'acme/api#42 · security · request_changes · score 41 · 1 CRITICAL 0 WARNING 0 SUGGESTION',
    );
    // concise text, not a JSON dump
    expect(text(res).trimStart().startsWith('{')).toBe(false);
  });

  it('D11: an in-flight run is reused — no second POST', async () => {
    const api = fakeApi({
      active: [{ run_id: 'run-old', agent_id: AGENT_ID, agent_name: 'security', ran_at: null }],
      runsSequence: [[makeRun({ run_id: 'run-old', status: 'done' })]],
      reviews: [makeReview({ run_id: 'run-old' })],
    });
    const { client } = await connect(api);
    const res = await call(client, 'run_agent_on_pr', { repo: 'acme/api', pr: 42, agent: 'security' });
    expect(res.isError).not.toBe(true);
    expect(res.structuredContent).toMatchObject({ reused_run: true, run_id: 'run-old' });
    expect(api.startReview).not.toHaveBeenCalled();
  });

  it('timeout → status running with run_id, NOT isError', async () => {
    const api = fakeApi({ runsSequence: [[makeRun({ status: 'running' })]] });
    const { client } = await connect(api, 6_000);
    const res = await call(client, 'run_agent_on_pr', { repo: 'acme/api', pr: 42, agent: 'security' });
    expect(res.isError).not.toBe(true);
    expect(res.structuredContent).toMatchObject({ status: 'running', run_id: RUN_ID });
    expect(text(res)).toContain('get_findings');
  });

  it('sends progress notifications when the client asks for them', async () => {
    const api = fakeApi({ runsSequence: [[makeRun({ status: 'running' })], [makeRun({ status: 'running' })], [makeRun({ status: 'done' })]] });
    const { client } = await connect(api);
    const onprogress = vi.fn();
    const res = (await client.callTool(
      { name: 'run_agent_on_pr', arguments: { repo: 'acme/api', pr: 42, agent: 'security' } },
      undefined,
      { onprogress },
    )) as CallToolResult;
    expect(res.isError).not.toBe(true);
    expect(onprogress).toHaveBeenCalledTimes(2);
    expect(onprogress.mock.calls[0]![0]).toMatchObject({ progress: 1 });
  });

  it('unknown agent → isError whose text names list_agents', async () => {
    const api = fakeApi();
    const { client } = await connect(api);
    const res = await call(client, 'run_agent_on_pr', { repo: 'acme/api', pr: 42, agent: 'nobody' });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('list_agents');
    expect(api.startReview).not.toHaveBeenCalled();
  });

  it('API down → isError whose text names DEVDIGEST_API_URL; the server keeps answering', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const api = new HttpDevDigestApi({ baseUrl: 'http://localhost:3001', timeoutMs: 1_000, fetch: fetch as unknown as typeof globalThis.fetch });
    const { client } = await connect(api);

    const res = await call(client, 'list_agents');
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('DEVDIGEST_API_URL');

    // still alive: a second call is answered too
    const again = await call(client, 'get_findings', { repo: 'acme/api', pr: 1 });
    expect(again.isError).toBe(true);
    expect(text(again)).toContain('DEVDIGEST_API_URL');
  });

  it('get_blast_radius → structuredContent that passes BlastResultSchema', async () => {
    const { client } = await connect(fakeApi());
    const res = await call(client, 'get_blast_radius', { repo: 'acme/api', pr: 42 });
    expect(res.isError).not.toBe(true);
    const data = BlastResultSchema.parse(res.structuredContent);
    expect(data.counts).toEqual({ symbols: 2, callers: 2, endpoints: 1, crons: 1 });
    expect(data.downstream[0]!.callers.map((c) => `${c.file}:${c.line}`)).toEqual([
      'src/a/routes.ts:12',
      'src/b/jobs.ts:4',
    ]);
    expect(text(res)).toContain('getContext — 2 callers');
  });

  it('get_conventions with scan:null is a result with next, not an error', async () => {
    const { client } = await connect(fakeApi({ conventions: { scan: null, candidates: [] } }));
    const res = await call(client, 'get_conventions', { repo: 'acme/api' });
    expect(res.isError).not.toBe(true);
    const data = ConventionsResultSchema.parse(res.structuredContent);
    expect(data.conventions).toEqual([]);
    expect(data.next).toBeDefined();
  });

  it('list_agents never returns system_prompt', async () => {
    const { client } = await connect(fakeApi());
    const res = await call(client, 'list_agents');
    expect(res.isError).not.toBe(true);
    expect(JSON.stringify(res)).not.toContain('SECRET SYSTEM PROMPT');
    expect(JSON.stringify(res)).not.toContain('system_prompt');
  });

  it('an unexpected (non-ToolError) failure becomes isError, with the stack on stderr only', async () => {
    const api = fakeApi();
    api.listAgents.mockRejectedValueOnce(new RangeError('kaboom'));
    const { client, stderr } = await connect(api);
    const res = await call(client, 'list_agents');
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('kaboom');
    expect(text(res)).not.toMatch(/\n\s+at /); // no stack trace in the result
    expect(stderr.join('')).toContain('RangeError');
  });
});
