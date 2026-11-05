/* LastRunTime — a run time as a relative time ("4 minutes ago") with the
   absolute date and time on hover and keyboard focus (R-55); none → "—".
   `now` comes from `useNow` — next-intl reports an error on every render
   without it (client/INSIGHTS.md, 2026-11-01). */
"use client";

import React from "react";
import { useFormatter, useNow } from "next-intl";
import { HoverNote } from "@/components/hover-note";
import { ABSOLUTE_FORMAT, NOW_TICK_MS } from "./constants";
import { cx } from "./styles";

export function LastRunTime({ iso }: { iso: string | null }): React.JSX.Element {
  const format = useFormatter();
  const tick = useNow({ updateInterval: NOW_TICK_MS });
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return <span className={cx.value}>—</span>;
  // `now` is coarse (ticks once a minute); never let it fall behind the run.
  const now = at.getTime() > tick.getTime() ? at : tick;
  return (
    <HoverNote className={cx.value} tooltip={format.dateTime(at, ABSOLUTE_FORMAT)}>
      {format.relativeTime(at, now)}
    </HoverNote>
  );
}
