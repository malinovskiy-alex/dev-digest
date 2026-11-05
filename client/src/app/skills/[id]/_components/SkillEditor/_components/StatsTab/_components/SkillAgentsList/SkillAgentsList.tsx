/* SkillAgentsList — "Agents using this skill" (L08 skill-stats R-42 … R-46,
   R-80): one row per agent that uses the skill now, in the order the server
   sends (name, then id), whether or not it ran — name, "Disabled" for a
   disabled agent, "<n> runs", and an "Open <name>" link to that agent's Stats
   tab with the same applied start and end (R-43, D-13). */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillStatsAgent } from "@devdigest/shared";
import { statsHref, type PerfRange, type PerfRangeChoice } from "@/lib/perf-range";
import { cx } from "./styles";

export function SkillAgentsList({
  agents,
  choice,
  applied,
}: {
  agents: readonly SkillStatsAgent[];
  choice: PerfRangeChoice;
  /** the range the figures were computed for — a preset link pins its end to it */
  applied: PerfRange;
}): React.JSX.Element {
  const t = useTranslations("skills");
  return (
    <section className={cx.panel} aria-label={t("stats.agents.title")}>
      <h3 className={cx.title}>{t("stats.agents.title")}</h3>
      {agents.length === 0 ? (
        <>
          <p className={cx.emptyTitle}>{t("stats.agents.none")}</p>
          <p className={cx.emptyBody}>{t("stats.agents.noneHint")}</p>
        </>
      ) : (
        <ul className={cx.list}>
          {agents.map((a) => (
            <li key={a.id} className={cx.row}>
              <span className={cx.name}>{a.name}</span>
              {!a.enabled && <Badge color="var(--text-secondary)">{t("stats.agents.disabled")}</Badge>}
              <span className={cx.runs}>{t("stats.agents.runs", { count: a.runs })}</span>
              <Link
                href={statsHref(a.id, choice, applied)}
                aria-label={t("stats.agents.openLabel", { name: a.name })}
                className={cx.open}
              >
                {t("stats.agents.open")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
