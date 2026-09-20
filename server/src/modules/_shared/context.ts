import type { FastifyRequest } from 'fastify';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';

export interface RequestContext {
  workspaceId: string;
  userId: string;
}

/**
 * Resolve the tenancy context for a request via the AuthProvider. In MVP
 * (LocalNoAuthProvider) this always returns the default workspace + system user.
 * Every module uses this so workspace scoping is never forgotten.
 */
export async function getContext(
  container: Container,
  req: FastifyRequest,
): Promise<RequestContext> {
  const [user, workspace] = await Promise.all([
    container.auth.currentUser(req),
    container.auth.currentWorkspace(req),
  ]);
  return { workspaceId: workspace.id, userId: user.id };
}

/**
 * Confirm a caller-supplied repo id belongs to `workspaceId`, or 404.
 *
 * Routes that take `:id` and hand it to a tenant-agnostic collaborator must go
 * through this first. `repo-intel` is the case that forced it: its tables carry
 * no `workspace_id`, so its queries scope by `repoId` alone — which means the
 * only thing standing between one workspace and another's index state is this
 * check. 404 rather than 403 so the response does not confirm that an id exists.
 */
export async function requireRepoInWorkspace(
  container: Container,
  workspaceId: string,
  repoId: string,
): Promise<string> {
  const repo = await container.reposRepo.getById(workspaceId, repoId);
  if (!repo) throw new NotFoundError(`Repo ${repoId} not found`);
  return repo.id;
}
