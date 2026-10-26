/* hooks/blast.ts — React Query hooks for the PR brief's Blast Radius card (L04).
     GET /pulls/:id/blast    → BlastRadius (read from the repo-intel index, no model)
     GET /pulls/:id/history  → PrHistory   (merged PRs that touched the same files) */
"use client";

import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { BlastRadius, PrHistory } from "@devdigest/shared";
import { useRepoIntelStatus, useResyncRepoIntel } from "./repo-intel";

/** A merged PR's file list never changes, so a prior-PR answer stays good for a while.
    5 min keeps a re-render or tab switch from re-asking GitHub for uncached candidates. */
const HISTORY_STALE_MS = 5 * 60_000;

/** Stop polling a resync after this long. Matches the JobRunner's hard 120 s
    job timeout (server/src/modules/repo-intel/constants.ts). */
export const RESYNC_POLL_TIMEOUT_MS = 120_000;

/** A resync is done once the index state's `updatedAt` moves past the one read
    before it started. `undefined` = not captured yet; `null` = no index existed. */
export function resyncFinished(
  baseline: string | null | undefined,
  current: string | null | undefined,
): boolean {
  return baseline !== undefined && current != null && current !== baseline;
}

export const blastKey = (prId: string | null | undefined) => ["pr-blast", prId] as const;

/** GET /pulls/:id/blast — the PR's blast radius. */
export function useBlastRadius(prId: string | null | undefined) {
  return useQuery({
    queryKey: blastKey(prId),
    queryFn: () => api.get<BlastRadius>(`/pulls/${prId}/blast`),
    enabled: !!prId,
  });
}

/** Resync the repo index from the Blast Radius card. A resync runs as a job, so
    completion is seen when the index state's `updatedAt` moves; then the map is
    re-read. Gives up after RESYNC_POLL_TIMEOUT_MS. */
export function useBlastResync(repoId: string, prId: string) {
  const qc = useQueryClient();
  const [polling, setPolling] = React.useState(false);
  const [baseline, setBaseline] = React.useState<string | null | undefined>(undefined);
  const [timedOut, setTimedOut] = React.useState(false);
  const status = useRepoIntelStatus(repoId, polling);
  const resync = useResyncRepoIntel(repoId);

  const finished = polling && resyncFinished(baseline, status.data?.updatedAt);

  // Sync with the server: once the polled index state advances, stop polling and re-read the map.
  React.useEffect(() => {
    if (!finished) return;
    setPolling(false);
    void qc.invalidateQueries({ queryKey: blastKey(prId) });
  }, [finished, qc, prId]);

  React.useEffect(() => {
    if (!polling) return;
    const id = setTimeout(() => {
      setPolling(false);
      setTimedOut(true);
    }, RESYNC_POLL_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [polling]);

  const start = async () => {
    setBaseline(undefined);
    setTimedOut(false);
    setPolling(true);
    // Read the baseline fresh: a state that has not loaded yet would make the
    // first poll look like a finished resync.
    const before = await status.refetch();
    setBaseline(before.data?.updatedAt ?? null);
    resync.mutate(undefined, { onError: () => setPolling(false) });
  };

  return { polling, timedOut, start };
}

export const prHistoryKey =(prId: string | null | undefined) => ["pr-history", prId] as const;

/** GET /pulls/:id/history — prior merged PRs touching the same files. */
export function usePrHistory(prId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: prHistoryKey(prId),
    queryFn: () => api.get<PrHistory>(`/pulls/${prId}/history`),
    enabled: !!prId && enabled,
    staleTime: HISTORY_STALE_MS,
  });
}
