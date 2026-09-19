/* Open/close behaviour for a findings popover, shared by every trigger that
   has one.

   All the state lives with the trigger rather than the panel, because the
   trigger is what knows when the pointer left — and because the panel must
   unmount when closed, so that mounting it is what triggers a lazy fetch.

   Two ways in, and they close differently. Hovering opens after a beat and
   closes as soon as the pointer leaves; clicking or tapping PINS the panel,
   which then survives the pointer leaving and closes on a second click, on a
   click outside, on Escape, or on scroll. Without the pin, touch users get
   nothing at all — there is no hover on a phone — and a mouse user who clicks
   to read a long panel watches it vanish as they move towards it. */
"use client";

import React from "react";
import { CLOSE_DELAY_MS, OPEN_DELAY_MS } from "./constants";

type OpenMode = "hover" | "pin";

export interface FindingsPopoverController {
  /** The trigger rect the panel positions against; `null` while closed. */
  anchor: DOMRect | null;
  isOpen: boolean;
  /** Stable id tying the trigger's aria-controls to the panel. */
  popoverId: string;
  triggerProps: {
    ref: React.RefObject<HTMLButtonElement | null>;
    "aria-haspopup": "dialog";
    "aria-expanded": boolean;
    "aria-controls": string | undefined;
    onClick: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  panelProps: {
    id: string;
    panelRef: React.RefObject<HTMLDivElement | null>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  close: () => void;
}

export function useFindingsPopover({ enabled }: { enabled: boolean }): FindingsPopoverController {
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const [mode, setMode] = React.useState<OpenMode>("hover");
  const popoverId = React.useId();

  const clearTimers = React.useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  // Rows unmount constantly — a list re-filters on every keystroke — so a
  // pending timer must never outlive its row.
  React.useEffect(() => clearTimers, [clearTimers]);

  const open = React.useCallback((how: OpenMode) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMode(how);
    setAnchor(rect);
  }, []);

  const closeNow = React.useCallback(() => {
    clearTimers();
    setAnchor(null);
  }, [clearTimers]);

  const scheduleOpen = React.useCallback(() => {
    if (!enabled) return;
    clearTimers();
    openTimer.current = setTimeout(() => open("hover"), OPEN_DELAY_MS);
  }, [enabled, clearTimers, open]);

  const scheduleClose = React.useCallback(() => {
    clearTimers();
    // A pinned panel is deliberate; only the pointer-opened one follows the
    // pointer out.
    if (mode === "pin" && anchor) return;
    closeTimer.current = setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
  }, [clearTimers, mode, anchor]);

  const toggle = React.useCallback(
    (e: React.MouseEvent) => {
      // Both paths, always: the row this sits in must never navigate from a
      // click on the trigger — including the synthetic click Enter/Space fires.
      e.preventDefault();
      e.stopPropagation();
      if (!enabled) return;
      clearTimers();
      // Clicking a panel the pointer already opened pins it rather than
      // closing it: on a mouse, hover always wins the race to open, so a
      // toggle would make the click read as "dismiss" every time.
      if (!anchor) open("pin");
      else if (mode === "hover") setMode("pin");
      else setAnchor(null);
    },
    [enabled, anchor, mode, clearTimers, open],
  );

  // The panel is fixed-positioned against a rect captured on open, so it would
  // drift away from its trigger when the page behind it scrolls. Close instead
  // of chasing it — but the listener has to be in the capture phase to see a
  // scrolling ancestor at all, which means it also sees the panel scrolling its
  // OWN overflow. Reading a long run's findings would close the panel under the
  // reader, so a scroll that started inside it is not a page scroll.
  React.useEffect(() => {
    if (!anchor) return;
    const onScroll = (e: Event) => {
      const panel = panelRef.current;
      // `instanceof Node` also rules out the window itself, which `contains`
      // refuses as an argument.
      const target = e.target instanceof Node ? e.target : null;
      if (panel && target && (panel === target || panel.contains(target))) return;
      closeNow();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", closeNow);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", closeNow);
    };
  }, [anchor, closeNow]);

  // Only a pinned panel needs this: the hover one is already gone by the time
  // a click lands anywhere else.
  React.useEffect(() => {
    if (!anchor || mode !== "pin") return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeNow();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [anchor, mode, closeNow]);

  return {
    anchor,
    isOpen: anchor != null,
    popoverId,
    triggerProps: {
      ref: triggerRef,
      "aria-haspopup": "dialog",
      "aria-expanded": anchor != null,
      "aria-controls": anchor != null ? popoverId : undefined,
      onClick: toggle,
      onMouseEnter: scheduleOpen,
      onMouseLeave: scheduleClose,
      onFocus: () => enabled && open("hover"),
      onBlur: closeNow,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") closeNow();
      },
    },
    panelProps: {
      id: popoverId,
      panelRef,
      onMouseEnter: clearTimers,
      onMouseLeave: scheduleClose,
    },
    close: closeNow,
  };
}
