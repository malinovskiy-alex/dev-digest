import type {
  ConventionCandidate,
  ConventionSkillDraft,
  ConventionStatus,
  ConventionsView,
  Skill,
  SkillType,
} from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import { renderPrompt } from '../../platform/prompts.js';
import {
  EXTRACTION_MAX_TOKENS,
  EXTRACTION_PROMPT_FILE,
  EXTRACTION_SCHEMA_NAME,
  EXTRACTION_TEMPERATURE,
  EXTRACTION_TIMEOUT_MS,
  ExtractionResponse,
  SOURCE_SAMPLE_COUNT,
} from './constants.js';
import { toConventionDto, toScanDto, toSkillDto } from './helpers.js';
import { ConventionsRepository, type UpdateConvention } from './repository.js';
import { collectSamples, renderSamples, type FileSample } from './sampling.js';
import { composeSkillDraft } from './skill-draft.js';
import { verifyCandidates } from './verify.js';

/**
 * A7 — conventions service. Runs a scan, serves what a scan produced, records
 * the reader's accept/reject/edit, and turns the survivors into a skill.
 *
 * The scan is four steps and only ONE of them is the model:
 *
 *   sample (code) → ask (model) → verify against the clone (code) → store
 *
 * Steps 1 and 3 are what make the screen trustworthy, and they are also the
 * cheap ones. See specs/L02-conventions-extractor.md §4.3 and `verify.ts`.
 *
 * Nothing here knows it is behind HTTP: every method takes a `workspaceId` and
 * DTOs, and signals "no such row in this workspace" with `undefined`.
 */

/** What the create-skill call stores. The body is the user's, not the model's. */
export interface CreateSkillFromConventionsInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  /** The candidates the draft was built from — their paths become `evidence_files`. */
  conventionIds: string[];
  /** Attach the new skill to this agent, at the end of its list. */
  agentId?: string;
}

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  /** The whole screen in one read. `scan: null` = this repo was never scanned. */
  async view(workspaceId: string, repoId: string): Promise<ConventionsView> {
    const [scan, rows] = await Promise.all([
      this.repo.latestScan(workspaceId, repoId),
      this.repo.listForRepo(workspaceId, repoId),
    ]);
    return {
      scan: scan ? toScanDto(scan) : null,
      candidates: rows.map(toConventionDto),
    };
  }

  /**
   * Scan the repo and replace whatever the last scan left behind.
   *
   * Throws `no_samples` (422) when nothing could be read: an un-cloned repo and
   * an un-indexed one both land here, and both are fixable by the user (add the
   * repo / wait for the index) — which is why this is a 422 with a message
   * rather than an empty result that looks like "no conventions found".
   */
  async extract(workspaceId: string, repoId: string): Promise<ConventionsView> {
    const repo = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError(`Repo ${repoId} not found`);

    const samples = await this.sample(repoId, repo.owner, repo.name);
    if (samples.length === 0) {
      throw new AppError(
        'no_samples',
        'Nothing to sample — this repository has no readable files yet. Make sure it finished cloning and indexing, then try again.',
        422,
      );
    }

    const { provider, model } = await this.container.featureModel(workspaceId, 'conventions');
    const llm = await this.container.llm(provider);
    const system = await renderPrompt(EXTRACTION_PROMPT_FILE, {});

    const result = await llm.completeStructured({
      model,
      schema: ExtractionResponse,
      schemaName: EXTRACTION_SCHEMA_NAME,
      temperature: EXTRACTION_TEMPERATURE,
      maxTokens: EXTRACTION_MAX_TOKENS,
      timeoutMs: EXTRACTION_TIMEOUT_MS,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            `Report the house conventions of ${repo.fullName}.`,
            '',
            `Below are ${samples.length} file(s) from it, each line prefixed with its real line number.`,
            '',
            wrapUntrusted('repo', renderSamples(samples)),
          ].join('\n'),
        },
      ],
    });

    // The gate. Everything the model said is a claim until this returns.
    const verified = verifyCandidates(result.data.conventions, samples);

    const { scan, rows } = await this.repo.replaceScan(
      workspaceId,
      repoId,
      { sampleCount: samples.length, model: `${provider}/${model}` },
      verified,
    );

    return { scan: toScanDto(scan), candidates: rows.map(toConventionDto) };
  }

  /** Accept / reject a candidate, or correct its rule text and category. */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionCandidate | undefined> {
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? toConventionDto(row) : undefined;
  }

  /**
   * The skill the accepted candidates would make. A GET, because it writes
   * nothing and the modal re-opens on it — the user may have rejected a card
   * since the last time they looked.
   */
  async skillDraft(workspaceId: string, repoId: string): Promise<ConventionSkillDraft> {
    const repo = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError(`Repo ${repoId} not found`);

    const accepted = await this.acceptedFor(workspaceId, repoId);
    if (accepted.length === 0) {
      throw new AppError(
        'no_accepted_conventions',
        'No accepted conventions to build a skill from. Accept at least one first.',
        422,
      );
    }
    return composeSkillDraft(repo.fullName, accepted);
  }

  /**
   * Store the skill the user just read in the modal.
   *
   * `source: 'extracted'` and the cited paths in `evidence_files` are decided
   * HERE, never taken from the request — provenance belongs to the endpoint the
   * write came through, the same rule the import path follows (L02 §6.3).
   *
   * `enabled` IS the user's to choose: unlike an imported file, this text was
   * derived from their own repository, verified against it line by line, and
   * shown in full in an editor before this call. The vetting already happened.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateSkillFromConventionsInput,
  ): Promise<Skill> {
    const accepted = await this.acceptedFor(workspaceId, repoId);
    const cited = new Set(input.conventionIds);
    const stillAccepted = accepted.filter((c) => cited.has(c.id));

    // The same guard `skillDraft` applies, for the same reason — and it has to
    // be re-checked HERE, not just there: the modal holds a draft while the
    // screen behind it stays live, so the candidates it was built from can be
    // rejected between opening it and submitting. Without this, that submit
    // stores an `extracted` skill whose body is rules nobody accepted and whose
    // `evidence_files` is empty, which the Skills screen then renders as an
    // extracted skill with no evidence to click through to.
    if (stillAccepted.length === 0) {
      throw new AppError(
        'no_accepted_conventions',
        'None of those conventions are accepted any more. Re-open the list and try again.',
        422,
      );
    }

    const evidenceFiles = [...new Set(stillAccepted.map((c) => c.evidence_path))];

    const row = await this.container.skillsRepo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: 'extracted',
      body: input.body,
      enabled: input.enabled,
      evidenceFiles,
    });

    // Attaching is the point of extracting: a skill nobody sends changes no
    // review. It is resolved through the agents repository on the container —
    // a module never reaches into a sibling module's folder — and the agent is
    // confirmed in THIS workspace first, because the id comes from the request
    // and `agent_skills` carries no workspace of its own.
    if (input.agentId) {
      const agent = await this.container.agentsRepo.getById(workspaceId, input.agentId);
      if (!agent) throw new NotFoundError(`Agent ${input.agentId} not found`);
      const linked = await this.container.agentsRepo.linkedSkills(agent.id);
      const nextOrder = linked.reduce((max, l) => Math.max(max, l.order + 1), 0);
      await this.container.agentsRepo.linkSkill(agent.id, row.id, nextOrder);
    }

    return toSkillDto(row);
  }

  /** The repo's accepted candidates, in the screen's order. */
  private async acceptedFor(
    workspaceId: string,
    repoId: string,
  ): Promise<ConventionCandidate[]> {
    const rows = await this.repo.listForRepo(workspaceId, repoId);
    const accepted: ConventionStatus = 'accepted';
    return rows.map(toConventionDto).filter((c) => c.status === accepted);
  }

  /**
   * Step 1 — the sample set, chosen by code alone.
   *
   * `getConventionSamples` degrades to `[]` on an unindexed repo or with
   * repo-intel switched off, and a missing config file simply is not there, so
   * the two halves cover for each other: a cloned-but-unindexed repo still
   * scans on its configs, and a repo with no configs still scans on its
   * sources.
   */
  private async sample(repoId: string, owner: string, name: string): Promise<FileSample[]> {
    const ranked = await this.container.repoIntel.getConventionSamples(
      repoId,
      SOURCE_SAMPLE_COUNT,
    );
    const git = this.container.git;
    return collectSamples(
      async (path) => git.readFile({ owner, name }, path).catch(() => null),
      ranked,
    );
  }
}
