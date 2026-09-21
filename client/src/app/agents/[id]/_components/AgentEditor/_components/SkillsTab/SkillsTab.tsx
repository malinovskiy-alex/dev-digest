/* SkillsTab — which skills this agent uses, and in which order.

   Every workspace skill is one row in one flat list. A row carries a POSITION
   and a flag: unchecking a box does not remove the row, it parks it where it
   is. That is why `agent_skills` has an `enabled` column — a link-or-nothing
   model cannot express "off, but seventh", and a list that reshuffles itself
   every time a box is cleared is impossible to order deliberately.

   Checking, unchecking and reordering all post the WHOLE ordered list through
   the one endpoint — one invalidation, no partial states.

   Changing this list does NOT version the agent: `agents.version` tracks the
   agent's own config (model, prompt, strategy), and a number the user can only
   ever glimpse in a toast was not worth moving on every checkbox. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillRow } from "./_components/SkillRow";
import {
  buildRows,
  countEnabled,
  matchesFilter,
  moveRow,
  toEntries,
  toggleRow,
  type SkillListRow,
} from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }): React.JSX.Element {
  const t = useTranslations("agents");
  const toast = useToast();
  const [filter, setFilter] = React.useState("");
  // While a drag is in progress the list follows the pointer locally; the write
  // happens once, on drop. Null means "show the server's order".
  const [draft, setDraft] = React.useState<SkillListRow[] | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();

  const isLoading = skills.isLoading || links.isLoading;
  const isError = skills.isError || links.isError;

  const serverRows = React.useMemo(
    () => buildRows(skills.data ?? [], links.data ?? []),
    [skills.data, links.data],
  );
  const rows = draft ?? serverRows;

  const commit = (next: SkillListRow[]) => {
    // A second write while the first is in flight would race it and could post
    // a list built from stale links.
    if (setSkills.isPending) return;
    setSkills.mutate(
      { agentId: agent.id, skills: toEntries(next) },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(t("skills.saved"));
        },
        onError: () => setDraft(null),
      },
    );
  };

  const onToggle = (skillId: string, enabled: boolean) =>
    commit(toggleRow(rows, skillId, enabled));

  /** Keyboard reorder: indices address the FULL list, never the filtered view. */
  const onMove = (skillId: string, delta: -1 | 1) => {
    const from = rows.findIndex((row) => row.skill.id === skillId);
    const to = from + delta;
    // ↑ on the first row (or ↓ on the last) is a no-op, not a write: the handle
    // stays enabled everywhere, so this is the only place that refusal lives.
    if (from === -1 || to < 0 || to >= rows.length) return;
    commit(moveRow(rows, from, to));
  };

  const onDragEnter = (skillId: string) => {
    if (dragIndex === null) return;
    const to = rows.findIndex((row) => row.skill.id === skillId);
    if (to === -1 || to === dragIndex) return;
    setDraft(moveRow(rows, dragIndex, to));
    setDragIndex(to);
  };

  const onDragEnd = () => {
    setDragIndex(null);
    // Nothing moved — drop the draft rather than posting an identical list.
    if (draft === null) return;
    const same =
      draft.length === serverRows.length &&
      draft.every((row, i) => row.skill.id === serverRows[i]?.skill.id);
    if (same) setDraft(null);
    else commit(draft);
  };

  const visible = rows.filter((row) => matchesFilter(row.skill, filter));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        {!isLoading && !isError && (
          <Badge color="var(--accent)" bg="var(--accent-bg)">
            {t("skills.enabledCount", { linked: countEnabled(rows), total: rows.length })}
          </Badge>
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
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
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

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState icon="Sparkles" title={t("skills.none")} />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <ul style={s.list}>
          {visible.map((row) => (
            <SkillRow
              key={row.skill.id}
              skill={row.skill}
              enabled={row.enabled}
              dragging={dragIndex !== null && rows[dragIndex]?.skill.id === row.skill.id}
              busy={setSkills.isPending}
              onToggle={(enabled) => onToggle(row.skill.id, enabled)}
              onMove={(delta) => onMove(row.skill.id, delta)}
              onDragStart={() =>
                setDragIndex(rows.findIndex((r) => r.skill.id === row.skill.id))
              }
              onDragEnter={() => onDragEnter(row.skill.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
