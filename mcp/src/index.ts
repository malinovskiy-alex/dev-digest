#!/usr/bin/env node
/**
 * Ring 4 — composition root and entry point: `node dist/index.js`.
 *
 * The one place that says `new` on an adapter: config → HTTP adapter →
 * McpServer → stdio transport. stdout belongs to JSON-RPC from the moment the
 * transport connects; everything human-readable goes to stderr via `log`.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HttpDevDigestApi } from './api/http-client.js';
import { isLoopbackUrl, loadConfig } from './config.js';
import { log } from './log.js';
import { createServer, SERVER_VERSION } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const apiOrigin = new URL(config.apiUrl).origin;
  if (!isLoopbackUrl(config.apiUrl)) {
    log.warn('DEVDIGEST_API_URL is not a loopback address — tool calls will leave this machine', {
      api: apiOrigin,
    });
  }

  const api = new HttpDevDigestApi({ baseUrl: config.apiUrl, timeoutMs: config.httpTimeoutMs });
  const server = createServer({
    api,
    runWaitMs: config.runWaitMs,
    pollIntervalMs: config.pollIntervalMs,
    log,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info(`devdigest-mcp ${SERVER_VERSION} ready on stdio`, {
    api: apiOrigin,
    runWaitMs: config.runWaitMs,
    pollIntervalMs: config.pollIntervalMs,
  });

  const shutdown = (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    server
      .close()
      .catch((err: unknown) => log.error('error while closing', { message: errMessage(err) }))
      .finally(() => process.exit(0));
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// A stray rejection must not kill the server mid-session (or print to stdout).
process.on('unhandledRejection', (reason) => {
  log.error('unhandled rejection', { message: errMessage(reason) });
});

main().catch((err: unknown) => {
  log.error('failed to start', { message: errMessage(err) });
  process.exit(1);
});
