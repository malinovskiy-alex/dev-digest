/* hooks/brief.ts — React Query hooks for the PR Brief (L05): the stored brief
   of a PR and starting one generation of it.

   GET never calls a model (R-03). Generation is asynchronous on the server:
   POST answers 202 and the work runs as a background job, so the read polls
   every 2 s while it reports `generating` (R-69, R-70, D-35). The mutation is
   only ever called from a user click — nothing here regenerates on its own
   (R-47). */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { BriefGenerateAccepted, PrBriefView } from "@devdigest/shared";

/** Poll interval while a generation runs (D-35). */
export const BRIEF_POLL_MS = 2000;

export const briefKey = (prId: string | null | undefined) => ["pr-brief", prId] as const;

/** The stored brief of a PR plus its read-time state (R-43). */
export function usePrBrief(prId: string | null | undefined) {
  return useQuery({
    queryKey: briefKey(prId),
    queryFn: () => api.get<PrBriefView>(`/pulls/${prId}/brief`),
    enabled: !!prId,
    // Poll only while the last read succeeded and said `generating`: a read
    // that keeps failing stops the loop and the block shows the error + Retry
    // (R-06) instead of a skeleton that never ends.
    refetchInterval: (q) => (q.state.status !== "error" && q.state.data?.generating ? BRIEF_POLL_MS : false),
    // A 404 (unknown PR) will not heal on retry; anything else gets one retry.
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });
}

/**
 * Start a generation (R-74). On 202 the cached view is marked generating, so
 * the block switches to its skeleton at once, then refetched. A rejected
 * start (409 running / no key) is refetched too.
 */
export function useGenerateBrief(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<BriefGenerateAccepted>(`/pulls/${prId}/brief/generate`),
    onSuccess: () => {
      qc.setQueryData<PrBriefView>(briefKey(prId), (prev) =>
        prev ? { ...prev, generating: true, last_failure: null } : prev,
      );
      void qc.invalidateQueries({ queryKey: briefKey(prId) });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: briefKey(prId) });
    },
  });
}

/**
 * What the Overview's navigation hands to every PR Brief file reference
 * (D-30): activate a reference (navigates, or shows the "not in diff" notice),
 * the key of the reference whose notice is showing, and the in-diff test (R-76).
 * Declared here, in the brief's client module, because three route components
 * share it (the Overview owns the implementation, the block and the Risk areas
 * consume it).
 */
export interface BriefNavigation {
  activate: (key: string, path: string, line: number | null) => void;
  noticeKey: string | null;
  inDiff: (path: string) => boolean;
}
