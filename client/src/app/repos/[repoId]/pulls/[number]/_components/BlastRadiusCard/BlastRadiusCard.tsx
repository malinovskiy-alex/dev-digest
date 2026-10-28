/* BlastRadiusCard — what else in the repo this PR can affect (L04): the changed
   symbols, their callers as file:line, and the endpoints and crons those
   callers' files declare. Read from the repo-intel index by the server — no
   model call, no parsing here. Order comes from the server (D5). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Skeleton } from "@devdigest/ui";
import type { BlastCounts, BlastRadius } from "@devdigest/shared";
import { useBlastRadius } from "@/lib/hooks/blast";
import { BlastGraph } from "./_components/BlastGraph";
import { BlastIndexNotice } from "./_components/BlastIndexNotice";
import { BlastSymbolNode } from "./_components/BlastSymbolNode";
import { BlastViewToggle } from "./_components/BlastViewToggle";
import { PriorPrs } from "./_components/PriorPrs";
import type { BlastView } from "./constants";
import { indexNotice, linkSha } from "./helpers";
import { cx } from "./styles";

interface BlastRadiusCardProps {
  prId: string;
  repoId: string;
  repoFullName: string | null;
  headSha: string;
}

export function BlastRadiusCard({
  prId,
  repoId,
  repoFullName,
  headSha,
}: BlastRadiusCardProps): React.JSX.Element {
  const t = useTranslations("blast");
  const blast = useBlastRadius(prId);
  const [view, setView] = React.useState<BlastView>("tree");
  const data = blast.data;
  const notice = data ? indexNotice(data) : null;
  const canToggle = !!data && data.downstream.length > 0;

  return (
    <section aria-label={t("title")} aria-busy={blast.isLoading} className={cx.card}>
      <div className={cx.header}>
        <Icon.Workflow size={14} className={cx.headerIcon} aria-hidden />
        <span className={cx.headerLabel}>{t("title")}</span>
      </div>

      {data && (
        <div className={cx.statsRow}>
          <Stats counts={data.counts} />
          {canToggle && (
            <div className={cx.toggleSlot}>
              <BlastViewToggle value={view} onChange={setView} />
            </div>
          )}
        </div>
      )}

      {notice && <BlastIndexNotice notice={notice} repoId={repoId} prId={prId} />}

      {blast.isLoading ? (
        <div className={cx.skeletons} role="status" aria-label={t("loading")}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="85%" />
          <Skeleton width="70%" />
        </div>
      ) : data ? (
        <BlastBody data={data} view={view} repoFullName={repoFullName} headSha={headSha} />
      ) : blast.error ? (
        <div role="alert" className={cx.errorBox}>
          <p className="m-0">{t("error")}</p>
          <div>
            <Button size="sm" onClick={() => void blast.refetch()}>
              {t("retry")}
            </Button>
          </div>
        </div>
      ) : null}

      {!blast.isLoading && (
        <>
          <hr className={cx.divider} />
          <PriorPrs prId={prId} repoFullName={repoFullName} />
        </>
      )}
    </section>
  );
}

function BlastBody({
  data,
  view,
  repoFullName,
  headSha,
}: {
  data: BlastRadius;
  view: BlastView;
  repoFullName: string | null;
  headSha: string;
}): React.JSX.Element {
  const t = useTranslations("blast");
  if (data.changed_symbols.length === 0) return <p className={cx.stateText}>{t("noSymbols")}</p>;
  if (data.downstream.length === 0) {
    return <p className={cx.stateText}>{t("noDownstream", { count: data.counts.symbols })}</p>;
  }
  if (view === "graph") return <BlastGraph downstream={data.downstream} />;
  const sha = linkSha(data, headSha);
  return (
    <ul className={cx.tree}>
      {data.downstream.map((impact, i) => (
        <BlastSymbolNode
          key={impact.symbol}
          impact={impact}
          linkSha={sha}
          repoFullName={repoFullName}
          defaultOpen={i === 0}
        />
      ))}
    </ul>
  );
}

const STATS: { key: keyof BlastCounts; icon: "Code" | "CornerDownRight" | "Globe" | "Clock" }[] = [
  { key: "symbols", icon: "Code" },
  { key: "callers", icon: "CornerDownRight" },
  { key: "endpoints", icon: "Globe" },
  { key: "crons", icon: "Clock" },
];

function Stats({ counts }: { counts: BlastCounts }): React.JSX.Element {
  const t = useTranslations("blast");
  return (
    <ul className={cx.stats}>
      {STATS.map(({ key, icon }) => {
        const I = Icon[icon];
        return (
          <li key={key} className={cx.stat}>
            <I size={13} className={cx.statIcon} aria-hidden />
            <span className={cx.statNum}>{counts[key]}</span>
            <span>{t(`stat.${key}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}
