/**
 * The port: everything the tool handlers may ask of DevDigest.
 *
 * Ring 2 depends on this interface only. The one implementation that talks
 * HTTP is `HttpDevDigestApi` (Ring 3), built in `index.ts`; tests pass a
 * fake. Ids passed in are always ids the API itself returned.
 *
 * Every method takes an optional `signal` so a cancelled tool call stops its
 * in-flight request. Failures surface as `ToolError`.
 */
import type {
  ActiveRun,
  Agent,
  ApiReview,
  ConventionsView,
  PrMeta,
  Repo,
  RunSummary,
  StartRunResponse,
} from './types.js';

export interface DevDigestApi {
  listAgents(signal?: AbortSignal): Promise<Agent[]>;
  listRepos(signal?: AbortSignal): Promise<Repo[]>;
  listPulls(repoId: string, signal?: AbortSignal): Promise<PrMeta[]>;
  activeRuns(prId: string, signal?: AbortSignal): Promise<ActiveRun[]>;
  startReview(prId: string, agentId: string, signal?: AbortSignal): Promise<StartRunResponse>;
  listRuns(prId: string, signal?: AbortSignal): Promise<RunSummary[]>;
  listReviews(prId: string, signal?: AbortSignal): Promise<ApiReview[]>;
  getConventions(repoId: string, signal?: AbortSignal): Promise<ConventionsView>;
}
