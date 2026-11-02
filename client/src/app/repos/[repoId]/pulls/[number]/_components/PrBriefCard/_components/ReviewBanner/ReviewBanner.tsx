/* ReviewBanner — the PR's latest review verdict at the top of the PR Brief
   block (R-78): the same VerdictBanner as Agent runs (R-83), with the stale
   badge (R-94) and one progress / failure note (R-102, R-104). No review → a
   muted line (R-101, R-103); reviews still loading or failed → nothing (R-99).
   It never shows a cost or tokens (R-98). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import { VerdictBanner } from "@/app/repos/[repoId]/pulls/[number]/_components/VerdictBanner";
import type { ReviewBannerState } from "./helpers";
import { cx } from "./styles";

export function ReviewBanner({
  state,
  text,
}: {
  state: ReviewBannerState;
  /** Replaces the review's summary when not `undefined`: the brief's summary or a skeleton (R-81, R-97). */
  text: React.ReactNode | undefined;
}): React.JSX.Element | null {
  const t = useTranslations("brief");
  if (state.kind === "hidden") return null;
  if (state.kind === "none") {
    return <p className={cx.line}>{state.running ? t("banner.runningNoReview") : t("banner.noReview")}</p>;
  }

  const { review, running, newestRunFailed, staleSha } = state;
  const note = running ? t("banner.running") : newestRunFailed ? t("banner.failed") : null;
  const notes =
    staleSha || note ? (
      <>
        {staleSha && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("banner.stale", { sha: staleSha })}
          </Badge>
        )}
        {note && <span>{note}</span>}
      </>
    ) : undefined;

  return (
    <div role="group" aria-label={t("banner.label")}>
      <VerdictBanner
        verdict={state.verdict}
        score={review.score}
        findingsCount={state.findingsCount}
        blockers={state.blockers}
        agentName={review.agent_name}
        summary={review.summary}
        summarySlot={text}
        notes={notes}
      />
    </div>
  );
}
