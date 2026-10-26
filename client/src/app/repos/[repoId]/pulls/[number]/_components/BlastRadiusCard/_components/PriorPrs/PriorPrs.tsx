"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import type { PrHistory, PrHistoryItem } from "@devdigest/shared";
import { usePrHistory } from "@/lib/hooks/blast";
import { githubPrUrl } from "@/lib/github-urls";
import { OVERLAP_PREVIEW } from "./constants";
import { cx } from "./styles";

/* PriorPrs — "Prior PRs touching these files": merged PRs DevDigest has synced
   whose files overlap this PR's. Collapsed by default; the query runs on mount
   so the count shows while collapsed. It never claims "none" while candidates
   are still unchecked — the footer says how many were not looked at, and why. */
export function PriorPrs({
  prId,
  repoFullName,
}: {
  prId: string;
  repoFullName: string | null;
}): React.JSX.Element {
  const t = useTranslations("blast");
  const [open, setOpen] = React.useState(false);
  const history = usePrHistory(prId);
  const panelId = React.useId();
  const data = history.data;

  return (
    <div className={cx.wrap}>
      <button
        type="button"
        className={cx.header}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.History size={14} className={cx.muted} aria-hidden />
        <span className={cx.title}>{t("history.title")}</span>
        {history.isLoading ? (
          <Icon.RefreshCw size={12} className={cx.spinner} aria-label={t("history.loading")} />
        ) : data ? (
          <span className={cx.badge}>{data.history.length}</span>
        ) : null}
        <Icon.ChevronDown size={14} className={open ? cx.chevronOpen : cx.chevron} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className={cx.panel}>
          {history.isLoading ? (
            <p className={cx.note} role="status">
              {t("history.loading")}
            </p>
          ) : data ? (
            <HistoryBody data={data} repoFullName={repoFullName} />
          ) : history.error ? (
            <div role="alert" className={cx.error}>
              <p className="m-0">{t("history.error")}</p>
              <div>
                <Button size="sm" onClick={() => void history.refetch()}>
                  {t("retry")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HistoryBody({
  data,
  repoFullName,
}: {
  data: PrHistory;
  repoFullName: string | null;
}): React.JSX.Element {
  const t = useTranslations("blast");
  return (
    <>
      {data.history.length === 0 ? (
        <p className={cx.note}>{t("history.empty")}</p>
      ) : (
        <ul className={cx.list}>
          {data.history.map((item) => (
            <HistoryRow key={item.pr_number} item={item} repoFullName={repoFullName} />
          ))}
        </ul>
      )}
      <div className={cx.footer}>
        <p className={cx.note}>{t("history.scope", { count: data.candidates })}</p>
        {data.unchecked > 0 && (
          <p className={cx.warn} role="status">
            {t(data.github_unavailable ? "history.githubUnavailable" : "history.unchecked", {
              count: data.unchecked,
            })}
          </p>
        )}
      </div>
    </>
  );
}

function HistoryRow({
  item,
  repoFullName,
}: {
  item: PrHistoryItem;
  repoFullName: string | null;
}): React.JSX.Element {
  const t = useTranslations("blast");
  const format = useFormatter();
  const date = item.merged_at ? new Date(item.merged_at) : null;
  const shown = item.files_overlap.slice(0, OVERLAP_PREVIEW);
  const rest = item.files_overlap.length - shown.length;
  const number = `#${item.pr_number}`;

  return (
    <li className={cx.row}>
      <div className={cx.rowHead}>
        {repoFullName ? (
          <a
            className={cx.number}
            href={githubPrUrl(repoFullName, item.pr_number)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("history.openOnGithub", { number: item.pr_number })}
          >
            {number}
          </a>
        ) : (
          <span className={cx.numberPlain}>{number}</span>
        )}
        <span className={cx.prTitle}>{item.title}</span>
      </div>
      <div className={cx.meta}>
        <span>{item.author}</span>
        {date && !Number.isNaN(date.getTime()) && (
          <span>
            {t("history.updated", {
              date: format.dateTime(date, { year: "numeric", month: "short", day: "numeric" }),
            })}
          </span>
        )}
        <span>{t("history.overlap", { count: item.files_overlap.length })}</span>
      </div>
      <ul className={cx.files}>
        {shown.map((f) => (
          <li key={f} className={cx.file} title={f}>
            {f}
          </li>
        ))}
        {rest > 0 && <li className={cx.more}>+{rest}</li>}
      </ul>
    </li>
  );
}
