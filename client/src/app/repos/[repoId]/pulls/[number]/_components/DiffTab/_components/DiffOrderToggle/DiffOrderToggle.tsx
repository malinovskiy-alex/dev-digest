/* DiffOrderToggle — the "Smart order | Original order" segmented pair on the
   Files changed tab. `aria-pressed` carries the current order to assistive
   tech, which cannot see the highlight. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import type { DiffOrder } from "../../constants";
import * as styles from "./styles";

export function DiffOrderToggle({
  value,
  onChange,
  disabled,
}: {
  value: DiffOrder;
  onChange: (value: DiffOrder) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("smartDiff.orderLabel")} className={styles.group}>
      <Button
        kind="tertiary"
        size="sm"
        active={value === "smart"}
        aria-pressed={value === "smart"}
        disabled={disabled}
        onClick={() => onChange("smart")}
      >
        {t("smartDiff.smartOrder")}
      </Button>
      <Button
        kind="tertiary"
        size="sm"
        active={value === "original"}
        aria-pressed={value === "original"}
        disabled={disabled}
        onClick={() => onChange("original")}
      >
        {t("smartDiff.originalOrder")}
      </Button>
    </div>
  );
}
