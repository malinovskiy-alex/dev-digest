import type { Skill } from "@devdigest/shared";
import type { CardPullFreq } from "./_components/PullFreqBadge";

/**
 * D6 (the trust model): a skill that came from outside is somebody else's
 * instructions. It is stored disabled and stays flagged until a human has read
 * the body and enabled it. Once enabled, the badge goes away.
 */
export function needsVetting(skill: Skill): boolean {
  return skill.source !== "manual" && !skill.enabled;
}


/** The fields of the page's one pull-frequency query a card needs. */
export interface PullFreqQueryState {
  isPending: boolean;
  isError: boolean;
  data?: ReadonlyMap<string, { rate: number | null }>;
}

/**
 * One card's slice of the page's single pull-frequency read (R-74, D-11).
 *
 * Cached data wins over the error flag (F-24): a background refetch that fails
 * keeps TanStack Query's last `data`, so the cards keep the figure they had —
 * the error state is only for a read that never landed.
 *
 * A skill the read does not list (created after it landed) gets no percentage
 * rather than a guess, but still a `CardPullFreq`, never `undefined`: the card
 * reserves the hint's line whenever one is passed (F-20), so a new card is as
 * tall as its neighbours. It reuses `error` because that variant already means
 * "no figure for this card" — the badge shows the agent count only and the hint
 * stays reserve-only; a separate variant would render identically.
 */
export function toCardPullFreq(q: PullFreqQueryState, skillId: string): CardPullFreq {
  if (q.data) {
    const pf = q.data.get(skillId);
    return pf ? { status: "ready", rate: pf.rate } : { status: "error" };
  }
  if (q.isError) return { status: "error" };
  return { status: "loading" };
}
