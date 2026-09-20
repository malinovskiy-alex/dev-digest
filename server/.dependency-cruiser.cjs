/**
 * Onion-architecture boundaries for @devdigest/api.
 *
 * The rings are LOGICAL — they sit on top of the existing `src/modules/*`
 * layout, there are no `domain/ application/ infrastructure/` folders. This
 * file is what makes them real; see `.claude/skills/onion-architecture/`
 * for the reasoning behind every rule.
 *
 *   Ring 1 domain          reviewer-core/src, helpers.ts, contracts, platform/errors.ts
 *   Ring 2 application     service.ts, run-executor.ts, pipeline/, job handlers
 *   Ring 3 infrastructure  adapters/, db/, repository.ts, container.ts, config.ts, jobs.ts, sse.ts
 *   Ring 4 transport       routes.ts, app.ts, server.ts
 *
 * Imports point INWARD only. Every rule is an `error`: the code that violates
 * one today is grandfathered in `.dependency-cruiser-known-violations.json`,
 * which `pnpm arch` ignores. So a NEW violation fails immediately, while the
 * existing debt stays visible as a list that only ever gets shorter.
 *
 *   pnpm arch             # fail on anything not already in the baseline
 *   pnpm arch:all         # show the debt too
 *   pnpm arch:baseline    # rewrite the baseline — only ever to REMOVE entries
 *
 * The debt and its fixes: server/specs/onion-debt.md
 *
 * One resolution detail matters here: pnpm resolves packages through its
 * versioned virtual store, so a node_modules edge is reported as
 * `node_modules/.pnpm/drizzle-orm@0.38.4_postgres@3.4.9/…`. Baselining such an
 * edge would bake the version into the file and a routine bump would "unknow"
 * a known violation. The rules that currently carry debt therefore match on
 * `src/db/schema` — which every real query needs anyway — and never on the
 * package. Rules that DO match packages (core-no-io) have zero violations, so
 * nothing versioned reaches the baseline. Keep it that way.
 */

/** Everything that means "an outward ring" for a domain-level file. */
const IO = [
  'drizzle-orm',
  '^src/db/',
  '^src/adapters/',
  '^src/platform/(container|config|sse|jobs)\\.ts$',
  '^fastify',
  '^postgres',
  '^octokit',
  '^simple-git',
  '^openai',
  '^@anthropic-ai/',
].join('|');

/** Ring-1 sources: the pure engine and the per-module pure helpers. */
const DOMAIN = '^(\\.\\./)?reviewer-core/src/|^src/modules/[^/]+/helpers\\.ts$';

/** Ring-2 sources: application services and the pipelines they orchestrate. */
const APPLICATION =
  '^src/modules/[^/]+/(service|run-executor|diff-loader|findings|status)\\.ts$' +
  '|^src/modules/[^/]+/pipeline/';

module.exports = {
  forbidden: [
    {
      name: 'core-no-io',
      severity: 'error',
      comment:
        'Ring 1 (reviewer-core, helpers.ts) must stay free of I/O: no ORM, no HTTP ' +
        'framework, no SDK, no adapter. A helper that needs one of those is not a ' +
        'helper — move it into the service, or put a port in front of it.',
      from: { path: DOMAIN },
      to: { path: IO },
    },
    {
      name: 'app-no-drizzle',
      severity: 'error',
      comment:
        'Ring 2 does not speak SQL. Persistence goes through the module repository; ' +
        'a service that imports drizzle-orm or db/schema has swallowed its Ring 3.',
      from: { path: APPLICATION },
      to: { path: '^src/db/schema' },
    },
    {
      name: 'app-no-fastify',
      severity: 'error',
      comment:
        'Ring 2 does not know it is behind HTTP. Services take workspaceId/userId and ' +
        'DTOs, never FastifyRequest/FastifyReply — otherwise the job runner and the ' +
        'tests cannot call them.',
      from: { path: APPLICATION },
      to: { path: '^fastify' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle means two files share one responsibility across a ring boundary.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'routes-no-db',
      severity: 'error',
      comment:
        'Ring 4 must not query the database. A route parses the request, calls one ' +
        'service method and maps the status code. The four modules that still do this ' +
        'are grandfathered in the baseline — see server/specs/onion-debt.md.',
      from: { path: 'routes\\.ts$' },
      to: { path: '^src/db/schema' },
    },
    {
      name: 'no-concrete-adapters',
      severity: 'error',
      comment:
        'Only the composition root builds adapters. A module that imports ' +
        'src/adapters/* directly cannot be swapped through ContainerOverrides. ' +
        'Current offenders are grandfathered — see server/specs/onion-debt.md.',
      from: { path: '^src/modules/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'no-cross-module',
      severity: 'error',
      comment:
        'A module never reaches into a sibling module\'s folder. Shared repositories ' +
        'and services are exposed on the container; shared schemas live in _shared/.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: '^src/modules/($1|_shared)/',
      },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'A path alias or extension that dependency-cruiser cannot resolve.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts'],
    },
  },
};
