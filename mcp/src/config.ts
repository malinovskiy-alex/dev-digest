/**
 * Ring 3 — the only reader of `process.env`, validated once at startup.
 *
 * Holds no secret: the MCP server talks to a local API that needs no auth
 * header (LocalNoAuthProvider) and never reads ~/.devdigest/secrets.json.
 */
import { isIPv4 } from 'node:net';
import { z } from 'zod/v3';

/** An env var set to "" (e.g. an unset `${VAR:-}` in .mcp.json) counts as unset. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

function tryUrl(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null; // `.url()` already reports it
  }
}

const intInRange = (min: number, max: number, fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).default(fallback));

const ConfigSchema = z.object({
  DEVDIGEST_API_URL: z.preprocess(
    blankToUndefined,
    z
      .string()
      .url()
      .default('http://localhost:3001')
      .refine((u) => {
        const url = tryUrl(u);
        return url === null || url.protocol === 'http:' || url.protocol === 'https:';
      }, { message: 'must be an http:// or https:// URL' })
      .refine((u) => {
        const url = tryUrl(u);
        return url === null || (url.username === '' && url.password === '');
      }, { message: 'must not embed credentials' }),
  ),
  DEVDIGEST_HTTP_TIMEOUT_MS: intInRange(1_000, 120_000, 30_000),
  DEVDIGEST_RUN_WAIT_MS: intInRange(5_000, 1_800_000, 240_000),
  DEVDIGEST_POLL_INTERVAL_MS: intInRange(1_000, 30_000, 3_000),
});

export interface Config {
  /** Origin + optional path prefix, no trailing slash. */
  apiUrl: string;
  httpTimeoutMs: number;
  runWaitMs: number;
  pollIntervalMs: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Invalid configuration — ${issues}`);
  }
  const c = parsed.data;
  return {
    apiUrl: c.DEVDIGEST_API_URL.replace(/\/+$/, ''),
    httpTimeoutMs: c.DEVDIGEST_HTTP_TIMEOUT_MS,
    runWaitMs: c.DEVDIGEST_RUN_WAIT_MS,
    pollIntervalMs: c.DEVDIGEST_POLL_INTERVAL_MS,
  };
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** False when the API URL leaves this machine — worth a warning on stderr. */
export function isLoopbackUrl(apiUrl: string): boolean {
  const host = new URL(apiUrl).hostname.toLowerCase();
  // 127.0.0.0/8 only for a real IPv4 literal — `127.example.com` is a remote name.
  return LOOPBACK_HOSTS.has(host) || (isIPv4(host) && host.startsWith('127.')) || host.endsWith('.localhost');
}
