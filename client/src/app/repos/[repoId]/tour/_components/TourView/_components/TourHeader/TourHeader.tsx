/* TourHeader — heading, the "Generated from index of N files" line with its
   model tooltip and badges, Generate / Regenerate, the Outdated badge, Share
   link, one status line per blocker and the dismissible regeneration notice. */
"use client";

import React from "react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { OnboardingTour, TourFailureCode } from "@devdigest/shared";
import { CopyControl } from "../CopyControl";
import { API_KEYS_HREF, NOW_TICK_MS } from "./constants";
import {
  clientOrigin,
  disabledReason,
  regenerationNotice,
  serverOrigin,
  shareUrl,
  statusLines,
  subscribeNever,
} from "./helpers";
import { cx } from "./styles";

export function TourHeader({
  tour,
  indexReasonText,
  generating,
  onGenerate,
}: {
  tour: OnboardingTour;
  indexReasonText: string | null;
  generating: boolean;
  onGenerate: () => void;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const format = useFormatter();
  // An explicit `now` for relativeTime: without one next-intl falls back to
  // render time with an ENVIRONMENT_FALLBACK error, and the text never moves (F-21).
  const now = useNow({ updateInterval: NOW_TICK_MS });
  const [dismissedAt, setDismissedAt] = React.useState<string | null>(null);

  const meta = tour.meta;
  const running = tour.generation.running || generating;
  const disabled = running || !tour.can_generate;
  const why = disabledReason(tour);
  const buttonTitle =
    !running && why === "notCloned"
      ? t("actions.needsCloneTooltip")
      : !running && why === "indexNotReady"
        ? t("actions.indexNotReadyTooltip")
        : !running && why === "noKey"
          ? t("actions.noKeyTooltip", { provider: tour.api_key.provider })
          : undefined;
  const failureText = (code: TourFailureCode, message: string) =>
    t(`failure.${code}`, { message });
  const notice = regenerationNotice(tour, dismissedAt);
  const lines = statusLines(tour);
  const origin = React.useSyncExternalStore(subscribeNever, clientOrigin, serverOrigin);

  return (
    <header className={cx.header}>
      <div className={cx.top}>
        <h1 className={cx.title}>
          {t.rich("heading", {
            name: tour.name,
            accent: (chunks) => <span className={cx.accent}>{chunks}</span>,
          })}
        </h1>
        <div className={cx.actions}>
          {meta?.outdated && <Badge color="var(--warn)" bg="var(--warn-bg)">{t("outdated")}</Badge>}
          <span title={buttonTitle}>
            <Button kind="secondary" size="lg" icon="RefreshCw" loading={running} disabled={disabled} onClick={onGenerate}>
              {running
                ? t("actions.generating")
                : tour.status === "generated"
                  ? t("actions.regenerate")
                  : t("actions.generate")}
            </Button>
          </span>
          <CopyControl
            text={shareUrl(origin, tour.repo_id)}
            label={t("actions.share")}
            ariaLabel={t("actions.shareLabel")}
            icon="Link"
          />
        </div>
      </div>

      {meta && (
        <p className={cx.meta}>
          <span
            className={cx.metaLine}
            title={t("header.modelTooltip", {
              provider: meta.provider,
              model: meta.model,
              cost:
                meta.cost_usd === null
                  ? t("header.costUnknown")
                  : format.number(meta.cost_usd, { style: "currency", currency: "USD", maximumFractionDigits: 4 }),
            })}
          >
            {meta.coverage_partial && meta.source_files !== null
              ? t("header.generatedPartial", {
                  files: meta.index_files,
                  total: meta.source_files,
                  when: format.relativeTime(new Date(meta.generated_at), now),
                })
              : t("header.generated", {
                  files: meta.index_files,
                  when: format.relativeTime(new Date(meta.generated_at), now),
                })}
          </span>
          {meta.index_partial && <Badge>{t("header.partialIndex")}</Badge>}
          {meta.trimmed && <Badge>{t("header.trimmed")}</Badge>}
        </p>
      )}

      {lines.length > 0 && (
        <ul className={cx.lines}>
          {lines.map((line) => (
            <li key={line.kind} className={cx.line}>
              <Icon.AlertTriangle size={14} aria-hidden="true" className={cx.lineIcon} />
              {line.kind === "not_cloned" && t("status.notCloned")}
              {line.kind === "index_not_ready" &&
                t("status.indexNotReady", { reason: indexReasonText ?? "" })}
              {line.kind === "no_api_key" && (
                <>
                  {t("status.noApiKey", { provider: line.provider })}
                  <Link href={API_KEYS_HREF} className={cx.link}>
                    {t("status.apiKeysLink")}
                  </Link>
                </>
              )}
              {line.kind === "failed" &&
                t("status.failed", { reason: failureText(line.code, line.message) })}
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <div role="alert" className={cx.notice}>
          <span>{t("notice.regenFailed", { reason: failureText(notice.code, notice.message) })}</span>
          <button type="button" className={cx.dismiss} onClick={() => setDismissedAt(notice.at)}>
            {t("notice.dismiss")}
          </button>
        </div>
      )}
    </header>
  );
}
