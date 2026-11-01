/* BriefRiskAreasSkeleton — the Risk areas placeholder shown in the Intent
   card's slot while a PR Brief generation runs (R-05, R-63). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@devdigest/ui";
import { cx } from "./styles";

export function BriefRiskAreasSkeleton(): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div className={cx.skeleton} role="status" aria-label={t("generating")}>
      <Skeleton width="60%" />
      <Skeleton width="50%" />
      <Skeleton width="55%" />
    </div>
  );
}
