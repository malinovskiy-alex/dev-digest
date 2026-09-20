/* SkillCard — one skill in the /skills grid: type badge, name, description and
   the global enable toggle. Props mirror AgentCard so the two grids stay one
   system. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { needsVetting, typeColor } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  usedBy,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  /** Agents this skill is attached to — the reuse signal. */
  usedBy?: number;
  onClick?: () => void;
  /**
   * Writes `enabled`. This is the GLOBAL kill-switch: off means the skill never
   * enters any prompt, whatever it is attached to (D6).
   */
  onToggle?: (enabled: boolean) => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const color = typeColor(skill.type);

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={15} />
        </div>
        <span style={s.name}>{skill.name}</span>
        {onToggle && (
          // The toggle sits inside a clickable card: swallow the click so
          // flipping the kill-switch does not also open the preview.
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>
      <div style={s.description}>{skill.description}</div>
      <div style={s.metaRow}>
        <Badge color={color} bg={color + "1a"}>
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        {needsVetting(skill) && (
          <span title={t("listItem.vettingTitle")}>
            <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
              {t("listItem.needsVetting")}
            </Badge>
          </span>
        )}
        {usedBy != null && (
          <Badge color="var(--text-secondary)" icon="Sparkles">
            {usedBy > 0 ? t("page.usedBy", { count: usedBy }) : t("page.usedByNone")}
          </Badge>
        )}
      </div>
    </div>
  );
}
