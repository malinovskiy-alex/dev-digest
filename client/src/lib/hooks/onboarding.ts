/* hooks/onboarding.ts — React Query hooks for the Onboarding Tour (L05): the
   tour of a repo, and starting one generation of it.

   Generation is asynchronous on the server: POST answers 202 once a single
   model call has started, and the tour query polls every 2 s while
   `generation.running` (D-39). It refetches on mount, so a user who leaves the
   page and comes back sees the finished tour (AC-29). */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OnboardingTour, TourGenerateAccepted } from "@devdigest/shared";

/** Poll interval while a generation runs (D-39). */
const TOUR_POLL_MS = 2000;

const tourKey = (repoId: string | null | undefined) => ["tour", repoId] as const;

/** The tour of a repo — never triggers a model call (AC-25). */
export function useTour(repoId: string | null | undefined) {
  return useQuery({
    queryKey: tourKey(repoId),
    queryFn: () => api.get<OnboardingTour>(`/repos/${repoId}/tour`),
    enabled: !!repoId,
    refetchInterval: (q) => (q.state.data?.generation.running ? TOUR_POLL_MS : false),
  });
}

/**
 * Start a generation (AC-27). On 202 the cached tour is marked running so the
 * button switches to "Generating…" at once, then refetched. A rejected start
 * (409 / 422) is refetched too: a missing key is recorded server-side (AC-70).
 */
export function useGenerateTour(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<TourGenerateAccepted>(`/repos/${repoId}/tour/generate`),
    onSuccess: () => {
      qc.setQueryData<OnboardingTour>(tourKey(repoId), (prev) =>
        prev
          ? { ...prev, can_generate: false, generation: { running: true, failure: null } }
          : prev,
      );
      void qc.invalidateQueries({ queryKey: tourKey(repoId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: tourKey(repoId) });
    },
  });
}
