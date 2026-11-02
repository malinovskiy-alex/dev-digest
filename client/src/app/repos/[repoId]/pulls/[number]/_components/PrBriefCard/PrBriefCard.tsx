/* PrBriefCard — the "PR Brief" block on Overview (R-01): one stored brief per
   PR, generated only on the user's click (R-47) by one `risk_brief` model call.
   Opening the page reads what is stored and never calls the model (R-03).

   Directly under the header (and its run line) sits the latest review's
   verdict banner, with or without a brief (R-78, BA-1); while it is shown it
   carries the brief's summary as its text (R-81, R-97).

   States, in this order: loading → skeleton (R-04); read failed → error +
   Retry (R-06); generating → summary skeleton, in the banner when there is
   one, with the control disabled (R-05); no brief → "No brief yet" (R-02,
   R-62); brief → header + summary (R-08, R-48). Risk areas render inside the
   Intent card (R-63); Review focus is its own card after the Intent / Blast
   grid (R-92). Model text is plain text (R-36, D-28). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@devdigest/ui";
import type { PrBrief, PrBriefView } from "@devdigest/shared";
import { usePrBrief, useGenerateBrief } from "@/lib/hooks/brief";
import { BriefHeader } from "./_components/BriefHeader";
import { ReviewBanner, useReviewBanner } from "./_components/ReviewBanner";
import { API_KEYS_HREF } from "@/lib/settings-urls";
import { isNoKeyError, missingItems, regenerationFailure, viewSignature } from "./helpers";
import { cx } from "./styles";

export function PrBriefCard({
  prId,
  headSha,
  lastReviewedSha,
}: {
  prId: string;
  /** The PR's head: a review of another commit gets the stale badge (R-94). */
  headSha: string;
  /** Head SHA of the PR's last successful review run, null when never reviewed (R-95). */
  lastReviewedSha: string | null;
}): React.JSX.Element {
  const t = useTranslations("brief");
  const query = usePrBrief(prId);
  const generate = useGenerateBrief(prId);
  const banner = useReviewBanner(prId, headSha, lastReviewedSha);
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

  // While a review banner is shown, it carries the brief's summary (R-81, R-48)
  // and the block's one loading / generating status (R-04, R-05, R-97);
  // otherwise the block does. Never both, so exactly one skeleton shows.
  const bannerShown = banner.kind === "review";
  const bannerText = query.isLoading ? (
    // BA-2: no flash from the review's summary to the brief's while the brief is read.
    <div className={cx.bannerSkeleton} role="status" aria-label={t("loading")}>
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
    </div>
  ) : busy ? (
    <div className={cx.bannerSkeleton} role="status" aria-label={t("generating")}>
      <Skeleton width="90%" height={14} />
      <Skeleton width="70%" height={14} />
    </div>
  ) : view && !query.isError && view.brief ? (
    <p className={cx.bannerText}>{view.brief.summary}</p>
  ) : undefined; // R-96: the review's own summary, hidden when empty

  return (
    <section aria-label={t("block.brief")} aria-busy={query.isLoading || busy} className={cx.card}>
      <BriefHeader
        brief={view?.brief ?? null}
        stale={!!view?.stale}
        busy={busy}
        disabled={disabled}
        onGenerate={onGenerate}
      />
      <ReviewBanner state={banner} text={bannerText} />

      {view && keyMissing && <NoKeyLine provider={view.feature_model.provider} />}
      {startError && <StartError error={startError} />}

      {query.isLoading ? (
        bannerShown ? null : (
          <div className={cx.skeletons} role="status" aria-label={t("loading")}>
            <Skeleton width="85%" height={16} />
            <Skeleton width="60%" />
            <Skeleton width="70%" />
          </div>
        )
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
        bannerShown ? null : (
          <GeneratingSkeleton />
        )
      ) : view.brief ? (
        <BriefBody view={view} brief={view.brief} showSummary={!bannerShown} />
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

/** R-05: the summary skeleton while a generation runs and no banner carries it (R-97). The Risk areas
   one sits in the Intent card (F-16), the Review focus one in its own card (R-93). */
function GeneratingSkeleton(): React.JSX.Element {
  const t = useTranslations("brief");
  return (
    <div className={cx.groups} role="status" aria-label={t("generating")}>
      <div className={cx.group}>
        <span className={cx.groupLabel}>{t("summary")}</span>
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>
    </div>
  );
}

function BriefBody({
  view,
  brief,
  showSummary,
}: {
  view: PrBriefView;
  brief: PrBrief;
  /** False while the review banner carries the summary, so it renders once (R-48). */
  showSummary: boolean;
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
      {showSummary && <p className={cx.summary}>{brief.summary}</p>}
    </div>
  );
}
