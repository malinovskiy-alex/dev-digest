/* BriefHeader — the PR Brief title, the Generate / Regenerate control and,
   under it while a brief is shown: "Generated <ago> for <sha> · <provider>/
   <model>" with the cost in a hover/focus tooltip (R-08, R-71), the "Built from
   trimmed inputs" note listing what the budget cut (R-25) and the stale badge
   (R-46). */
"use client";

import React from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { PrBrief } from "@devdigest/shared";
import { formatCostUsd } from "@/lib/format-cost";
import { shortSha } from "@/lib/short-sha";
import { NOW_TICK_MS } from "../../constants";
import { generatedAt, isTrimmed, trimLines } from "../../helpers";
import { HoverNote } from "../HoverNote";
import { cx } from "./styles";

export function BriefHeader({
  brief,
  stale,
  busy,
  disabled,
  onGenerate,
}: {
  brief: PrBrief | null;
  stale: boolean;
  /** A generation runs (server-reported or just requested): R-05. */
  busy: boolean;
  /** The control cannot be used (busy, no key, still loading): R-05, R-68. */
  disabled: boolean;
  onGenerate: () => void;
}): React.JSX.Element {
  const t = useTranslations("brief");
  const label = busy ? t("generating") : brief ? t("regenerate") : t("generate");
  return (
    <div className={cx.header}>
      <div className={cx.top}>
        <Icon.FileText size={14} className={cx.icon} aria-hidden />
        <h2 className={cx.title}>{t("block.brief")}</h2>
        <div className={cx.right}>
          <Button
            size="sm"
            kind={brief ? "secondary" : "primary"}
            icon={brief ? "RefreshCw" : "Sparkles"}
            loading={busy}
            disabled={disabled}
            onClick={onGenerate}
          >
            {label}
          </Button>
        </div>
      </div>
      {brief && <MetaLine brief={brief} stale={stale} />}
    </div>
  );
}

function MetaLine({ brief, stale }: { brief: PrBrief; stale: boolean }): React.JSX.Element {
  const t = useTranslations("brief");
  const format = useFormatter();
  // An explicit `now`: without one next-intl reports ENVIRONMENT_FALLBACK on every render.
  const tick = useNow({ updateInterval: NOW_TICK_MS });
  const meta = brief.meta;
  const at = generatedAt(meta.generated_at);
  // The provider's `now` is fixed at the page's server render and only ticks every
  // NOW_TICK_MS, so a brief generated after the page loaded would read "in 40 seconds".
  // Never let `now` fall behind the generation time.
  const now = at && at.getTime() > tick.getTime() ? at : tick;
  const line = t("generatedLine", {
    ago: at ? format.relativeTime(at, now) : meta.generated_at,
    sha: shortSha(meta.head_sha) ?? "",
    model: `${meta.provider}/${meta.model}`,
  });
  const cost = meta.cost_usd == null ? t("costUnknown") : t("cost", { cost: formatCostUsd(meta.cost_usd) });
  const trimmed = isTrimmed(meta.trim);

  return (
    <div className={cx.meta}>
      <HoverNote tooltip={cost}>{line}</HoverNote>
      {trimmed && (
        <HoverNote
          className={cx.trimmed}
          tooltip={
            <span className={cx.tipList}>
              {trimLines(meta.trim).map((m) => (
                <span key={m.key}>{t(m.key, m.values)}</span>
              ))}
            </span>
          }
        >
          {t("trimmedNote")}
        </HoverNote>
      )}
      {stale && (
        <Badge color="var(--warn)" bg="var(--warn-bg)">
          {t("stale", { sha: shortSha(meta.head_sha) ?? "" })}
        </Badge>
      )}
    </div>
  );
}
