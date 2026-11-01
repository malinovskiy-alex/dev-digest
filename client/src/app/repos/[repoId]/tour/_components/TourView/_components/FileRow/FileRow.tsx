/* FileRow — one critical-path or reading-path file: the path (middle-cut,
   full path in its tooltip, AC-78), the model's reason or the deterministic
   one (AC-36, AC-49), and "Open" to GitHub at the tour revision in a new tab
   (AC-37, AC-79). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourFileRow } from "@devdigest/shared";
import { middleTruncate } from "@/lib/context-docs";
import { PATH_MAX, fileHref } from "./helpers";
import { cx } from "./styles";

export function FileRow({
  index,
  row,
  repoFullName,
  revision,
}: {
  index?: number;
  row: TourFileRow;
  repoFullName: string;
  revision: string | null;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const href = fileHref(repoFullName, revision, row.path);
  return (
    <li className={cx.row}>
      {index !== undefined && <span className={cx.index}>{index}.</span>}
      <code title={row.path} className={cx.path}>
        {middleTruncate(row.path, PATH_MAX)}
      </code>
      <span className={cx.reason}>
        {"— "}
        {row.reason ?? t("reason.index", { importers: row.importers, top: row.top_percent })}
      </span>
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t("open", { path: row.path })} className={cx.open}>
          {t("openShort")}
        </a>
      )}
    </li>
  );
}
