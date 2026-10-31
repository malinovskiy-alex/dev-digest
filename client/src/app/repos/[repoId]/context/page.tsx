/* Route: /repos/:repoId/context (Project Context, L05). Thin route entry — the
   document tree, the viewer and every state are colocated under
   _components/ProjectContextView.

   Repo-scoped: the documents are read from this repository's local clone, and
   the sidebar entry resolves :repoId from the active repo like Pull Requests. */
import { ProjectContextView } from "./_components/ProjectContextView";

export default function ProjectContextPage() {
  return <ProjectContextView />;
}
