"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { BlastView } from "../../constants";
import { cx } from "./styles";

const VIEWS: readonly BlastView[] = ["tree", "graph"];

/** Tree / Graph switch — two pressed-state buttons in a labelled group. */
export function BlastViewToggle({
  value,
  onChange,
}: {
  value: BlastView;
  onChange: (view: BlastView) => void;
}): React.JSX.Element {
  const t = useTranslations("blast");
  return (
    <div role="group" aria-label={t("view.label")} className={cx.group}>
      {VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          className={value === v ? cx.active : cx.button}
          onClick={() => onChange(v)}
        >
          {t(`view.${v}`)}
        </button>
      ))}
    </div>
  );
}
