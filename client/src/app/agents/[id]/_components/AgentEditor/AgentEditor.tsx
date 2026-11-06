/* AgentEditor — agent config editor (model + system prompt) plus the Skills
   tab that attaches skills to the agent in prompt order (L02). The Context
   tab attaches project documents (L05); the Stats tab shows the agent's
   figures for a range (L08). The mockup's Evals/CI tabs belong to a later
   lesson and are not built. Tab state lives in ?tab=, so a tab is linkable. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { SkillsTab } from "./_components/SkillsTab";
import { ContextTab } from "./_components/ContextTab";
import { StatsTab } from "./_components/StatsTab";
import { TABS } from "./constants";
import { s } from "./styles";

export function AgentEditor({ agent, tab, onTab }: { agent: Agent; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("agents");
  const tPerf = useTranslations("agentPerformance");
  const tabs = TABS.map((tb) => ({
    key: tb.key,
    label: tb.ns === "agentPerformance" ? tPerf(tb.labelKey) : t(tb.labelKey),
    icon: tb.icon,
  }));
  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "skills" ? (
          <SkillsTab agent={agent} />
        ) : tab === "context" ? (
          <ContextTab agent={agent} />
        ) : tab === "stats" ? (
          <StatsTab agent={agent} />
        ) : (
          <ConfigTab agent={agent} />
        )}
      </div>
    </div>
  );
}
