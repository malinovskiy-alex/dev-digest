/* CostEstimateNote — the one-per-screen note that every cost is a DevDigest
   estimate, not reconciled billing (R-46, D-10). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cx } from "./styles";

export function CostEstimateNote(): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  return <p className={cx.note}>{t("estimate.note")}</p>;
}
