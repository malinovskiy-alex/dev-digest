/* IndexedFooter — under the tree: how many documents were listed, what they
   weigh, when the list was read (R-66), and the refresh button (R-06). Refresh
   re-reads the local clone at its current HEAD; it never fetches from origin. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import { cx } from "./styles";

export interface IndexedFooterProps {
  files: number;
  tokens: number;
  /** ISO timestamp of the listing. */
  listedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export function IndexedFooter({
  files,
  tokens,
  listedAt,
  refreshing,
  onRefresh,
}: IndexedFooterProps): React.JSX.Element {
  const t = useTranslations("context");
  const time = new Date(listedAt).toLocaleTimeString();
  return (
    <div className={cx.footer}>
      <div className={cx.text}>
        <span>{t("footer.indexed", { files, tokens: tokens.toLocaleString() })}</span>
        <span className={cx.muted}>{t("footer.refreshed", { time })}</span>
      </div>
      <Button size="sm" kind="ghost" icon="RefreshCw" loading={refreshing} onClick={onRefresh}>
        {refreshing ? t("page.refreshing") : t("page.refresh")}
      </Button>
    </div>
  );
}
