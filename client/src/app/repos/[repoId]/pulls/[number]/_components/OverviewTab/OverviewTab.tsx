"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel } from "@devdigest/ui";
import { usePrBrief } from "@/lib/hooks/brief";
import { BlastRadiusCard } from "../BlastRadiusCard";
import { BriefRiskAreas, BriefRiskAreasSkeleton } from "../BriefRiskAreas";
import { IntentCard } from "../IntentCard";
import { PrBriefCard } from "../PrBriefCard";
import { briefGridClass, s } from "./styles";
import { useBriefNavigation } from "./useBriefNavigation";
import { useOverviewScrollRestore } from "./useOverviewScrollRestore";

interface OverviewTabProps {
  prId: string;
  prBody: string | null | undefined;
  repoId: string;
  repoFullName: string | null;
  headSha: string;
  /** The PR's changed file paths: a brief reference outside them is a blast-map file (R-56, R-76). */
  changedPaths: string[];
  /** Open Files changed at a file (and line) — adds a history entry (R-53, R-77). */
  onOpenInDiff: (path: string, line: number | null) => void;
}

export function OverviewTab({
  prId,
  prBody,
  repoId,
  repoFullName,
  headSha,
  changedPaths,
  onOpenInDiff,
}: OverviewTabProps) {
  const t = useTranslations("shell");
  const nav = useBriefNavigation({ prId, changedPaths, onOpenInDiff });
  // Same query (and cache entry) as the PR Brief block: it decides whether the
  // Intent card shows the brief's Risk areas (R-63) or its own list (R-67).
  const brief = usePrBrief(prId);
  const view = brief.data;
  // Back from Files changed: restore the scroll saved before the focus navigation (R-77, D-32).
  useOverviewScrollRestore(prId);
  // The Risk areas live in the Intent card (R-63), so their skeleton does too
  // while a generation runs (R-05, F-16); otherwise the stored brief's risks,
  // or nothing — the intent's own list (R-67).
  const riskAreas = view?.generating ? (
    <BriefRiskAreasSkeleton />
  ) : view?.brief ? (
    <BriefRiskAreas risks={view.brief.risks.risks} nav={nav} />
  ) : undefined;

  return (
    <>
      <PrBriefCard prId={prId} nav={nav} />
      <div className={briefGridClass}>
        <IntentCard prId={prId} riskAreas={riskAreas} />
        <BlastRadiusCard prId={prId} repoId={repoId} repoFullName={repoFullName} headSha={headSha} />
      </div>
      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">{t("prDetail.description")}</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </>
  );
}
