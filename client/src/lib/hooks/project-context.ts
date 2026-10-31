/* hooks/project-context.ts — React Query hooks for Project Context (L05): the
   repo's markdown listing and one document's content. Agent/skill attachment
   hooks live with their owners (hooks/agents.ts, hooks/skills.ts). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ContextDocContent, ContextDocList } from "@devdigest/shared";

/**
 * The active repo's documents at the clone's HEAD. `refetch()` IS the refresh
 * button (R-06): the server re-resolves HEAD on every GET, no fetch from origin.
 */
export function useContextDocs(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["context-docs", repoId],
    queryFn: () => api.get<ContextDocList>(`/repos/${repoId}/context-docs`),
    enabled: !!repoId,
  });
}

/** One document's content at HEAD; idle until a path is selected. */
export function useContextDocContent(repoId: string | null | undefined, path: string | null | undefined) {
  return useQuery({
    queryKey: ["context-doc", repoId, path],
    queryFn: () =>
      api.get<ContextDocContent>(
        `/repos/${repoId}/context-docs/content?path=${encodeURIComponent(path ?? "")}`,
      ),
    enabled: !!repoId && !!path,
    // A 404 (file gone) is an answer, not a blip — do not retry it.
    retry: false,
  });
}
