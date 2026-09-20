/* /skills — the Skills list (L02). A grid of SkillCards beside a preview rail
   that doubles as the editor, plus the two ways a skill gets here: written by
   hand (CreateSkillModal) or imported from a file (ImportSkillDrawer). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { ImportSkillDrawer } from "./_components/ImportSkillDrawer";
import { SkillCard } from "./_components/SkillCard";
import { SkillPreview } from "./_components/SkillPreview";
import { SKELETON_COUNT } from "./constants";
import { filterSkills, resolveSelected } from "./helpers";
import { s } from "./styles";

export function SkillsListView(): React.JSX.Element {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const all = skills ?? [];
  const list = filterSkills(all, search);
  const selected = resolveSelected(all, selectedId);

  const select = (skill: Skill) => setSelectedId(skill.id);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} onCreated={select} />}
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} onImported={select} />}
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
          <Dropdown
            width={220}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.menu.create"), icon: "Edit", onClick: () => setCreating(true) },
              { divider: true },
              { label: t("page.menu.fromFile"), icon: "Upload", onClick: () => setImporting(true) },
            ]}
          />
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
          <div style={s.split}>
            <div style={s.grid}>
              {list.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  active={skill.id === selected}
                  onClick={() => setSelectedId(skill.id)}
                  onToggle={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
                />
              ))}
            </div>
            <div style={s.rail}>
              {selected ? (
                // `key` remounts the panel when the selection changes, which
                // clears any in-progress edit synchronously — see SkillPreview.
                <SkillPreview
                  key={selected}
                  skillId={selected}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : (
                <EmptyState
                  icon="FileText"
                  title={t("page.selectPrompt.title")}
                  body={t("page.selectPrompt.body")}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
