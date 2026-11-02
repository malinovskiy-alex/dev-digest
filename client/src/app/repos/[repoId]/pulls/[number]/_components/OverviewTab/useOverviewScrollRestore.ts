/* useOverviewScrollRestore — Back from Files changed returns to Overview at
   the scroll position it had before the focus navigation (R-77, D-32).

   Only a Back restores: the position is marked by a `popstate` listener the
   navigation installed (useBriefNavigation); a plain tab click finds it
   unmarked and only forgets it. The scroll waits until no query is fetching —
   the PR Brief, Intent, Blast radius and PR history cards all give the page
   its height — or RESTORE_MAX_WAIT_MS, whichever comes first. */
"use client";

import React from "react";
import { useIsFetching } from "@tanstack/react-query";
import { RESTORE_MAX_WAIT_MS } from "./constants";
import { disarmOverviewBack } from "./backListener";
import { sessionStore, takeOverviewScroll } from "./helpers";

export function useOverviewScrollRestore(prId: string): void {
  const fetching = useIsFetching();
  const [target, setTarget] = React.useState<number | null>(null);
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const y = takeOverviewScroll(sessionStore(), prId);
    // The saved position is consumed or forgotten now, so a Back listener
    // still pending (a tab-click return) has nothing left to do (F-22).
    disarmOverviewBack(prId);
    if (y == null) return;
    setTarget(y);
    setTimedOut(false);
    const id = setTimeout(() => setTimedOut(true), RESTORE_MAX_WAIT_MS);
    return () => clearTimeout(id);
  }, [prId]);

  React.useEffect(() => {
    if (target == null || (fetching > 0 && !timedOut)) return;
    window.scrollTo(0, target);
    setTarget(null);
  }, [target, fetching, timedOut]);
}
