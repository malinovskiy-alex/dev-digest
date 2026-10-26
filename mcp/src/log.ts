/**
 * Ring 3 — the only logger. Writes to STDERR, never stdout: stdout carries the
 * JSON-RPC protocol (spec D15), and one stray byte there breaks the client.
 *
 * Never pass secrets or full request bodies here.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createStderrLogger(write: (line: string) => void = (l) => process.stderr.write(l)): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const tail = meta && Object.keys(meta).length > 0 ? ` ${safeJson(meta)}` : '';
    write(`[devdigest-mcp] ${new Date().toISOString()} ${level} ${msg}${tail}\n`);
  };
  return {
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[unserializable]"';
  }
}

export const log: Logger = createStderrLogger();
