/* SkillsTab — which skills this agent uses, and in which order.

   The toggle IS attach/detach (L02 D2): there is no per-link enabled flag, so
   turning a row on appends its id to the ordered list and turning it off drops
   it. Attach, detach and reorder all post the WHOLE ordered array through the
   one endpoint — one invalidation, no partial states — and a link change bumps
   the agent's version (D7), which the success toast reports. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Icon, SectionLabel, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgent, useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillRow } from "./_components/SkillRow";
import { matchesFilter, moveSkill, orderedSkillIds, partitionSkills } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }): React.JSX.Element {
  const t = useTranslations("agents");
  const toast = useToast();
  const [filter, setFilter] = React.useState("");

  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const { refetch: refetchAgent } = useAgent(agent.id);

  const all = skills.data ?? [];
  const { attached, available } = partitionSkills(all, orderedSkillIds(links.data ?? []));
  // What every write posts: the attached order, minus any link whose skill is
  // gone. Reorder indices below address this array, never the filtered view.
  const linkedIds = attached.map((entry) => entry.skill.id);

  const isLoading = skills.isLoading || links.isLoading;
  const isError = skills.isError || links.isError;

  const commit = (skillIds: string[]) => {
    // A second write while the first is in flight would race it and could post
    // an array built from stale links.
    if (setSkills.isPending) return;
    setSkills.mutate(
      { agentId: agent.id, skillIds },
      {
        onSuccess: async () => {
          // D7: the link change bumped the agent's version. The hook already
          // invalidated ["agent", id], so this read joins the refetch that is
          // in flight rather than firing a second request.
          const { data } = await refetchAgent();
          toast.success(t("skills.saved", { version: (data ?? agent).version }));
        },
      },
    );
  };

  const toggle = (skillId: string, attach: boolean) =>
    commit(attach ? [...linkedIds, skillId] : linkedIds.filter((id) => id !== skillId));

  const visibleAttached = attached.filter((entry) => matchesFilter(entry.skill, filter));
  const visibleAvailable = available.filter((skill) => matchesFilter(skill, filter));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        {!isLoading && !isError && (
          <span style={s.count}>
            {t("skills.enabledCount", { linked: attached.length, total: all.length })}
          </span>
        )}
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            // A placeholder is not an accessible name: it is not reliably
            // announced, and it disappears as soon as the field has content.
            aria-label={t("skills.filterPlaceholder")}
            style={s.searchInput}
          />
        </div>
        <Link href="/skills" style={s.manageLink}>
          {t("skills.manageLink")}
        </Link>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {isLoading && (
        <div style={s.skeletons}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}

      {isError && (
        <ErrorState
          body={t("skills.loadError")}
          onRetry={() => {
            void skills.refetch();
            void links.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <>
          <section style={s.section}>
            <SectionLabel icon="Sparkles">{t("skills.attachedTitle")}</SectionLabel>
            {attached.length === 0 ? (
              <EmptyState icon="Sparkles" title={t("skills.attachedNone")} />
            ) : (
              <ul style={s.list}>
                {visibleAttached.map(({ skill, index }) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    position={index + 1}
                    busy={setSkills.isPending}
                    onToggle={(attach) => toggle(skill.id, attach)}
                    onMoveUp={index === 0 ? null : () => commit(moveSkill(linkedIds, index, -1))}
                    onMoveDown={
                      index === attached.length - 1
                        ? null
                        : () => commit(moveSkill(linkedIds, index, 1))
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          {visibleAvailable.length > 0 && (
            <section style={s.section}>
              <SectionLabel icon="Boxes">{t("skills.availableTitle")}</SectionLabel>
              <ul style={s.list}>
                {visibleAvailable.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    position={null}
                    busy={setSkills.isPending}
                    onToggle={(attach) => toggle(skill.id, attach)}
                    onMoveUp={null}
                    onMoveDown={null}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
