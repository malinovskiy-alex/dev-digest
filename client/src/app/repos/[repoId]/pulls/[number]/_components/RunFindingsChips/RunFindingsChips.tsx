/* The timeline's severity chips, with the run's findings one hover away.

   The timeline is for scanning, so the chips still read as a tally rather than
   a control — but a reader who wants to know WHICH two criticals a run found
   should not have to scroll down to the run card to see. The panel and its
   open/close rules are the same ones the PR list uses; the only difference is
   where the findings come from: this tab already holds them, so there is
   nothing to fetch and nothing that can be stale against the chips beside it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import { SeverityChips, type SeverityCountMap } from "@/components/severity-chips";
import { FindingsPreviewPanel, useFindingsPopover } from "@/components/findings-popover";
import { s } from "./styles";

export interface RunFindingsChipsProps {
  /** This run's findings, already in memory. Empty when its review row is gone. */
  findings: FindingRecord[];
  counts?: SeverityCountMap;
  /** What the chips show when the counts are empty (the plain finding total). */
  emptyFallback: React.ReactNode;
}

export function RunFindingsChips({ findings, counts, emptyFallback }: RunFindingsChipsProps) {
  const t = useTranslations("prReview");
  const canPreview = findings.length > 0;

  const { anchor, triggerProps, panelProps } = useFindingsPopover({ enabled: canPreview });

  return (
    <>
      <button
        type="button"
        {...triggerProps}
        title={canPreview ? t("timeline.previewFindings") : undefined}
        style={s.trigger(canPreview)}
      >
        <SeverityChips counts={counts} emptyFallback={emptyFallback} />
      </button>
      {anchor && <FindingsPreviewPanel {...panelProps} anchor={anchor} findings={findings} />}
    </>
  );
}

export default RunFindingsChips;
