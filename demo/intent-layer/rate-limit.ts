/** Demo only — exercises the Intent Layer. Not wired into the app. */
const WINDOW_MS = 60_000;
const LIMIT = 100;

const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > LIMIT) return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  return { ok: true };
}
