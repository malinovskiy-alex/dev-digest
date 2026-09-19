/* The panel a findings popover opens: what a run found, worst first, read-only.

   Presentational on purpose. It takes findings rather than fetching them, so
   the PR list can hand it a lazily-fetched review while the PR detail timeline
   hands it findings the tab already holds. The two surfaces then render the
   same panel and cannot drift apart. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingPreview } from "./FindingPreview";
import { PREVIEW_LIMIT } from "./constants";
import { bySeverity, panelPosition } from "./helpers";
import { s } from "./styles";

export interface FindingsPreviewPanelProps {
  id: string;
  /** The trigger's viewport rect, captured when the popover opened. */
  anchor: DOMRect;
  findings: FindingRecord[];
  /** For callers that fetch on open; in-memory callers leave it "ready". */
  state?: "loading" | "error" | "ready";
  /** Overrides the generic empty line when the caller can say something better. */
  emptyMessage?: string;
  /** Outside-click detection needs the panel node — it renders outside the
   *  trigger's subtree, so `contains` on the trigger would never match. */
  panelRef?: React.Ref<HTMLDivElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function FindingsPreviewPanel({
  id,
  anchor,
  findings,
  state = "ready",
  emptyMessage,
  panelRef,
  onMouseEnter,
  onMouseLeave,
}: FindingsPreviewPanelProps) {
  const t = useTranslations("prReview");

  const sorted = React.useMemo(() => bySeverity(findings), [findings]);
  const title = t("findingsPopover.title", { count: sorted.length });
  const hidden = Math.max(0, sorted.length - PREVIEW_LIMIT);

  return (
    <div
      id={id}
      ref={panelRef}
      // A tooltip, not a dialog: read-only, transient, and focus never enters
      // it. The trigger points at it with aria-describedby.
      role="tooltip"
      aria-label={title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // The row behind this may navigate on click; the panel is not part of it.
      onClick={(e) => e.stopPropagation()}
      style={s.panel(panelPosition(anchor))}
    >
      {state === "loading" ? (
        <div style={s.state}>
          <Skeleton height={44} />
          <div style={{ height: 8 }} />
          <Skeleton height={44} />
        </div>
      ) : state === "error" ? (
        <div style={s.state}>{t("findingsPopover.error")}</div>
      ) : sorted.length === 0 ? (
        <div style={s.state}>{emptyMessage ?? t("findingsPopover.empty")}</div>
      ) : (
        <>
          <div style={s.title}>{title}</div>
          {sorted.slice(0, PREVIEW_LIMIT).map((f, i) => (
            <React.Fragment key={f.id}>
              {i > 0 && <div style={s.divider} />}
              <FindingPreview f={f} />
            </React.Fragment>
          ))}
          {hidden > 0 && <div style={s.more}>{t("findingsPopover.more", { count: hidden })}</div>}
        </>
      )}
    </div>
  );
}

export default FindingsPreviewPanel;
