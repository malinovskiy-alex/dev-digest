/* SkillCard — one skill in the /skills grid and in the editor's left rail:
   type badge, name, description, the global enable toggle, the current version,
   how many agents send it with the skill's pull frequency over the last 30 days
   (L08 skill-stats R-71), and delete. Props mirror AgentCard so the two grids
   stay one system. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { typeColor } from "@/lib/skills";
import { PullFreqBadge, type CardPullFreq } from "./_components/PullFreqBadge";
import { PullFreqHint } from "./_components/PullFreqHint";
import { needsVetting } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
  onDeleted,
  pullFrequency,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  /**
   * Writes `enabled`. This is the GLOBAL kill-switch: off means the skill never
   * enters any prompt, whatever it is attached to (D6).
   */
  onToggle?: (enabled: boolean) => void;
  /** Lets the caller leave a screen that is about to describe a deleted row. */
  onDeleted?: (skill: Skill) => void;
  /** This skill's slice of the page's one pull-frequency read (D-11); absent → the agent count only. */
  pullFrequency?: CardPullFreq;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const del = useDeleteSkill();
  const [confirming, setConfirming] = React.useState(false);
  const color = typeColor(skill.type);
  const hintId = React.useId();
  // The hint is the card's description: keyboard focus lands on the card root (R-83).
  const showHint = pullFrequency?.status === "ready";
  // Escape hides the hint until the pointer or focus leaves the card (WCAG 1.4.13).
  const [hintDismissed, setHintDismissed] = React.useState(false);

  /**
   * The question cannot quote the count it is about to invalidate — the card
   * knows `agent_count`, so it says that; the exact `unlinked_from` is only
   * knowable AFTER the cascade has run and goes in the result toast.
   */
  const remove = async () => {
    try {
      const result = await del.mutateAsync(skill.id);
      setConfirming(false);
      toast.success(t("preview.deleted", { name: skill.name, count: result.unlinked_from }));
      onDeleted?.(skill);
    } catch (e) {
      setConfirming(false);
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  return (
    <>
      {confirming && (
        <ConfirmDialog
          title={t("delete.title", { name: skill.name })}
          body={t("delete.body", { count: skill.agent_count })}
          confirmLabel={t("preview.delete")}
          busy={del.isPending}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}

      {/* Selecting a skill is this screen's primary action, so the card has to
          be reachable without a mouse. */}
      <div
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          } else if (e.key === "Escape") {
            setHintDismissed(true);
          }
        }}
        onMouseLeave={() => setHintDismissed(false)}
        onBlur={(e) => {
          // `blur` bubbles in React: focus moving to the card's own Toggle or
          // delete button has not left the card, so Escape still holds (F-17).
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setHintDismissed(false);
        }}
        role="button"
        tabIndex={0}
        aria-pressed={!!active}
        aria-describedby={showHint ? hintId : undefined}
        // `group` drives the pull-frequency hint: badge hover and keyboard focus (R-82, F-18).
        className="group"
        style={s.card(!!active, skill.enabled)}
      >
        <div style={s.headerRow}>
          <div style={s.iconBox}>
            <Icon.Sparkles size={15} />
          </div>
          <span style={s.name}>{skill.name}</span>
          {onToggle && (
            // The toggle sits inside a clickable card: swallow the click so
            // flipping the kill-switch does not also open the skill.
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle on={skill.enabled} onChange={onToggle} size={14} />
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            disabled={del.isPending}
            title={t("preview.delete")}
            aria-label={t("delete.label", { name: skill.name })}
            style={s.deleteBtn(del.isPending)}
          >
            <Icon.Trash size={14} />
          </button>
        </div>

        <div style={s.description}>{skill.description}</div>

        <div style={s.metaRow}>
          <Badge color={color} bg={color + "1a"}>
            {t(`listItem.type.${skill.type}`)}
          </Badge>
          <Badge color="var(--text-secondary)" mono>
            {t("preview.version", { version: skill.version })}
          </Badge>
          <PullFreqBadge agentCount={skill.agent_count} pullFrequency={pullFrequency} />
          {needsVetting(skill) && (
            <span title={t("listItem.vettingTitle")}>
              <Badge color="var(--warn)" bg="var(--warn-bg)" icon="AlertTriangle">
                {t("listItem.needsVetting")}
              </Badge>
            </span>
          )}
        </div>
        {/* Reserved whenever a pull frequency is passed, so the card's height
            never changes when the read lands (F-20); it describes the card and
            can show only once the read is `ready`. */}
        {pullFrequency && <PullFreqHint id={hintId} dismissed={hintDismissed} reserveOnly={!showHint} />}
      </div>
    </>
  );
}
