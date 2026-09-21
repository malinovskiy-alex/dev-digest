import { pgTable, uuid, text, integer, jsonb, timestamp, doublePrecision, vector, index } from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';
import { repos } from './repos';

// ============================================================ Knowledge / RAG

export const memory = pgTable(
  'memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['repo', 'global', 'team'] }).notNull(),
    kind: text('kind', {
      enum: ['decision', 'convention', 'preference', 'fact', 'learning'],
    }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    confidence: doublePrecision('confidence'),
    sources: jsonb('sources'),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({ wsIdx: index('memory_ws_idx').on(t.workspaceId) }),
);

/**
 * One run of the conventions extractor (L02). Holds what the candidate rows
 * cannot: how many files were sampled and which model read them. A re-scan
 * inserts a new row and deletes the repo's previous ones — the candidates go
 * with them through `conventions.scan_id`.
 */
export const conventionScans = pgTable(
  'convention_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    sampleCount: integer('sample_count').notNull().default(0),
    model: text('model').notNull(),
    createdAt: now(),
  },
  (t) => ({ wsRepoIdx: index('convention_scans_ws_repo_idx').on(t.workspaceId, t.repoId) }),
);

/**
 * One extracted house-rule, already grounded: `evidence_path` is a file the
 * sampler read, the line range exists in it, and `evidence_snippet` was re-read
 * from that file rather than taken from the model. Candidates that could not be
 * verified are never inserted — see specs/L02-conventions-extractor.md D2.
 *
 * `status` is two-valued and a fresh row is `accepted` (D3). The `accepted`
 * boolean the starter shipped is gone: it named a third state the screen has no
 * way to render.
 */
export const conventions = pgTable(
  'conventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    scanId: uuid('scan_id').references(() => conventionScans.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: [
        'naming',
        'structure',
        'error-handling',
        'async',
        'typing',
        'testing',
        'imports',
        'api',
        'docs',
        'other',
      ],
    })
      .notNull()
      .default('other'),
    rule: text('rule').notNull(),
    evidencePath: text('evidence_path'),
    evidenceStartLine: integer('evidence_start_line'),
    evidenceEndLine: integer('evidence_end_line'),
    evidenceSnippet: text('evidence_snippet'),
    confidence: doublePrecision('confidence'),
    status: text('status', { enum: ['accepted', 'rejected'] })
      .notNull()
      .default('accepted'),
    createdAt: now(),
  },
  (t) => ({ wsRepoIdx: index('conventions_ws_repo_idx').on(t.workspaceId, t.repoId) }),
);
