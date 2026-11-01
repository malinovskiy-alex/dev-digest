/* ReadingPathSection — up to eight files in rank order, numbered (AC-48), or
   why the repository has no reading path yet, with the index reason (AC-51). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourFileList } from "@devdigest/shared";
import { FileRow } from "../FileRow";
import { cx } from "./styles";

export function ReadingPathSection({
  list,
  repoFullName,
  revision,
  indexReasonText,
}: {
  list: TourFileList;
  repoFullName: string;
  revision: string | null;
  indexReasonText: string | null;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  if (list.rows.length === 0) {
    const text =
      list.gap === "needs_clone"
        ? t("gaps.needsClone")
        : indexReasonText
          ? t("gaps.notRankedReason", { reason: indexReasonText })
          : t("gaps.notRanked");
    return <p className={cx.gap}>{text}</p>;
  }
  return (
    <ol className={cx.list}>
      {list.rows.map((row, i) => (
        <FileRow key={row.path} index={i + 1} row={row} repoFullName={repoFullName} revision={revision} />
      ))}
    </ol>
  );
}
