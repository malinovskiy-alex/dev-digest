/* CriticalPathsSection — up to six files along the import graph's dependency
   chains, unnumbered (AC-35), or why there are none (AC-38). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourFileList } from "@devdigest/shared";
import { FileRow } from "../FileRow";
import { cx } from "./styles";

export function CriticalPathsSection({
  list,
  repoFullName,
  revision,
}: {
  list: TourFileList;
  repoFullName: string;
  revision: string | null;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  if (list.rows.length === 0) {
    const text =
      list.gap === "needs_clone"
        ? t("gaps.needsClone")
        : list.gap === "needs_index"
          ? t("gaps.criticalNeedsIndex") // not indexed yet: no graph to be empty (F-57)
          : t("gaps.noEdges");
    return <p className={cx.gap}>{text}</p>;
  }
  return (
    <ul className={cx.list}>
      {list.rows.map((row) => (
        <FileRow key={row.path} row={row} repoFullName={repoFullName} revision={revision} />
      ))}
    </ul>
  );
}
