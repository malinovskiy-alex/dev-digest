/* SkillRow — one line of the agent's skill list: a drag handle, the checkbox
   that decides whether the skill reaches the prompt, the name and its type.

   The handle is a real <button>, not a bare div with draggable: pointer users
   drag it, keyboard users focus it and press ↑/↓. A drag-only handle would put
   ordering — the thing this whole tab is about — out of reach of the keyboard
   and out of reach of a test that addresses controls by accessible name.

   Only a CHECKED row can be reordered. An unchecked one is not in the prompt,
   so it has no position in it to argue about; it keeps its slot in the list and
   gets its handle back the moment it is checked. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { typeColor } from "@/lib/skills";
import { s } from "./styles";

export interface SkillRowProps {
  skill: Skill;
  /** Whether this skill reaches the assembled prompt. */
  enabled: boolean;
  /** True while this row is the one being dragged. */
  dragging: boolean;
  /** True while a write is in flight; the row's controls go inert. */
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  /** Move this row by one position. `delta` is -1 (earlier) or 1 (later). */
  onMove: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}

export function SkillRow({
  skill,
  enabled,
  dragging,
  busy,
  onToggle,
  onMove,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: SkillRowProps): React.JSX.Element {
  const t = useTranslations("agents");
  // The type labels live in the `skills` namespace, with every other screen.
  const tSkills = useTranslations("skills");
  // D6: a globally disabled skill can still hold a position and be checked, but
  // it will not reach the prompt until it is enabled on the Skills page. Saying
  // so is the whole point — otherwise checking it looks like it did nothing.
  const muted = !skill.enabled;

  // Reordering is gated on `enabled`, not on `busy` alone.
  const movable = enabled && !busy;

  const onHandleKey = (e: React.KeyboardEvent) => {
    if (!movable) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove(1);
    }
  };

  return (
    <li
      // Only a checked row can START a drag...
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
      // ...but every row is a drop TARGET, or a checked row could never move
      // past an unchecked one. SkillsTab ignores these unless a drag is in
      // flight, and only a checked row can put one in flight.
      onDragEnter={onDragEnter}
      // Without this the drop is never allowed and dragEnter stops firing.
      onDragOver={(e) => e.preventDefault()}
      style={s.row(enabled, muted, dragging, movable)}
    >
      <button
        type="button"
        disabled={!movable}
        aria-label={
          enabled
            ? t("skills.reorder", { name: skill.name })
            : t("skills.reorderDisabled", { name: skill.name })
        }
        title={
          enabled
            ? t("skills.reorder", { name: skill.name })
            : t("skills.reorderDisabled", { name: skill.name })
        }
        onKeyDown={onHandleKey}
        style={s.handle(!movable)}
      >
        <Icon.Menu size={14} />
      </button>

      <Checkbox
        checked={enabled}
        onChange={busy ? undefined : onToggle}
        label={
          <span className="mono" style={s.name(enabled)}>
            {skill.name}
          </span>
        }
      />

      <div style={s.spacer} />

      {muted && <Badge color="var(--warn, var(--text-muted))">{t("skills.disabledNote")}</Badge>}
      <Badge color={typeColor(skill.type)} bg={typeColor(skill.type) + "1a"}>
        {tSkills(`listItem.type.${skill.type}`)}
      </Badge>
    </li>
  );
}
