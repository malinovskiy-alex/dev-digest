/**
 * Ring 3 — the HTTP adapter for the `DevDigestApi` port.
 *
 * The ONLY file that knows URL paths or calls `fetch`. Every path segment is
 * an id the API itself returned, and is still percent-encoded. Transport and
 * HTTP failures become `ToolError`s whose messages name the next step.
 */
import { ToolError } from '../errors.js';
import { clean, oneLine } from '../format.js';
import type { DevDigestApi } from './port.js';
import type {
  ActiveRun,
  Agent,
  ApiErrorBody,
  ApiReview,
  BlastRadius,
  ConventionsView,
  PrMeta,
  Repo,
  RunSummary,
  StartRunResponse,
} from './types.js';

export interface HttpClientOptions {
  /** Base URL without a trailing slash, e.g. http://localhost:3001 */
  baseUrl: string;
  timeoutMs: number;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/** How much of an unexpected error body is quoted back. */
const BODY_EXCERPT_MAX = 200;
/** Caps for the `{ error: { code, message } }` envelope quoted back to the model. */
const ENVELOPE_CODE_MAX = 60;
const ENVELOPE_MESSAGE_MAX = 300;

const seg = (id: string) => encodeURIComponent(id);

export class HttpDevDigestApi implements DevDigestApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = opts.timeoutMs;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  listAgents(signal?: AbortSignal): Promise<Agent[]> {
    return this.request<Agent[]>('GET', '/agents', { signal });
  }

  listRepos(signal?: AbortSignal): Promise<Repo[]> {
    return this.request<Repo[]>('GET', '/repos', { signal });
  }

  listPulls(repoId: string, signal?: AbortSignal): Promise<PrMeta[]> {
    return this.request<PrMeta[]>('GET', `/repos/${seg(repoId)}/pulls`, { signal });
  }

  activeRuns(prId: string, signal?: AbortSignal): Promise<ActiveRun[]> {
    return this.request<ActiveRun[]>('GET', `/pulls/${seg(prId)}/runs/active`, { signal });
  }

  startReview(prId: string, agentId: string, signal?: AbortSignal): Promise<StartRunResponse> {
    return this.request<StartRunResponse>('POST', `/pulls/${seg(prId)}/review`, {
      signal,
      body: { agentId },
      rateLimitHint: 'The API allows 10 runs/min — wait ~60 s, retry once, do not loop.',
    });
  }

  listRuns(prId: string, signal?: AbortSignal): Promise<RunSummary[]> {
    return this.request<RunSummary[]>('GET', `/pulls/${seg(prId)}/runs`, { signal });
  }

  listReviews(prId: string, signal?: AbortSignal): Promise<ApiReview[]> {
    return this.request<ApiReview[]>('GET', `/pulls/${seg(prId)}/reviews`, { signal });
  }

  getConventions(repoId: string, signal?: AbortSignal): Promise<ConventionsView> {
    return this.request<ConventionsView>('GET', `/repos/${seg(repoId)}/conventions`, { signal });
  }

  getBlastRadius(prId: string, signal?: AbortSignal): Promise<BlastRadius> {
    return this.request<BlastRadius>('GET', `/pulls/${seg(prId)}/blast`, { signal });
  }

  // ---- transport ----------------------------------------------------------

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { signal?: AbortSignal | undefined; body?: unknown; rateLimitHint?: string },
  ): Promise<T> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
    const init: RequestInit = {
      method,
      signal,
      headers: { accept: 'application/json', ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    };

    let res: Response;
    let text: string;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, init);
      text = await res.text();
    } catch (err) {
      throw this.transportError(err, timeout, opts.signal);
    }

    if (!res.ok) throw httpError(res.status, text, opts.rateLimitHint);

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ToolError(
        'bad_response',
        `DevDigest API at ${this.baseUrl} returned a non-JSON response for ${method} ${path}. Is DEVDIGEST_API_URL pointing at the DevDigest API?`,
      );
    }
  }

  private transportError(err: unknown, timeout: AbortSignal, caller: AbortSignal | undefined): ToolError {
    if (caller?.aborted) return new ToolError('aborted', 'The request was cancelled by the client.');
    if (timeout.aborted) {
      return new ToolError(
        'http_timeout',
        `DevDigest API did not answer within ${this.timeoutMs} ms. Retry, or raise DEVDIGEST_HTTP_TIMEOUT_MS.`,
      );
    }
    const reason = err instanceof Error ? err.message : String(err);
    return new ToolError(
      'api_down',
      `DevDigest API is not reachable at ${this.baseUrl} (${reason}). Start it: docker compose up -d, then cd server && pnpm dev, or set DEVDIGEST_API_URL.`,
    );
  }
}

function httpError(status: number, text: string, rateLimitHint: string | undefined): ToolError {
  const envelope = parseEnvelope(text);
  if (status === 429) {
    return new ToolError(
      'rate_limited',
      `Rate limited (429). ${rateLimitHint ?? 'Wait ~60 s, retry once, do not loop.'}`,
    );
  }
  if (envelope) {
    // One line, capped: the envelope is API text and reaches the model verbatim otherwise.
    return new ToolError(
      'http_error',
      `${status} ${clean(envelope.error.code, ENVELOPE_CODE_MAX)}: ${clean(envelope.error.message, ENVELOPE_MESSAGE_MAX)}`,
    );
  }
  const excerpt = oneLine(text).slice(0, BODY_EXCERPT_MAX);
  return new ToolError('http_error', `${status} http_error: ${excerpt || 'no response body'}`);
}

function parseEnvelope(text: string): ApiErrorBody | null {
  try {
    const body: unknown = JSON.parse(text);
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'code' in body.error &&
      'message' in body.error &&
      typeof body.error.code === 'string' &&
      typeof body.error.message === 'string'
    ) {
      return { error: { code: body.error.code, message: body.error.message } };
    }
  } catch {
    // not JSON — fall through
  }
  return null;
}
