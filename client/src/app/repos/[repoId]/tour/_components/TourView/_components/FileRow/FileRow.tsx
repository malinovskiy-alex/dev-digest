/* FileRow — one critical-path or reading-path file: the path (middle-cut,
   full path in its tooltip, AC-78), the model's reason or the deterministic
   one (AC-36, AC-49), and "Open" to GitHub at the tour revision in a new tab
   (AC-37, AC-79).

   Unnumbered (critical paths, design D-12): an inner card — file icon, the
   path, "— reason", an outlined "Open" at the right. Numbered (reading path,
   D-14): a round number badge, the path on the first line and the reason on
   the second, with a quiet "Open" at the right. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { TourFileRow } from "@devdigest/shared";
import { middleTruncate } from "@/lib/context-docs";
import { PATH_MAX } from "./constants";
import { fileHref } from "./helpers";
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
  const reason = row.reason ?? t("reason.index", { importers: row.importers, top: row.top_percent });
  const path = (
    <code title={row.path} className={cx.path}>
      {middleTruncate(row.path, PATH_MAX)}
    </code>
  );
  const open = href && (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("open", { path: row.path })}
      className={index === undefined ? cx.open : cx.openQuiet}
    >
      {t("openShort")}
    </a>
  );

  if (index !== undefined) {
    return (
      <li className={cx.numbered}>
        <span className={cx.badge}>{t("listNumber", { n: index })}</span>
        <div className={cx.lines}>
          {path}
          <span className={cx.why}>{reason}</span>
        </div>
        {open}
      </li>
    );
  }

  return (
    <li className={cx.card}>
      <Icon.FileText size={16} aria-hidden="true" className={cx.fileIcon} />
      <span className={cx.text}>
        {path}
        <span className={cx.reason}>{t("rowReason", { reason })}</span>
      </span>
      {open}
    </li>
  );
}
