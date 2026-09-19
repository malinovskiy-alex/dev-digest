/* The PR list's Findings cell: severity chips that preview the findings behind
   them on hover, and pin that preview open on a click or a tap.

   The open/close behaviour lives in useFindingsPopover, shared with the PR
   detail page's timeline. What is local here is the rule that this cell must
   never navigate: the whole row routes to the PR detail page. */
"use client";

import React from "react";
import type { PrMeta } from "@devdigest/shared";
import { SeverityChips, totalOf } from "@/components/severity-chips";
import { useFindingsPopover } from "@/components/findings-popover";
import { FindingsPopover } from "../FindingsPopover";
import { s } from "./styles";

export interface FindingsCellProps {
  pr: PrMeta;
}

export function FindingsCell({ pr }: FindingsCellProps) {
  const hasFindings = totalOf(pr.findings) > 0;
  const prId = pr.id ?? null;
  const canPreview = hasFindings && prId != null;

  const { anchor, triggerProps, panelProps } = useFindingsPopover({
    enabled: canPreview,
  });

  return (
    <div style={s.cell} onClick={(e) => e.stopPropagation()}>
      <button type="button" {...triggerProps} style={s.trigger(canPreview)}>
        <SeverityChips counts={pr.findings} emptyFallback={<span style={s.muted}>—</span>} />
      </button>
      {anchor && prId && (
        <FindingsPopover {...panelProps} prId={prId} anchor={anchor} />
      )}
    </div>
  );
}

export default FindingsCell;
