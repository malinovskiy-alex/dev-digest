/* Route: /agent-performance — the global Agent Performance dashboard (L08).
   A thin server entry: the screen reads its range from the page address
   (`useSearchParams`), so it renders inside a Suspense boundary and the static
   prerender leaves the client to fill it in. Everything else lives under
   _components/AgentPerformanceView. */
import { Suspense } from "react";
import { AgentPerformanceView } from "./_components/AgentPerformanceView";

export default function AgentPerformancePage() {
  return (
    <Suspense fallback={null}>
      <AgentPerformanceView />
    </Suspense>
  );
}
