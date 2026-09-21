import type { Container } from '../../platform/container.js';
import type {
  Skill,
  SkillImportPreview,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';
import { IMPORT_SOURCE } from './constants.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { parseUpload, type ImportUpload } from './import-parse.js';
import { SkillsRepository, type PromptSkill } from './repository.js';

/**
 * A1 — skills service. CRUD over the workspace's skill library, the body
 * version history, the two-step file import, and the ONE read the review path
 * uses to put skill bodies into an agent's prompt.
 *
 * Nothing here knows it is behind HTTP: every method takes a `workspaceId` and
 * DTOs, and signals "no such row in this workspace" by returning `undefined` —
 * the route turns that into a 404 (never a 403, so a response cannot confirm
 * that an id exists somewhere else).
 */

/** Re-exported so §6.2's service surface holds for the review path's caller. */
export type { PromptSkill } from './repository.js';

/** Provenance for a hand-written skill. Never taken from the request body — a
 *  client cannot claim a provenance it did not go through. */
const MANUAL_SOURCE = 'manual' as const;

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  /** Default true. Only the import path creates a disabled skill (D6). */
  enabled?: boolean;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/**
 * The confirm step: the SAME upload that was previewed, plus the `token` that
 * preview returned and the three fields the user may have corrected in the
 * preview form. The body is never taken from here — it comes from re-parsing
 * the upload, so what is stored is what the archive actually contains.
 */
export type ConfirmImportInput = ImportUpload & {
  token: string;
  name: string;
  description: string;
  type: SkillType;
};

/**
 * What a successful delete reports. `unlinked_from` is read BEFORE the row is
 * removed — `agent_skills` cascades, so after the delete the count is always 0.
 *
 * NOTE: spec §6.2 sketches `delete(): Promise<boolean>`, but §6.3 requires the
 * response to carry `unlinked_from` and Ring 4 may not query the database. The
 * count therefore comes back from here; the route only shapes the envelope.
 */
export interface DeleteSkillResult {
  unlinked_from: number;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  /** Every skill in the workspace, `name` ascending. */
  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    const counts = await this.repo.agentCountsFor(workspaceId, rows.map((r) => r.id));
    return rows.map((row) => toSkillDto(row, counts.get(row.id) ?? 0));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const counts = await this.repo.agentCountsFor(workspaceId, [row.id]);
    return toSkillDto(row, counts.get(row.id) ?? 0);
  }

  /** Create a hand-written skill: version 1, `source: 'manual'`, enabled unless
   *  the caller says otherwise. */
  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: MANUAL_SOURCE,
      body: input.body,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    });
    return toSkillDto(row);
  }

  /**
   * Partial update. Only a changed `body` bumps `version` and appends to
   * `skill_versions` (the repository owns that rule). Re-submitting an
   * identical body is not a change. `undefined` when the skill is not in this
   * workspace.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    if (!row) return undefined;
    // The card that triggered this edit re-renders from the response, so the
    // count has to ride along or it would blank out after every save.
    const counts = await this.repo.agentCountsFor(workspaceId, [row.id]);
    return toSkillDto(row, counts.get(row.id) ?? 0);
  }

  /**
   * Delete a skill and report how many agents lost it. The count is taken
   * first: `agent_skills` rows cascade with the skill, so asking afterwards
   * always answers 0. `undefined` when there was nothing to delete here.
   */
  async delete(workspaceId: string, id: string): Promise<DeleteSkillResult | undefined> {
    // Collected before the delete for the same reason as the count: the links
    // cascade with the skill, so afterwards there is nothing left to ask.
    const affectedAgentIds = await this.repo.agentIdsUsing(workspaceId, id);
    const deleted = await this.repo.deleteById(workspaceId, id);
    if (!deleted) return undefined;

    // The links cascade away with the skill, so the agents that used it just
    // lost a block from their prompt. Their `version` deliberately does NOT
    // move for it — see the repository's note on `agents.version`: the number
    // tracks the agent's own config, not its skill set.
    return { unlinked_from: affectedAgentIds.length };
  }

  /**
   * Body revisions, newest first. The workspace check happens here rather than
   * in the query: `listVersions` is keyed by skill id alone, so the skill is
   * resolved in the workspace first and a foreign id never reaches it.
   */
  async versions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, id);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(id);
    return rows.map(toSkillVersionDto);
  }

  /**
   * Parse an upload and return what *would* be stored. Writes nothing, touches
   * no workspace. Throws `AppError` — `no_skill_core`, `unsupported_archive`,
   * `unsafe_entry_path` (422) or `archive_too_large` (413).
   *
   * `async` only for symmetry with the rest of the surface: `parseUpload` is
   * pure and synchronous, which is why this can be called from a unit test with
   * no container and no Postgres.
   */
  async previewImport(input: ImportUpload): Promise<SkillImportPreview> {
    return parseUpload(input);
  }

  /**
   * Persist a previewed skill.
   *
   * The upload is re-parsed rather than cached between the two calls: the
   * server stays stateless — no TTL, no eviction, nothing to leak between
   * workspaces — at the cost of inflating one entry twice. The fresh token is
   * compared to the one the preview handed out, so an upload that changed
   * underneath the user is a 409 rather than a silent swap.
   *
   * `name` / `description` / `type` come from the REQUEST (the user may have
   * corrected them in the preview form); the body is always the freshly parsed
   * one. Provenance is `imported_file` and the skill lands **disabled** (D6):
   * text from a file cannot reach a prompt until someone vets it.
   */
  async confirmImport(workspaceId: string, input: ConfirmImportInput): Promise<Skill> {
    const preview = parseUpload(input);
    if (preview.token !== input.token) {
      throw new AppError(
        'import_changed',
        'The upload no longer matches the one that was previewed. Preview it again.',
        409,
      );
    }

    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source: IMPORT_SOURCE,
      body: preview.body,
      enabled: false,
    });
    return toSkillDto(row);
  }

  /**
   * Ordered bodies for an agent's prompt: attached order, globally-enabled
   * only. The ONE read the review path uses. Returns `[]` for an agent with no
   * skills so `assemblePrompt` omits the section entirely.
   *
   * No `workspaceId`: the caller has already resolved the agent inside its
   * workspace, and `agent_skills` rows only ever exist for that agent.
   */
  async promptBodiesForAgent(agentId: string): Promise<PromptSkill[]> {
    return this.repo.promptBodiesForAgent(agentId);
  }
}
