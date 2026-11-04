/* BriefRiskAreasSkeleton — the Risk areas placeholder shown in the Intent
   card's slot while a PR Brief generation runs (R-05, R-63). Purely visual
   (`aria-hidden`): the one live "Generating…" status is the PR Brief block's. */
"use client";

import React from "react";
import { Skeleton } from "@devdigest/ui";
import { cx } from "./styles";

export function BriefRiskAreasSkeleton(): React.JSX.Element {
  return (
    <div className={cx.skeleton} aria-hidden>
      <Skeleton width="60%" />
      <Skeleton width="50%" />
      <Skeleton width="55%" />
    </div>
  );
}
