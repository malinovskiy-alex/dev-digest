/* The PR list's Findings cell: severity chips that preview the findings behind
   them on hover.

   All the hover state lives here rather than in the panel, because the trigger
   is what knows when the pointer left — and because the panel must unmount
   when closed, so that mounting it is what triggers its fetch. */
"use client";

import React from "react";
import type { PrMeta } from "@devdigest/shared";
import { SeverityChips, totalOf } from "@/components/severity-chips";
import { FindingsPopover } from "../FindingsPopover";
import { CLOSE_DELAY_MS, OPEN_DELAY_MS } from "./constants";
import { s } from "./styles";

export interface FindingsCellProps {
  pr: PrMeta;
}

export function FindingsCell({ pr }: FindingsCellProps) {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const popoverId = React.useId();

  const hasFindings = totalOf(pr.findings) > 0;
  const prId = pr.id ?? null;
  const canPreview = hasFindings && prId != null;

  const clearTimers = React.useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  // Rows unmount constantly — the list re-filters on every keystroke — so a
  // pending timer must never outlive its row.
  React.useEffect(() => clearTimers, [clearTimers]);

  const open = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  }, []);

  const scheduleOpen = React.useCallback(() => {
    if (!canPreview) return;
    clearTimers();
    openTimer.current = setTimeout(open, OPEN_DELAY_MS);
  }, [canPreview, clearTimers, open]);

  const scheduleClose = React.useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
  }, [clearTimers]);

  const closeNow = React.useCallback(() => {
    clearTimers();
    setAnchor(null);
  }, [clearTimers]);

  // The panel is fixed-positioned against a rect captured on open, so it would
  // drift away from its row on scroll. Close instead of chasing it.
  React.useEffect(() => {
    if (!anchor) return;
    const onScroll = () => closeNow();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [anchor, closeNow]);

  return (
    <div style={s.cell} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={anchor != null}
        aria-controls={anchor != null ? popoverId : undefined}
        // The row navigates on click. Stop both the mouse path and the
        // Enter/Space path, which fires a synthetic click that would bubble.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={() => canPreview && open()}
        onBlur={closeNow}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeNow();
        }}
        style={s.trigger}
      >
        <SeverityChips counts={pr.findings} emptyFallback={<span style={s.muted}>—</span>} />
      </button>
      {anchor && prId && (
        <FindingsPopover
          id={popoverId}
          prId={prId}
          anchor={anchor}
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleClose}
        />
      )}
    </div>
  );
}

export default FindingsCell;
