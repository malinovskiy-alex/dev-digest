/* IntentCard — what the PR is FOR, derived by the cheap intent model from the
   description, the linked ticket and specs, and (when those are missing) the
   title, branch, commits and files.

   The card follows the PR-brief design: no confidence badge. Confidence is
   still derived and handed to the review prompt ("Confidence: low — a
   guess"); on the card, what the intent could NOT read is said by the
   Missing-context block and the sources row. Intent focuses the review; it
   never filters it — that rule lives in the review prompt, not here. */
"use client";

import React from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Button, Icon, Skeleton } from "@devdigest/ui";
import type { IntentSource, PrIntentRecord } from "@devdigest/shared";
import { usePrActiveRuns, usePrIntent, useRefreshIntent } from "@/lib/hooks/reviews";
import { AGE_TICK_MS, SOURCE_STATUS_TONE } from "./constants";
import {
  derivedAt,
  isIntentNotDerived,
  isIntentUnavailable,
  knownReason,
  missingContext,
  riskIcon,
  shortSha,
} from "./helpers";
import { cx } from "./styles";

export function IntentCard({ prId }: { prId: string }): React.JSX.Element {
  const t = useTranslations("brief");
  const intent = usePrIntent(prId);
  const refresh = useRefreshIntent(prId);

  // Intent is derived on demand only — this button, or a review run. Opening
  // the page reads what is stored (GET never calls the model).
  const derive = () => {
    if (!refresh.isPending) refresh.mutate();
  };

  const data = intent.data;
  const deriving = refresh.isPending;

  // A review run derives the intent too. When the PR's last active run
  // finishes, re-read it — otherwise the card keeps its cached "not derived"
  // (or older) answer and invites a second, paid derive.
  const activeRuns = usePrActiveRuns(prId).data?.length ?? 0;
  const prevActiveRuns = React.useRef(activeRuns);
  const refetchIntent = intent.refetch;
  React.useEffect(() => {
    if (prevActiveRuns.current > 0 && activeRuns === 0) void refetchIntent();
    prevActiveRuns.current = activeRuns;
  }, [activeRuns, refetchIntent]);

  // A newer intent (from a review run or a retry) makes an old derive error stale.
  const generatedAt = data?.generated_at;
  const resetRefresh = refresh.reset;
  const hasRefreshError = refresh.error != null;
  React.useEffect(() => {
    if (hasRefreshError) resetRefresh();
    // Only when a new intent arrives — not when the error itself appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedAt]);
  const loadError = data ? null : intent.error;

  return (
    <section aria-label={t("block.intent")} aria-busy={intent.isLoading || deriving} className={cx.card}>
      <div className={cx.header}>
        <Icon.Target size={14} className={cx.headerIcon} aria-hidden />
        <span className={cx.headerLabel}>{t("block.intent")}</span>
        <div className={cx.headerRight}>
          {data && (
            <Button size="sm" icon="RefreshCw" loading={deriving} disabled={deriving} onClick={derive}>
              {deriving ? t("intent.deriving") : t("intent.rederive")}
            </Button>
          )}
        </div>
      </div>

      {/* A failed derive never hides the last good intent: its error sits on top. */}
      {refresh.error && <DeriveError error={refresh.error} />}

      {intent.isLoading ? (
        <div className={cx.skeletons} role="status" aria-label={t("intent.loading")}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="45%" />
          <Skeleton width="55%" />
        </div>
      ) : data ? (
        <div className={deriving ? cx.dimmed : cx.body}>
          <IntentBody record={data} />
        </div>
      ) : isIntentNotDerived(loadError) ? (
        <div className={cx.empty}>
          <p className={cx.stateText}>{t("intent.notDerived")}</p>
          <p className={cx.stateHint}>{t("intent.notDerivedHint")}</p>
          <div>
            <Button kind="primary" icon="Target" loading={deriving} disabled={deriving} onClick={derive}>
              {deriving ? t("intent.deriving") : t("intent.derive")}
            </Button>
          </div>
        </div>
      ) : loadError ? (
        <DeriveError error={loadError} onRetry={() => void intent.refetch()} />
      ) : null}
    </section>
  );
}

function DeriveError({ error, onRetry }: { error: Error; onRetry?: () => void }): React.JSX.Element {
  const t = useTranslations("brief");
  if (isIntentUnavailable(error)) {
    // A steady state (no key for the intent model), not a failure: status, not alert.
    return (
      <div role="status">
        <p className={cx.stateText}>{t("intent.unavailable")}</p>
        <p className={cx.stateHint}>{t("intent.unavailableHint")}</p>
      </div>
    );
  }
  return (
    <div role="alert" className={cx.errorBox}>
      <p className="m-0">{t("intent.error")}</p>
      <p className={cx.stateHint}>{error.message}</p>
      {onRetry && (
        <div>
          <Button size="sm" onClick={onRetry}>
            {t("intent.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}

function IntentBody({ record }: { record: PrIntentRecord }): React.JSX.Element {
  const t = useTranslations("brief");

  return (
    <>
      <blockquote className={cx.quote}>“{record.intent}”</blockquote>
      <MissingContext sources={record.sources} />

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

/** Referenced tickets/specs the intent could not read — said out loud, never papered over. */
function MissingContext({ sources }: { sources: IntentSource[] }): React.JSX.Element | null {
  const t = useTranslations("brief");
  const missing = missingContext(sources);
  if (missing.length === 0) return null;
  return (
    <div className={cx.missing} role="note">
      <div className={cx.groupLabel}>
        <Icon.AlertTriangle size={12} aria-hidden />
        {t("intent.missingContext")}
      </div>
      {missing.map((s) => {
        const reason = knownReason(s.reason);
        return (
          <p key={`${s.type}:${s.ref}`} className="m-0">
            {t(`intent.sourceType.${s.type}`)} <span className={cx.sourceRef}>{s.ref}</span> —{" "}
            {reason ? t(`intent.reason.${reason}`) : (s.reason ?? t(`intent.status.${s.status}`))}
          </p>
        );
      })}
      <p className={cx.stateHint}>{t("intent.missingContextHint")}</p>
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
