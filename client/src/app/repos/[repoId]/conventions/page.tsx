/* Route: /repos/:repoId/conventions (Conventions extractor, L02). Thin route
   entry — the scan header, the candidate list, the accept/reject controls and
   the create-skill modal are colocated under _components/ConventionsView.

   Repo-scoped rather than a global /conventions: a convention is a fact about
   one repository, and the sidebar entry resolves :repoId from the active repo
   the same way Pull Requests does. */
import { ConventionsView } from "./_components/ConventionsView";

export default function ConventionsPage() {
  return <ConventionsView />;
}
