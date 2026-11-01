/* useBriefNavigation — what a PR Brief reference does when activated (D-30).
   A file in the PR's diff → save the Overview scroll (D-32) and navigate to
   Files changed (R-53, R-55). A file outside it (a blast-map file) → stay on
   Overview and show "File not in this PR's diff" next to that item for 4 s, or
   until another item is activated (R-56). One notice at a time. */
"use client";

import React from "react";
import type { BriefNavigation } from "@/lib/hooks/brief";
import { NOT_IN_DIFF_MS } from "./constants";
import { markOverviewBack, saveOverviewScroll, sessionStore } from "./helpers";

export function useBriefNavigation({
  prId,
  changedPaths,
  onOpenInDiff,
}: {
  prId: string;
  changedPaths: string[];
  onOpenInDiff: (path: string, line: number | null) => void;
}): BriefNavigation {
  const [noticeKey, setNoticeKey] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = React.useMemo(() => new Set(changedPaths), [changedPaths]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const inDiff = (path: string) => changed.has(path);

  const activate = (key: string, path: string, line: number | null) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inDiff(path)) {
      setNoticeKey(null);
      saveOverviewScroll(sessionStore(), prId, window.scrollY);
      // The navigation pushes a history entry; Back fires `popstate`, which
      // marks the saved position as restorable. The listener lives on
      // `window`, so it outlives this (soon unmounted) tab (R-77, F-14).
      window.addEventListener("popstate", () => markOverviewBack(sessionStore(), prId), { once: true });
      onOpenInDiff(path, line);
      return;
    }
    setNoticeKey(key);
    timer.current = setTimeout(() => {
      timer.current = null;
      setNoticeKey(null);
    }, NOT_IN_DIFF_MS);
  };

  return { activate, noticeKey, inDiff };
}
