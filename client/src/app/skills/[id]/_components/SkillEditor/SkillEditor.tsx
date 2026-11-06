/* SkillEditor — the tabbed right-hand panel of /skills/:id.

   Tab state lives in `?tab=`, so a tab is linkable — "look at v2 of this
   skill" is a URL you can paste, not a click path you have to describe. */
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { ContextTab } from "./_components/ContextTab";
import { STATS_LOADING_HEIGHT, TABS } from "./constants";
import { s } from "./styles";

/**
 * The Stats tab carries recharts (the Findings ring), which no other tab of the
 * editor needs: it is loaded only when the tab is opened (L08 skill-stats F-09).
 */
const StatsTab = dynamic(() => import("./_components/StatsTab").then((m) => m.StatsTab), {
  loading: () => <Skeleton height={STATS_LOADING_HEIGHT} />,
});

export function SkillEditor({
  skill,
  tab,
  onTab,
  onDeleted,
}: {
  skill: Skill;
  tab: string;
  onTab: (t: string) => void;
  onDeleted?: () => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "stats" && <StatsTab skill={skill} />}
        {tab === "versions" && <VersionsTab skill={skill} />}
        {tab === "context" && <ContextTab skill={skill} />}
        {tab === "config" && <ConfigTab skill={skill} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}
