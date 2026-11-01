/* Route: /repos/:repoId/tour (Onboarding Tour, L05). Thin route entry — the
   header, the "On this page" aside, the five sections and every state are
   colocated under _components/TourView.

   Repo-scoped: the tour is built from this repository's clone and index, and
   the sidebar entry resolves :repoId from the active repo like Pull Requests. */
import { TourView } from "./_components/TourView";

export default function OnboardingTourPage() {
  return <TourView />;
}
