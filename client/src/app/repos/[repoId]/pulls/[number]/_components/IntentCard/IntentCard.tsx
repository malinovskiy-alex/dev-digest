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
import { Badge, Button, Icon, IconBtn, SectionLabel, Skeleton } from "@devdigest/ui";
import type { IntentSource, PrIntentRecord } from "@devdigest/shared";
import { usePrIntent, useRefreshIntent } from "@/lib/hooks/reviews";
import { AGE_TICK_MS, CONFIDENCE_TONE, SOURCE_STATUS_TONE } from "./constants";
import { derivedAt, isIntentUnavailable, knownReason, shortSha } from "./helpers";
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

  return (
    <section aria-label={t("block.intent")} aria-busy={intent.isLoading || refresh.isPending}>
      <SectionLabel
        icon="Target"
        right={<IconBtn icon="RefreshCw" label={t("intent.refresh")} onClick={onRefresh} />}
      >
        {t("block.intent")}
      </SectionLabel>
      <div className={cx.card}>
        {intent.isLoading ? (
          <div className={cx.skeletons} role="status" aria-label={t("intent.loading")}>
            <Skeleton width="70%" height={16} />
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
      </div>
    </section>
  );
}

function IntentBody({ record }: { record: PrIntentRecord }): React.JSX.Element {
  const t = useTranslations("brief");
  const format = useFormatter();
  const now = useNow({ updateInterval: AGE_TICK_MS });
  const tone = CONFIDENCE_TONE[record.confidence];
  const at = derivedAt(record.generated_at);
  const sha = shortSha(record.head_sha);
  const ago = at ? format.relativeTime(at, now) : null;

  return (
    <>
      <div className={cx.headerRow}>
        <Badge color={tone.color} bg={tone.bg} icon={tone.icon}>
          {t(`intent.confidence.${record.confidence}`)}
        </Badge>
        {record.kind && <Badge>{t(`intent.kind.${record.kind}`)}</Badge>}
        {ago && (
          <span className={cx.meta}>
            {sha ? t("intent.derivedFor", { ago, sha }) : t("intent.derived", { ago })}
            {record.provider && record.model
              ? ` · ${t("intent.model", { model: `${record.provider}/${record.model}` })}`
              : ""}
          </span>
        )}
      </div>

      <blockquote className={cx.quote}>{record.intent}</blockquote>
      {record.confidence === "low" && <p className={cx.hint}>{t("intent.lowHint")}</p>}

      <div className={cx.columns}>
        <ScopeList label={t("intent.inScope")} items={record.in_scope} />
        <ScopeList label={t("intent.outOfScope")} items={record.out_of_scope} />
      </div>

      {record.risk_areas.length > 0 && (
        <div>
          <div className={cx.groupLabel}>{t("intent.riskAreas")}</div>
          <div className={cx.chips}>
            {record.risk_areas.map((area) => (
              <Badge key={area} color="var(--warn)" bg="var(--warn-bg)">
                {area}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {record.conflicts.length > 0 && (
        <div className={cx.conflicts} role="note">
          <div className={cx.groupLabel}>{t("intent.conflicts")}</div>
          <ul className={cx.list}>
            {record.conflicts.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className={cx.stateHint}>{t("intent.conflictsHint")}</p>
        </div>
      )}

      {record.sources.length > 0 && <SourcesRow sources={record.sources} />}
    </>
  );
}

function ScopeList({ label, items }: { label: string; items: string[] }): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div>
      <div className={cx.groupLabel}>{label}</div>
      {items.length === 0 ? (
        <span className={cx.none}>{t("intent.noneStated")}</span>
      ) : (
        <ul className={cx.list}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourcesRow({ sources }: { sources: IntentSource[] }): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div className={cx.sources}>
      <span className={cx.groupLabel}>{t("intent.sources")}</span>
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
