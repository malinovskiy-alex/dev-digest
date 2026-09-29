/* IntentCard — what the PR is FOR, derived by the cheap intent model from the
   description, the linked ticket and specs, and (when those are missing) the
   title, branch, commits and files.

   The confidence badge and the sources row are not decoration: they say how
   much of the scope below is the author's statement and how much is a guess,
   and which linked document was actually read. Intent focuses the review; it
   never filters it — that rule lives in the review prompt, not here. */
"use client";

import React from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Badge, Button, Icon, IconBtn, Skeleton } from "@devdigest/ui";
import type { IntentSource, PrIntentRecord } from "@devdigest/shared";
import { usePrIntent, useRefreshIntent } from "@/lib/hooks/reviews";
import { AGE_TICK_MS, CONFIDENCE_TONE, SOURCE_STATUS_TONE } from "./constants";
import { derivedAt, isIntentUnavailable, knownReason, riskIcon, shortSha } from "./helpers";
import { cx } from "./styles";

export function IntentCard({ prId }: { prId: string }): React.JSX.Element {
  const t = useTranslations("brief");
  const intent = usePrIntent(prId);
  const refresh = useRefreshIntent(prId);

  const onRefresh = () => {
    if (!refresh.isPending) refresh.mutate();
  };

  // A failed refresh keeps showing the last good intent; only its error is new.
  const error = refresh.error ?? (intent.data ? null : intent.error);
  const tone = intent.data ? CONFIDENCE_TONE[intent.data.confidence] : null;

  return (
    <section
      aria-label={t("block.intent")}
      aria-busy={intent.isLoading || refresh.isPending}
      className={cx.card}
    >
      <div className={cx.header}>
        <Icon.Target size={14} className={cx.headerIcon} aria-hidden />
        <span className={cx.headerLabel}>{t("block.intent")}</span>
        <div className={cx.headerRight}>
          {intent.data && tone && !error && (
            <Badge color={tone.color} bg={tone.bg} icon={tone.icon}>
              {t(`intent.confidence.${intent.data.confidence}`)}
            </Badge>
          )}
          <IconBtn icon="RefreshCw" label={t("intent.refresh")} onClick={onRefresh} />
        </div>
      </div>

      {intent.isLoading ? (
        <div className={cx.skeletons} role="status" aria-label={t("intent.loading")}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="45%" />
          <Skeleton width="55%" />
        </div>
      ) : error && isIntentUnavailable(error) ? (
        <>
          <p className={cx.stateText}>{t("unavailable")}</p>
          <p className={cx.stateHint}>{t("intent.unavailableHint")}</p>
        </>
      ) : error ? (
        <div role="alert">
          <p className={cx.stateText}>{t("intent.error")}</p>
          <p className={cx.stateHint}>{error.message}</p>
          <Button onClick={() => (intent.data ? onRefresh() : void intent.refetch())}>
            {t("intent.retry")}
          </Button>
        </div>
      ) : intent.data ? (
        <IntentBody record={intent.data} />
      ) : null}
    </section>
  );
}

function IntentBody({ record }: { record: PrIntentRecord }): React.JSX.Element {
  const t = useTranslations("brief");

  return (
    <>
      <blockquote className={cx.quote}>“{record.intent}”</blockquote>
      {record.confidence === "low" && <p className={cx.hint}>{t("intent.lowHint")}</p>}

      <div className={cx.columns}>
        <ScopeList
          icon="Check"
          tone={cx.scopeIn}
          label={t("intent.inScope")}
          items={record.in_scope}
        />
        <ScopeList
          icon="X"
          tone={cx.scopeOut}
          label={t("intent.outOfScope")}
          items={record.out_of_scope}
        />
      </div>

      {record.risk_areas.length > 0 && (
        <>
          <hr className={cx.divider} />
          <div>
            <div className={cx.groupLabel}>
              <Icon.AlertTriangle size={12} aria-hidden />
              {t("intent.riskAreas")}
            </div>
            <div className={cx.chips}>
              {record.risk_areas.map((area, i) => {
                const r = riskIcon(area);
                const I = Icon[r.icon];
                return (
                  <span key={`${i}:${area}`} className={cx.chip} title={area}>
                    <I size={12} className={r.className} aria-hidden />
                    <span className={cx.chipText}>{area}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </>
      )}

      {record.conflicts.length > 0 && (
        <div className={cx.conflicts} role="note">
          <div className={cx.groupLabel}>
            <Icon.AlertTriangle size={12} aria-hidden />
            {t("intent.conflicts")}
          </div>
          {record.conflicts.map((c, i) => (
            <p key={`${i}:${c}`} className="m-0">
              {c}
            </p>
          ))}
          <p className={cx.stateHint}>{t("intent.conflictsHint")}</p>
        </div>
      )}

      <hr className={cx.divider} />
      <Provenance record={record} />
    </>
  );
}

function ScopeList({
  icon,
  tone,
  label,
  items,
}: {
  icon: "Check" | "X";
  tone: string;
  label: string;
  items: string[];
}): React.JSX.Element {
  const t = useTranslations("brief");
  const I = Icon[icon];
  return (
    <div>
      <div className={`${cx.scopeLabel} ${tone}`}>
        <I size={12} aria-hidden />
        {label}
      </div>
      {items.length === 0 ? (
        <span className={cx.none}>{t("intent.noneStated")}</span>
      ) : (
        <ul className={cx.list}>
          {items.map((item, i) => (
            <li key={`${i}:${item}`} className={cx.item}>
              <span className={cx.dash} aria-hidden>
                -
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Quiet footer: what kind of change, when and by which model it was derived, and from what. */
function Provenance({ record }: { record: PrIntentRecord }): React.JSX.Element {
  const t = useTranslations("brief");
  const format = useFormatter();
  const now = useNow({ updateInterval: AGE_TICK_MS });
  const at = derivedAt(record.generated_at);
  const sha = shortSha(record.head_sha);
  const ago = at ? format.relativeTime(at, now) : null;

  const meta = [
    record.kind ? t(`intent.kind.${record.kind}`) : null,
    ago ? (sha ? t("intent.derivedFor", { ago, sha }) : t("intent.derived", { ago })) : null,
    record.provider && record.model ? t("intent.model", { model: `${record.provider}/${record.model}` }) : null,
  ].filter(Boolean);

  return (
    <div className={cx.footer}>
      {meta.length > 0 && <span>{meta.join(" · ")}</span>}
      {record.sources.length > 0 && <SourcesRow sources={record.sources} />}
    </div>
  );
}

function SourcesRow({ sources }: { sources: IntentSource[] }): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div className={cx.sources}>
      <span>{t("intent.sources")}:</span>
      {sources.map((s) => {
        const tone = SOURCE_STATUS_TONE[s.status];
        const I = Icon[tone.icon];
        const reason = knownReason(s.reason);
        const showRef = s.type === "ticket" || s.type === "spec";
        return (
          <span key={`${s.type}:${s.ref}`} className={cx.source}>
            <I size={12} className={tone.className} aria-label={t(`intent.status.${s.status}`)} />
            <span>{t(`intent.sourceType.${s.type}`)}</span>
            {showRef && <span className={cx.sourceRef}>{s.ref}</span>}
            {s.status !== "used" && (
              <span className={cx.muted}>
                — {reason ? t(`intent.reason.${reason}`) : (s.reason ?? t(`intent.status.${s.status}`))}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
