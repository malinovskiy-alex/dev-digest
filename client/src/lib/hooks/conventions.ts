/* hooks/conventions.ts — React Query hooks for the Conventions screen (L02).
   Every conventions read/write in the UI goes through here; components never fetch. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ConventionCandidate,
  ConventionCategory,
  ConventionSkillDraft,
  ConventionStatus,
  ConventionsView,
  Skill,
  SkillType,
} from "@devdigest/shared";

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionsView>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

/**
 * Run a scan. A mutation rather than a query: it is a POST that writes, it must
 * not be cached, and it must never re-run on a window refocus — this is the one
 * call in the app that costs a model request the user did not ask for twice.
 *
 * The response IS the new view, so it is written straight into the cache
 * instead of invalidating and re-fetching what we already hold.
 */
export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionsView>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => {
      qc.setQueryData(["conventions", repoId], data);
      qc.removeQueries({ queryKey: ["convention-skill-draft", repoId] });
    },
  });
}

export interface UpdateConventionInput {
  id: string;
  patch: {
    status?: ConventionStatus;
    rule?: string;
    category?: ConventionCategory;
  };
}

/**
 * Accept / reject / correct one candidate.
 *
 * The updated row is patched into the cached view rather than invalidating it:
 * a refetch would re-order the list while the user is clicking down it (the
 * server sorts by confidence), and an accept that makes a card jump is a card
 * you click twice. The draft is dropped because its contents just changed.
 */
export function useUpdateConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData<ConventionsView>(["conventions", repoId], (prev) =>
        prev
          ? { ...prev, candidates: prev.candidates.map((c) => (c.id === updated.id ? updated : c)) }
          : prev,
      );
      qc.removeQueries({ queryKey: ["convention-skill-draft", repoId] });
    },
  });
}

/**
 * The skill the accepted candidates would make. `enabled` is the caller's, so
 * the modal fetches it when it opens and not before — the draft is a function of
 * the current accept/reject state and would be stale by the time it was needed.
 */
export function useSkillDraft(repoId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["convention-skill-draft", repoId],
    queryFn: () => api.get<ConventionSkillDraft>(`/repos/${repoId}/conventions/skill-draft`),
    enabled: !!repoId && enabled,
    // Always re-read on open: a rejection between two openings changes it.
    staleTime: 0,
    gcTime: 0,
  });
}

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  convention_ids: string[];
}

export function useCreateConventionSkill(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: (skill) => {
      // It is a skill like any other from here on — the library and the new
      // row's own cache entry both have to know about it.
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", skill.id], skill);
    },
  });
}
