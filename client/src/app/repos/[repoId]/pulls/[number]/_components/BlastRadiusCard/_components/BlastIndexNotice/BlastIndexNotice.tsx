"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import { useBlastResync } from "@/lib/hooks/blast";
import type { IndexNotice } from "../../helpers";
import { cx } from "./styles";

interface BlastIndexNoticeProps {
  notice: IndexNotice;
  repoId: string;
  prId: string;
}

/** "Index incomplete — <reason>" with a Resync button beside it. The resync
    itself (poll, timeout, map refresh) lives in useBlastResync. */
export function BlastIndexNotice({ notice, repoId, prId }: BlastIndexNoticeProps): React.JSX.Element {
  const t = useTranslations("blast");
  const { polling, timedOut, start } = useBlastResync(repoId, prId);
  const onResync = () => void start();

  return (
    <div role="status" className={cx.box}>
      <div className={cx.row}>
        <span className={cx.badge}>
          <Icon.AlertTriangle size={12} aria-hidden />
          {t("index.incomplete")}
        </span>
        <span className={cx.reason}>{t(`reason.${notice.reason}`)}</span>
        <span className={cx.action}>
          <Button size="sm" icon="RefreshCw" loading={polling} disabled={polling} onClick={onResync}>
            {polling ? t("index.resyncing") : t("index.resync")}
          </Button>
        </span>
      </div>
      {timedOut && <p className={cx.hint}>{t("index.resyncTimeout")}</p>}
    </div>
  );
}
