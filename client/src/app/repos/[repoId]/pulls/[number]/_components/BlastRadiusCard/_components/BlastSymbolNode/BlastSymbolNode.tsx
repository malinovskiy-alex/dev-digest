"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { BlastCaller, DownstreamImpact } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { cx } from "./styles";

interface BlastSymbolNodeProps {
  impact: DownstreamImpact;
  /** Commit the caller links point at; null → plain text. */
  linkSha: string | null;
  repoFullName: string | null;
  defaultOpen: boolean;
}

/** One changed symbol in the tree: a collapsible row with its callers, then the
    endpoints and crons those callers' files declare (crons kept apart). */
export function BlastSymbolNode({
  impact,
  linkSha,
  repoFullName,
  defaultOpen,
}: BlastSymbolNodeProps): React.JSX.Element {
  const t = useTranslations("blast");
  const [open, setOpen] = React.useState(defaultOpen);
  const panelId = React.useId();
  const Chevron = open ? Icon.ChevronDown : Icon.ChevronRight;

  return (
    <li className={cx.node}>
      <button
        type="button"
        className={cx.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Chevron size={14} className={cx.muted} aria-hidden />
        <Icon.Code size={13} className={cx.symbolIcon} aria-hidden />
        <span className={cx.symbol}>{impact.symbol}()</span>
        <span className={cx.count}>{t("callerCount", { count: impact.callers.length })}</span>
      </button>

      {open && (
        <div id={panelId} className={cx.panel}>
          <ul aria-label={t("callersHeading")} className={cx.callers}>
            {impact.callers.map((c) => (
              <CallerRow
                key={`${c.file}:${c.line}:${c.name}`}
                caller={c}
                linkSha={linkSha}
                repoFullName={repoFullName}
              />
            ))}
          </ul>
          <ChipGroup
            label={t("endpointsHeading")}
            items={impact.endpoints_affected}
            icon="Globe"
            chipClass={cx.endpointChip}
          />
          <ChipGroup
            label={t("cronsHeading")}
            items={impact.crons_affected}
            icon="Clock"
            chipClass={cx.cronChip}
          />
        </div>
      )}
    </li>
  );
}

function CallerRow({
  caller,
  linkSha,
  repoFullName,
}: {
  caller: BlastCaller;
  linkSha: string | null;
  repoFullName: string | null;
}): React.JSX.Element {
  const t = useTranslations("blast");
  const location = `${caller.file}:${caller.line}`;
  return (
    <li className={cx.caller}>
      <Icon.CornerDownRight size={12} className={cx.muted} aria-hidden />
      {repoFullName && linkSha ? (
        <a
          className={cx.link}
          href={githubBlobUrl(repoFullName, linkSha, caller.file, caller.line)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("openOnGithub", { location })}
        >
          {location}
        </a>
      ) : (
        <span className={cx.location}>{location}</span>
      )}
      <span className={cx.callerName}>{caller.name}</span>
    </li>
  );
}

function ChipGroup({
  label,
  items,
  icon,
  chipClass,
}: {
  label: string;
  items: string[];
  icon: "Globe" | "Clock";
  chipClass: string;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  const I = Icon[icon];
  return (
    <div>
      <div className={cx.groupLabel}>{label}</div>
      <ul aria-label={label} className={cx.chips}>
        {items.map((item) => (
          <li key={item} className={chipClass} title={item}>
            <I size={12} aria-hidden />
            <span className={cx.chipText}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
