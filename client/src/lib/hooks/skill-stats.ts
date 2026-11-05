/* hooks/skill-stats.ts — React Query reads for the skill Stats tab and the skill
   cards' pull frequency (L08 skill-stats). Both are plain GETs over stored rows
   (R-52): no mutation, no polling, no `placeholderData` on the stats — a new
   range is a new key, so the tab shows its skeleton rather than the previous
   range's figures (R-30). Imported directly, not through the hooks barrel.

   Both keys live under `["skills", …]`, so every skill write that already
   invalidates `["skills"]` (create, edit, toggle, delete, import —
   `hooks/skills.ts`) refreshes the cards' pull frequency and the open Stats tab
   too: an off skill shows its note and "0 agents" without a remount (F-06). */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PullFrequency, SkillStatsReport, SkillsPullFrequencyReport } from "@devdigest/shared";
import { api, ApiError } from "@/lib/api";
import { browserTimeZone, lastThirtyDays, perfRangeQuery, type PerfRange } from "@/lib/perf-range";

export const skillStatsKey = (skillId: string, from: string, to: string, tz: string) =>
  ["skills", "stats", skillId, from, to, tz] as const;

/** No window in the key: the window is taken when the read runs (see `useSkillsPullFrequency`). */
export const skillsPullFrequencyKey = (tz: string) => ["skills", "pull-frequency", tz] as const;

/** A 404 will not heal on retry (the skill is gone); anything else gets one retry. */
function retryUnlessGone(count: number, err: unknown): boolean {
  return !(err instanceof ApiError && err.status === 404) && count < 1;
}

/**
 * One skill's figures for one applied range (R-19). A 404 means the skill was
 * deleted under the tab (R-58): the skill query is invalidated so it re-reads,
 * 404s too, and the page shows its existing not-found state (D-15).
 */
export function useSkillStats(skillId: string, range: PerfRange) {
  const qc = useQueryClient();
  const tz = browserTimeZone();
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  return useQuery({
    queryKey: skillStatsKey(skillId, from, to, tz),
    queryFn: async () => {
      try {
        return await api.get<SkillStatsReport>(
          `/skills/${encodeURIComponent(skillId)}/stats?${perfRangeQuery(range, tz, "day")}`,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) void qc.invalidateQueries({ queryKey: ["skill", skillId] });
        throw e;
      }
    },
    enabled: !!skillId,
    retry: retryUnlessGone,
  });
}

/**
 * Every skill's pull frequency over the 30 × 24 hours ending when the read runs
 * — the first time the skills page loads (R-73) — in ONE read for all the cards
 * of a page (R-74). `data` is a map by skill id.
 *
 * The window is NOT in the key and the result never goes stale on its own:
 * `/skills/[id]` remounts on every rail click, and a mount-time window in the
 * key made each click a new GET with every card back to its placeholder (F-04).
 * Now a remount reads the cache. The read runs again only when a skill write
 * invalidates `["skills"]` (its window then ends at that moment), on a full
 * page load, or after the skills pages were left for longer than the query's
 * cache time. A Stats-tab range change never moves the cards.
 */
export function useSkillsPullFrequency() {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: skillsPullFrequencyKey(tz),
    queryFn: () =>
      api.get<SkillsPullFrequencyReport>(`/skills/pull-frequency?${perfRangeQuery(lastThirtyDays(new Date()), tz, "day")}`),
    staleTime: Infinity,
    select: (report): ReadonlyMap<string, PullFrequency> =>
      new Map(report.skills.map((s) => [s.skill_id, s.pull_frequency])),
  });
}
