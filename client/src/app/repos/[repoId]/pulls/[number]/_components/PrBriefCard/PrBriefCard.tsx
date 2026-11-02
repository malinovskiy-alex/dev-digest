/* PrBriefCard — the "PR Brief" block on Overview (R-01): one stored brief per
   PR, generated only on the user's click (R-47) by one `risk_brief` model call.
   Opening the page reads what is stored and never calls the model (R-03).

   States, in this order: loading → skeleton (R-04); read failed → error +
   Retry (R-06); generating → skeleton of summary / Risk areas / Review focus
   with the control disabled (R-05); no brief → "No brief yet" (R-02, R-62);
   brief → header + summary + Review focus (R-08, R-48, R-51). Risk areas render
   inside the Intent card (R-63). Model text is plain text (R-36, D-28). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@devdigest/ui";
import type { PrBrief, PrBriefView } from "@devdigest/shared";
import { usePrBrief, useGenerateBrief, type BriefNavigation } from "@/lib/hooks/brief";
import { BriefHeader } from "./_components/BriefHeader";
import { ReviewFocusList } from "./_components/ReviewFocusList";
import { API_KEYS_HREF } from "@/lib/settings-urls";
import { isNoKeyError, missingItems, regenerationFailure, viewSignature } from "./helpers";
import { cx } from "./styles";

export function PrBriefCard({ prId, nav }: { prId: string; nav: BriefNavigation }): React.JSX.Element {
  const t = useTranslations("brief");
  const query = usePrBrief(prId);
  const generate = useGenerateBrief(prId);
  const view = query.data;

  const busy = !!view?.generating || generate.isPending;
  const keyMissing = view ? !view.key_available : false;
  const disabled = !view || busy || keyMissing;
  // A rejected start (409 running / no key) is shown only while the view is
  // the one it was rejected against: once a generation starts or ends, or a
  // brief or failure arrives, the message is stale and goes away (F-13).
  const signature = viewSignature(view);
  const [startedAt, setStartedAt] = React.useState<string | null>(null);
  const startError = generate.error && startedAt === signature ? generate.error : null;
  const onGenerate = () => {
    if (disabled) return;
    setStartedAt(signature);
    generate.mutate();
  };

  return (
    <section aria-label={t("block.brief")} aria-busy={query.isLoading || busy} className={cx.card}>
      <BriefHeader
        brief={view?.brief ?? null}
        stale={!!view?.stale}
        busy={busy}
        disabled={disabled}
        onGenerate={onGenerate}
      />

      {view && keyMissing && <NoKeyLine provider={view.feature_model.provider} />}
      {startError && <StartError error={startError} />}

      {query.isLoading ? (
        <div className={cx.skeletons} role="status" aria-label={t("loading")}>
          <Skeleton width="85%" height={16} />
          <Skeleton width="60%" />
          <Skeleton width="70%" />
        </div>
      ) : !view || query.isError ? (
        <div role="alert" className={cx.errorBox}>
          <p className="m-0">{t("loadError")}</p>
          {query.error && <p className={cx.hint}>{query.error.message}</p>}
          <div>
            <Button size="sm" onClick={() => void query.refetch()}>
              {t("retry")}
            </Button>
          </div>
        </div>
      ) : busy ? (
        <GeneratingSkeleton />
      ) : view.brief ? (
        <BriefBody view={view} brief={view.brief} nav={nav} />
      ) : (
        <div className={cx.empty}>
          <p className={cx.stateText}>{t("noBriefYet")}</p>
          {view.last_failure && (
            <p role="alert" className={cx.failure}>
              {t("genFailed", { reason: view.last_failure.message })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** R-68: the provider has no key — said before any click, with the way to fix it. */
function NoKeyLine({ provider }: { provider: string }): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <p role="status" className={cx.keyLine}>
      {t("noKey", { provider })}
      <span aria-hidden>·</span>
      <Link href={API_KEYS_HREF} className={cx.link}>
        {t("noKeyLink")}
      </Link>
    </p>
  );
}

/** A rejected start: the server's own message; with the Settings link for a missing key (R-39). */
function StartError({ error }: { error: Error }): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <p role="alert" className={cx.failure}>
      {error.message}
      {isNoKeyError(error) && (
        <>
          {" "}
          <Link href={API_KEYS_HREF} className={cx.link}>
            {t("noKeyLink")}
          </Link>
        </>
      )}
    </p>
  );
}

/** R-05: the summary and Review focus skeletons while a generation runs; the Risk areas one sits in the Intent card (F-16). */
function GeneratingSkeleton(): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div className={cx.groups} role="status" aria-label={t("generating")}>
      <div className={cx.group}>
        <span className={cx.groupLabel}>{t("summary")}</span>
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
      <div className={cx.group}>
        <span className={cx.groupLabel}>{t("reviewFocus")}</span>
        <Skeleton width="65%" />
        <Skeleton width="55%" />
      </div>
    </div>
  );
}

function BriefBody({
  view,
  brief,
  nav,
}: {
  view: PrBriefView;
  brief: PrBrief;
  nav: BriefNavigation;
}): React.JSX.Element {
  const t = useTranslations("brief");
  // Dismissal is keyed by the failure's timestamp, so a newer failure shows again (R-61).
  const [dismissedAt, setDismissedAt] = React.useState<string | null>(null);
  const failure = regenerationFailure(view.last_failure, dismissedAt);
  const missing = missingItems(brief.meta.missing_inputs);

  return (
    <div className={cx.body}>
      {missing.length > 0 && (
        <p className={cx.missing}>
          {t("missingInputs", {
            list: missing
              .map((m) =>
                t("missingItem", {
                  input: t(m.input.key),
                  reason: "raw" in m.reason ? m.reason.raw : t(m.reason.key, m.reason.values),
                }),
              )
              .join(", "),
          })}
        </p>
      )}
      {failure && (
        <div role="alert" className={cx.notice}>
          <span>{t("regenFailed", { reason: failure.message })}</span>
          <button type="button" className={cx.dismiss} onClick={() => setDismissedAt(failure.at)}>
            {t("dismiss")}
          </button>
        </div>
      )}
      <p className={cx.summary}>{brief.summary}</p>
      <ReviewFocusList items={brief.review_focus} nav={nav} />
    </div>
  );
}
