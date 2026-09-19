/* The PR list's findings preview — what the latest run actually found, without
   leaving the list.

   Data comes from the existing usePrReviews(prId): the panel only mounts while
   it is open, so mounting IS the fetch, and its cache key is the one the PR
   detail page reads. Hovering a row therefore warms the click that usually
   follows it. That is why there is no bespoke preview endpoint — a new one
   would fill a separate cache key and do the same work twice.

   The panel itself is shared with the PR detail page's timeline; all this adds
   is where the findings come from. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FindingsPreviewPanel } from "@/components/findings-popover";
import { usePrReviews } from "@/lib/hooks/reviews";
import { latestReviewOf } from "./helpers";

export interface FindingsPopoverProps {
  id: string;
  prId: string;
  /** The trigger's viewport rect, captured when the popover opened. */
  anchor: DOMRect;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  /** Let the pointer travel from the chips onto the panel without it closing. */
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function FindingsPopover({
  id,
  prId,
  anchor,
  panelRef,
  onMouseEnter,
  onMouseLeave,
}: FindingsPopoverProps) {
  const t = useTranslations("prReview");
  const { data, isLoading, isError } = usePrReviews(prId);

  const review = latestReviewOf(data);

  return (
    <FindingsPreviewPanel
      id={id}
      anchor={anchor}
      panelRef={panelRef}
      findings={review?.findings ?? []}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
      emptyMessage={t("list.findingsPopover.empty")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

export default FindingsPopover;
