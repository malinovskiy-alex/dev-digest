/* /skills/:id — the Skill editor. Left: every skill in the workspace, with its
   global kill-switch. Right: the selected skill's Config / Preview / Versions.
   Tab state lives in `?tab=`, mirroring the agent editor. */
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { useSkill, useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { filterSkills, typeColor } from "@/lib/skills";
import { ApiError } from "@/lib/api";
import { AddSkillButton } from "../_components/AddSkillButton";
import { CreateSkillModal } from "../_components/CreateSkillModal";
import { ImportSkillDrawer } from "../_components/ImportSkillDrawer";
import { SkillCard } from "../_components/SkillCard";
import { SkillEditor, SKILL_EDITOR_TABS } from "./_components/SkillEditor";
import { s } from "./styles";

const VALID_TABS = SKILL_EDITOR_TABS.map((t) => t.key);

export default function SkillEditorPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const { data: skills } = useSkills();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const requested = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(requested) ? requested : "config";
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`/skills/${id}?${sp.toString()}`);
  };

  const list = filterSkills(skills ?? [], query);
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? t("editor.fallbackName") },
  ];

  if (isError || (!isLoading && !skill)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("editor.loadErrorTitle")}
          body={error instanceof ApiError ? error.message : t("page.loadError")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {creating && (
        <CreateSkillModal
          onClose={() => setCreating(false)}
          onCreated={(created) => router.push(`/skills/${created.id}?tab=config`)}
        />
      )}
      {importing && (
        <ImportSkillDrawer
          onClose={() => setImporting(false)}
          onImported={(imported) => router.push(`/skills/${imported.id}?tab=preview`)}
        />
      )}

      <div style={s.split}>
        <div style={s.rail}>
          <div style={s.railHeader}>
            <div style={s.railTitleRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <AddSkillButton
                width={210}
                onCreate={() => setCreating(true)}
                onImport={() => setImporting(true)}
              />
            </div>
            <div style={s.search}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                // A placeholder is not an accessible name: it is not reliably
                // announced, and it disappears as soon as the field has content.
                aria-label={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>
          <div style={s.railList}>
            {list.map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === id}
                onClick={() => router.push(`/skills/${sk.id}?tab=${tab}`)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
                // Deleting the skill this page is describing leaves nothing to
                // describe; deleting any other one just drops it from the rail.
                onDeleted={(deleted) => {
                  if (deleted.id === id) router.push("/skills");
                }}
              />
            ))}
          </div>
        </div>

        {isLoading || !skill ? (
          <div style={s.loading}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <div style={s.main}>
            <div style={s.mainHeader}>
              <Icon.Sparkles size={18} style={s.mainIcon} />
              <h2 style={s.mainTitle}>{skill.name}</h2>
              <Badge color={typeColor(skill.type)} bg={typeColor(skill.type) + "1a"}>
                {t(`listItem.type.${skill.type}`)}
              </Badge>
              <Badge color="var(--text-secondary)" mono>
                {t("preview.version", { version: skill.version })}
              </Badge>
            </div>
            {/* `key` remounts the editor when the selection changes, which
                reseeds the Config draft synchronously — see ConfigTab. */}
            <SkillEditor
              key={skill.id}
              skill={skill}
              tab={tab}
              onTab={setTab}
              onDeleted={() => router.push("/skills")}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
