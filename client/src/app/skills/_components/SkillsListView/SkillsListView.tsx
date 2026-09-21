/* /skills — the Skills list (L02). A grid of SkillCards, plus the two ways a
   skill gets here: written by hand (CreateSkillModal) or imported from a file
   (ImportSkillDrawer). Selecting a card opens the skill's own screen at
   /skills/:id, which owns editing, the rendered preview and the history —
   mirroring /agents → /agents/:id. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { AddSkillButton } from "../AddSkillButton";
import { CreateSkillModal } from "../CreateSkillModal";
import { ImportSkillDrawer } from "../ImportSkillDrawer";
import { SkillCard } from "../SkillCard";
import { SKELETON_COUNT } from "./constants";
import { filterSkills } from "@/lib/skills";
import { s } from "./styles";

export function SkillsListView(): React.JSX.Element {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  const all = skills ?? [];
  const list = filterSkills(all, search);

  /** Created or imported — go straight to the new skill's screen. */
  const open = (skill: Skill, tab: string) => router.push(`/skills/${skill.id}?tab=${tab}`);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {creating && (
        <CreateSkillModal onClose={() => setCreating(false)} onCreated={(sk) => open(sk, "config")} />
      )}
      {importing && (
        // Imported skills land on Preview: they arrive disabled, and reading the
        // body is the gate that decides whether they get enabled (D6).
        <ImportSkillDrawer onClose={() => setImporting(false)} onImported={(sk) => open(sk, "preview")} />
      )}
      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>{t("page.heading")}</h1>
            <p style={s.subtitle}>{t("page.subtitle")}</p>
          </div>
          <div style={s.search}>
            <Icon.Search size={13} style={s.searchIcon} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("page.searchPlaceholder")}
              // A placeholder is not an accessible name: it is not reliably
              // announced, and it disappears as soon as the field has content.
              aria-label={t("page.searchPlaceholder")}
              style={s.searchInput}
            />
          </div>
          <AddSkillButton onCreate={() => setCreating(true)} onImport={() => setImporting(true)} />
        </div>

        {isLoading && (
          <div style={s.grid} role="status" aria-busy="true">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </div>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && all.length === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={() => setCreating(true)}
          />
        )}
        {!isLoading && !isError && all.length > 0 && (
          <div style={s.grid}>
            {list.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onClick={() => open(skill, "config")}
                onToggle={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
