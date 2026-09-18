/* The PR list's findings preview — what the latest run actually found, without
   leaving the list.

   Data comes from the existing usePrReviews(prId): the panel only mounts while
   it is open, so mounting IS the fetch, and its cache key is the one the PR
   detail page reads. Hovering a row therefore warms the click that usually
   follows it. That is why there is no bespoke preview endpoint — a new one
   would fill a separate cache key and do the same work twice. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@devdigest/ui";
import { usePrReviews } from "@/lib/hooks/reviews";
import { FindingPreview } from "../FindingPreview";
import { PREVIEW_LIMIT } from "./constants";
import { bySeverity, latestReviewOf, panelPosition } from "./helpers";
import { s } from "./styles";

export interface FindingsPopoverProps {
  id: string;
  prId: string;
  /** The trigger's viewport rect, captured when the popover opened. */
  anchor: DOMRect;
  /** Let the pointer travel from the chips onto the panel without it closing. */
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function FindingsPopover({
  id,
  prId,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: FindingsPopoverProps) {
  const t = useTranslations("prReview");
  const { data, isLoading, isError } = usePrReviews(prId);

  const review = latestReviewOf(data);
  const findings = review ? bySeverity(review.findings) : [];
  const title = t("list.findingsPopover.title", { count: findings.length });
  const hidden = Math.max(0, findings.length - PREVIEW_LIMIT);

  return (
    <div
      id={id}
      role="dialog"
      aria-label={title}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // The row behind this navigates on click; the panel is not part of it.
      onClick={(e) => e.stopPropagation()}
      style={s.panel(panelPosition(anchor))}
    >
      {isLoading ? (
        <div style={s.state}>
          <Skeleton height={44} />
          <div style={{ height: 8 }} />
          <Skeleton height={44} />
        </div>
      ) : isError ? (
        <div style={s.state}>{t("list.findingsPopover.error")}</div>
      ) : findings.length === 0 ? (
        <div style={s.state}>{t("list.findingsPopover.empty")}</div>
      ) : (
        <>
          <div style={s.title}>{title}</div>
          {findings.slice(0, PREVIEW_LIMIT).map((f, i) => (
            <React.Fragment key={f.id}>
              {i > 0 && <div style={s.divider} />}
              <FindingPreview f={f} />
            </React.Fragment>
          ))}
          {hidden > 0 && (
            <div style={s.more}>{t("list.findingsPopover.more", { count: hidden })}</div>
          )}
        </>
      )}
    </div>
  );
}

export default FindingsPopover;
