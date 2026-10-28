import { describe, expect, it, vi } from 'vitest';
import { HttpDevDigestApi } from '../src/api/http-client.js';
import { ToolError } from '../src/errors.js';

const BASE = 'http://localhost:3001';

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function client(impl: FetchImpl, timeoutMs = 5_000) {
  const fetch = vi.fn(impl);
  const api = new HttpDevDigestApi({ baseUrl: `${BASE}/`, timeoutMs, fetch: fetch as unknown as typeof globalThis.fetch });
  return { api, fetch };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function rejection(p: Promise<unknown>): Promise<ToolError> {
  const err = await p.then(
    () => {
      throw new Error('expected the call to reject');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ToolError);
  return err as ToolError;
}

describe('HttpDevDigestApi', () => {
  it('GETs the right URL (base slash trimmed, ids percent-encoded) and parses JSON', async () => {
    const { api, fetch } = client(async () => json([{ number: 1 }]));
    await expect(api.listPulls('a/b c?#')).resolves.toEqual([{ number: 1 }]);
    await api.activeRuns('p/1');
    await api.listRuns('p 2');
    await api.listReviews('p?3');
    await api.getConventions('r#4');
    await api.getBlastRadius('p/1');
    await api.listAgents();
    await api.listRepos();

    const urls = fetch.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      `${BASE}/repos/a%2Fb%20c%3F%23/pulls`,
      `${BASE}/pulls/p%2F1/runs/active`,
      `${BASE}/pulls/p%202/runs`,
      `${BASE}/pulls/p%3F3/reviews`,
      `${BASE}/repos/r%234/conventions`,
      `${BASE}/pulls/p%2F1/blast`,
      `${BASE}/agents`,
      `${BASE}/repos`,
    ]);
    expect(fetch.mock.calls[0]![1].method).toBe('GET');
    expect(fetch.mock.calls[0]![1].body).toBeUndefined();
  });

  it('POSTs {agentId} as JSON to /pulls/:id/review', async () => {
    const { api, fetch } = client(async () => json({ pr_id: 'p', runs: [], reviews: [] }));
    await api.startReview('p/1', 'agent-uuid');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${BASE}/pulls/p%2F1/review`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ agentId: 'agent-uuid' });
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('API down (fetch rejects) → api_down naming docker compose and DEVDIGEST_API_URL', async () => {
    const { api } = client(async () => {
      throw new TypeError('fetch failed');
    });
    const e = await rejection(api.listAgents());
    expect(e.code).toBe('api_down');
    expect(e.message).toContain('docker compose up -d');
    expect(e.message).toContain('DEVDIGEST_API_URL');
    expect(e.message).toContain(BASE);
  });

  it('a request that outlives timeoutMs → http_timeout naming DEVDIGEST_HTTP_TIMEOUT_MS', async () => {
    const { api } = client(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
        }),
      25,
    );
    const e = await rejection(api.listRepos());
    expect(e.code).toBe('http_timeout');
    expect(e.message).toContain('Retry, or raise DEVDIGEST_HTTP_TIMEOUT_MS');
  });

  it("the caller's abort signal reaches fetch and maps to aborted, not api_down", async () => {
    const ac = new AbortController();
    const { api } = client(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
          ac.abort();
        }),
    );
    const e = await rejection(api.listRepos(ac.signal));
    expect(e.code).toBe('aborted');
  });

  it('429 on startReview → the 10 runs/min hint', async () => {
    const { api } = client(async () => json({ error: { code: 'rate_limited', message: 'slow down' } }, 429));
    const e = await rejection(api.startReview('p', 'a'));
    expect(e.code).toBe('rate_limited');
    expect(e.message).toContain('10 runs/min');
    expect(e.message).toContain('wait ~60 s, retry once, do not loop');
  });

  it("a 4xx/5xx with the API's error envelope passes status, code and message through", async () => {
    const { api } = client(async () =>
      json({ error: { code: 'not_found', message: 'Pull request not found — re-sync the repo' } }, 404),
    );
    const e = await rejection(api.listRuns('p'));
    expect(e.code).toBe('http_error');
    expect(e.message).toBe('404 not_found: Pull request not found — re-sync the repo');
  });

  it('a 5xx without an envelope quotes the body excerpt', async () => {
    const { api } = client(async () => new Response(`Bad Gateway ${'x'.repeat(500)}`, { status: 502 }));
    const e = await rejection(api.listRuns('p'));
    expect(e.code).toBe('http_error');
    expect(e.message.startsWith('502 http_error: Bad Gateway')).toBe(true);
    expect(e.message.length).toBeLessThanOrEqual('502 http_error: '.length + 200);
  });

  it('a 200 with a non-JSON body → bad_response asking whether DEVDIGEST_API_URL is right', async () => {
    const { api } = client(async () => new Response('<html>hello</html>', { status: 200 }));
    const e = await rejection(api.listAgents());
    expect(e.code).toBe('bad_response');
    expect(e.message).toContain('GET /agents');
    expect(e.message).toContain('DEVDIGEST_API_URL');
  });
});
