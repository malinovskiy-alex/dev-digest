import type { FeatureModelChoice, IntentSource, PrIntentRecord, RepoRef } from '@devdigest/shared';
import type { Container } from '../../../platform/container.js';
import { AppError, ConfigError, NotFoundError } from '../../../platform/errors.js';
import { renderPrompt } from '../../../platform/prompts.js';
import { logPromptAssembly } from '../../../platform/prompt-log.js';
import { sectionMeta } from '@devdigest/reviewer-core';
import type { PullRow } from '../../../db/rows.js';
import { ReviewRepository } from '../repository.js';
import {
  INTENT_MAX_RETRIES,
  INTENT_MAX_TOKENS,
  INTENT_PROMPT_FILE,
  INTENT_SCHEMA_NAME,
  INTENT_TEMPERATURE,
  INTENT_TIMEOUT_MS,
  MAX_SPEC_CHARS,
} from './constants.js';
import { IntentLLMOutput } from './schema.js';
import {
  capCommits,
  capFiles,
  capHunks,
  capTicket,
  clampOutput,
  computeConfidence,
  intentInputHash,
  missingContext,
  isMeaningfulDescription,
  normalizeDescription,
  parseClosingIssues,
  parseExternalTickets,
  parseSpecLinks,
  buildClassifierInput,
  type IntentInputs,
  type IntentSpec,
  type IntentTicket,
} from './sources.js';

/** pino-compatible `(obj, msg)` logger — the route passes `req.log`, the executor its run logger. */
export interface IntentLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

export interface IntentGetOptions {
  force?: boolean;
  logger?: IntentLogger;
  /** Ties the log lines to the caller: the request id, or the review run id(s). */
  correlationId?: string;
}

export interface IntentResult {
  record: PrIntentRecord;
  cacheHit: boolean;
  inputHash: string;
  durationMs: number;
}

/**
 * Derives within one process share this map, so the Overview and a review
 * started at the same moment make ONE model call (spec §5, single-flight).
 * Module-level on purpose: the route and the run executor each hold their own
 * IntentService instance.
 */
const inFlight = new Map<string, Promise<IntentResult>>();

/**
 * L03 — PR intent. Gathers every source (title, description, closing-keyword
 * ticket, linked specs at the PR head, branch, commits, files), keys a cache on
 * all of them, and only on a miss asks the `review_intent` model. Confidence is
 * computed here from which sources really existed — the model may only lower it.
 *
 * Nothing here knows about HTTP or the review run: it takes a workspace + PR id
 * and returns a record; the caller decides what a failure means (the route
 * answers 409/5xx, the review goes on without intent).
 */
export class IntentService {
  private repo: ReviewRepository;

  constructor(
    private container: Container,
    repo?: ReviewRepository,
  ) {
    this.repo = repo ?? new ReviewRepository(container.db);
  }

  /**
   * The intent already derived for this PR — NO model call, no GitHub call.
   * What opening the PR page reads: intent is derived only when the user asks
   * (POST /intent/refresh) or a review run needs it (`get`), never on a page
   * view. 404 `intent_not_derived` when there is none yet.
   */
  async getStored(workspaceId: string, prId: string): Promise<PrIntentRecord> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError(`PR ${prId} not found`);
    const stored = await this.repo.getIntent(prId);
    if (!stored) {
      throw new AppError('intent_not_derived', 'No intent has been derived for this PR yet.', 404);
    }
    return { ...stored.record, cache_hit: true };
  }

  /** Cached intent if its inputs are unchanged, else a fresh derive. `force` skips the cache. */
  async get(
    workspaceId: string,
    prId: string,
    opts: IntentGetOptions = {},
  ): Promise<IntentResult> {
    const existing = inFlight.get(prId);
    if (existing && !opts.force) return existing;

    const run = (async () => {
      // A forced refresh waits for any derive already running, then re-derives.
      if (existing) await existing.catch(() => undefined);
      return this.derive(workspaceId, prId, opts);
    })();
    inFlight.set(prId, run);
    try {
      return await run;
    } finally {
      if (inFlight.get(prId) === run) inFlight.delete(prId);
    }
  }

  private async derive(
    workspaceId: string,
    prId: string,
    opts: IntentGetOptions,
  ): Promise<IntentResult> {
    const start = Date.now();
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError(`PR ${prId} not found`);
    const repoRow = await this.repo.getRepo(pull.repoId);
    if (!repoRow) throw new NotFoundError(`Repo for PR ${prId} not found`);
    const repoRef: RepoRef = { owner: repoRow.owner, name: repoRow.name };

    const choice = await this.container.featureModel(workspaceId, 'review_intent');
    const { inputs, sources } = await this.gather(pull, repoRef);
    const inputHash = intentInputHash(inputs, choice);

    if (!opts.force) {
      const stored = await this.repo.getIntent(prId);
      if (stored && stored.inputHash === inputHash) {
        const durationMs = Date.now() - start;
        this.log(opts, prId, inputHash, true, stored.record, durationMs);
        return { record: { ...stored.record, cache_hit: true }, cacheHit: true, inputHash, durationMs };
      }
    }

    const record = await this.classify(prId, pull.headSha, inputs, sources, choice, opts);
    await this.repo.upsertIntent(prId, record, inputHash);
    const durationMs = Date.now() - start;
    this.log(opts, prId, inputHash, false, record, durationMs);
    return { record: { ...record, cache_hit: false }, cacheHit: false, inputHash, durationMs };
  }

  /**
   * Collect every source. A source that cannot be read is RECORDED (failed /
   * unresolved, with a reason) and the derive goes on — only the model call
   * itself can fail a derive.
   */
  private async gather(
    pull: PullRow,
    repoRef: RepoRef,
  ): Promise<{ inputs: IntentInputs; sources: IntentSource[] }> {
    const sources: IntentSource[] = [];
    const description = normalizeDescription(pull.body);
    const meaningfulDescription = isMeaningfulDescription(description);

    sources.push({ type: 'title', ref: 'title', status: 'used' });
    sources.push(
      meaningfulDescription
        ? { type: 'description', ref: 'description', status: 'used' }
        : { type: 'description', ref: 'description', status: 'failed', reason: description ? 'template_only' : 'empty' },
    );

    // ---- ticket: first same-repo issue named with a closing keyword --------
    let ticket: IntentTicket | null = null;
    const issueNumbers = parseClosingIssues(pull.body ?? '');
    for (const [i, n] of issueNumbers.entries()) {
      if (i > 0) {
        sources.push({ type: 'ticket', ref: `#${n}`, status: 'failed', reason: 'limit_exceeded' });
        continue;
      }
      try {
        const gh = await this.container.github();
        const issue = await gh.getIssue(repoRef, n);
        ticket = capTicket({ number: issue.number, title: issue.title, body: issue.body ?? '' });
        sources.push({ type: 'ticket', ref: `#${n}`, status: 'used' });
      } catch (err) {
        sources.push({
          type: 'ticket',
          ref: `#${n}`,
          status: 'failed',
          // not_found / private / rate-limited all look alike from here.
          reason: err instanceof ConfigError ? 'github_unavailable' : 'fetch_failed',
        });
      }
    }
    for (const ref of parseExternalTickets(pull.body ?? '')) {
      sources.push({ type: 'ticket', ref, status: 'unresolved', reason: 'external' });
    }

    // ---- specs: linked from the description or the ticket, read at head ---
    const linkText = [pull.body ?? '', ticket?.body ?? ''].join('\n');
    const links = parseSpecLinks(linkText, repoRef);
    const specs: IntentSpec[] = [];
    if (links.some((l) => l.path)) {
      // The head sha must be in the clone before `git show` can read it. A
      // failure here is not fatal: the head may already be present.
      await this.container.git.fetchPullHead(repoRef, pull.number).catch(() => undefined);
    }
    for (const link of links) {
      if (!link.path) {
        sources.push({ type: 'spec', ref: link.ref, status: 'failed', reason: link.reason ?? 'unreadable' });
        continue;
      }
      try {
        const content = await this.container.git.readFileAt(repoRef, pull.headSha, link.path);
        // A long plan is still the plan: read its start rather than skip it,
        // and say so — the classifier and the UI both see `truncated`.
        if (content.length > MAX_SPEC_CHARS) {
          specs.push({ path: link.path, content: content.slice(0, MAX_SPEC_CHARS), truncated: true });
          sources.push({ type: 'spec', ref: link.path, status: 'used', reason: 'truncated' });
          continue;
        }
        specs.push({ path: link.path, content });
        sources.push({ type: 'spec', ref: link.path, status: 'used' });
      } catch {
        sources.push({ type: 'spec', ref: link.path, status: 'failed', reason: 'not_found' });
      }
    }

    // ---- indirect: branch, commits, files ----------------------------------
    let [commitMessages, prFiles]: [string[], { path: string; additions: number; deletions: number; patch: string | null }[]] =
      await Promise.all([this.repo.getPrCommitMessages(pull.id), this.repo.getPrFiles(pull.id)]);
    // pr_files / pr_commits are filled by the PR-detail sync, which may not
    // have run yet (a brand-new PR, or intent derived before the page loaded
    // its detail). Read them from GitHub for this derive instead of
    // classifying on "0 files, 0 commits". Read-only: the sync owns the tables.
    let githubFallbackFailed = false;
    if (prFiles.length === 0 || commitMessages.length === 0) {
      try {
        const detail = await (await this.container.github()).getPullRequest(repoRef, pull.number);
        if (prFiles.length === 0) {
          prFiles = detail.files.map((f) => ({
            path: f.path,
            additions: f.additions,
            deletions: f.deletions,
            patch: f.patch ?? null,
          }));
        }
        if (commitMessages.length === 0) commitMessages = detail.commits.map((c) => c.message);
      } catch {
        // No GitHub (no token, offline, rate-limited): classify on what we
        // have, and say WHY commits/files are missing instead of "empty".
        githubFallbackFailed = true;
      }
    }
    const commits = capCommits(commitMessages);
    const files = capFiles(
      prFiles.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions })),
    );
    sources.push({ type: 'branch', ref: pull.branch, status: 'used' });
    sources.push(
      commits.length > 0
        ? { type: 'commits', ref: `${commits.length} commit(s)`, status: 'used' }
        : { type: 'commits', ref: '0 commits', status: 'failed', reason: githubFallbackFailed ? 'github_unavailable' : 'empty' },
    );
    sources.push(
      files.length > 0
        ? { type: 'files', ref: `${files.length} file(s)`, status: 'used' }
        : { type: 'files', ref: '0 files', status: 'failed', reason: githubFallbackFailed ? 'github_unavailable' : 'empty' },
    );
    // No usable description → the classifier also gets WHERE each change
    // lands: the `@@ … @@` hunk headers, never the changed lines.
    const hunks = meaningfulDescription
      ? []
      : capHunks(prFiles.map((f) => ({ path: f.path, patch: f.patch })));
    if (!meaningfulDescription) {
      const count = hunks.reduce((n, h) => n + h.headers.length, 0);
      sources.push(
        count > 0
          ? { type: 'hunks', ref: `${count} hunk header(s)`, status: 'used' }
          : { type: 'hunks', ref: '0 hunk headers', status: 'failed', reason: 'empty' },
      );
    }
    const unavailable = missingContext(sources).map((m) => ({
      type: m.type as 'ticket' | 'spec',
      ref: m.ref,
      reason: m.reason,
    }));

    return {
      inputs: {
        title: pull.title,
        description,
        meaningfulDescription,
        branch: pull.branch,
        commits,
        files,
        hunks,
        ticket,
        specs,
        unavailable,
      },
      sources,
    };
  }

  private async classify(
    prId: string,
    headSha: string,
    inputs: IntentInputs,
    sources: IntentSource[],
    choice: FeatureModelChoice,
    opts: IntentGetOptions,
  ): Promise<PrIntentRecord> {
    let llm;
    try {
      llm = await this.container.llm(choice.provider);
    } catch (err) {
      if (err instanceof ConfigError) {
        throw new AppError(
          'intent_unavailable',
          `Intent is unavailable: ${err.message}. Add the key in Settings, or pick another model for “PR Review · Intent”.`,
          409,
        );
      }
      throw err;
    }

    const system = await renderPrompt(INTENT_PROMPT_FILE, {});
    const user = buildClassifierInput(inputs);
    logPromptAssembly(
      opts.logger,
      {
        correlationId: opts.correlationId ?? `intent:${prId}`,
        kind: 'intent',
        provider: choice.provider,
        model: choice.model,
        prId,
      },
      [sectionMeta('system', INTENT_PROMPT_FILE, 'trusted', system), ...user.sections],
      this.container.config.promptLogVerbose,
    );
    const result = await llm.completeStructured({
      model: choice.model,
      schema: IntentLLMOutput,
      schemaName: INTENT_SCHEMA_NAME,
      temperature: INTENT_TEMPERATURE,
      maxTokens: INTENT_MAX_TOKENS,
      timeoutMs: INTENT_TIMEOUT_MS,
      maxRetries: INTENT_MAX_RETRIES,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user.text },
      ],
    });
    const out = clampOutput(result.data);

    const confidence = computeConfidence({
      meaningfulDescription: inputs.meaningfulDescription,
      resolvedTicketOrSpec: inputs.ticket !== null || inputs.specs.length > 0,
      unresolvedLink: sources.some(
        (s) => (s.type === 'spec' || s.type === 'ticket') && s.status !== 'used',
      ),
      ambiguous: out.ambiguous,
    });

    return {
      pr_id: prId,
      intent: out.intent,
      kind: out.kind,
      in_scope: out.in_scope,
      out_of_scope: out.out_of_scope,
      risk_areas: out.risk_areas,
      conflicts: out.conflicts,
      confidence,
      sources,
      generated_at: new Date().toISOString(),
      head_sha: headSha,
      provider: choice.provider,
      model: choice.model,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: result.costUsd,
    };
  }

  /** Structured log line — refs and statuses only, never description/ticket/spec content. */
  private log(
    opts: IntentGetOptions,
    prId: string,
    inputHash: string,
    cacheHit: boolean,
    record: PrIntentRecord,
    durationMs: number,
  ): void {
    opts.logger?.info(
      {
        ...(opts.correlationId ? { correlation_id: opts.correlationId } : {}),
        prId,
        inputHash,
        cacheHit,
        confidence: record.confidence,
        sources: record.sources.map((s) => ({ type: s.type, ref: s.ref, status: s.status, reason: s.reason })),
        model: record.provider && record.model ? `${record.provider}/${record.model}` : null,
        tokensIn: record.tokens_in,
        tokensOut: record.tokens_out,
        costUsd: record.cost_usd,
        durationMs,
      },
      `intent: ${cacheHit ? 'cache hit' : 'derived'} (${record.confidence})`,
    );
  }
}
