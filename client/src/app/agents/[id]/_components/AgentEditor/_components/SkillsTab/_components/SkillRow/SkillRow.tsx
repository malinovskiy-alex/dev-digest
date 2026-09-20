/* SkillRow — one skill in the agent's Skills tab: its prompt position, the
   attach/detach toggle (L02 D2 — the toggle IS the link) and the two reorder
   buttons. Reordering is buttons rather than drag on purpose: they are keyboard
   reachable, announced by a screen reader, and addressable by accessible name. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPE_COLOR } from "./constants";
import { s } from "./styles";

export interface SkillRowProps {
  skill: Skill;
  /** 1-based position in the assembled prompt; `null` when not attached. */
  position: number | null;
  /** Attach (`true`) or detach (`false`) this skill. */
  onToggle: (attach: boolean) => void;
  /** `null` renders the button disabled — the first attached row cannot move up. */
  onMoveUp: (() => void) | null;
  /** `null` renders the button disabled — the last attached row cannot move down. */
  onMoveDown: (() => void) | null;
  /** True while a link write is in flight; the reorder buttons go inert. */
  busy: boolean;
}

export function SkillRow({
  skill,
  position,
  onToggle,
  onMoveUp,
  onMoveDown,
  busy,
}: SkillRowProps): React.JSX.Element {
  const t = useTranslations("agents");
  const attached = position !== null;
  // D6: a globally disabled skill can still be attached, but it will not reach
  // the prompt until it is enabled on the Skills page. Saying so is the whole
  // point — otherwise attaching it looks like it did nothing.
  const muted = !skill.enabled;
  const upLabel = t("skills.moveUp", { name: skill.name });
  const downLabel = t("skills.moveDown", { name: skill.name });

  return (
    <li style={s.row(attached, muted)}>
      <span className="tnum" style={s.position}>
        {attached ? t("skills.position", { index: position }) : null}
      </span>

      <div style={s.main}>
        <div style={s.nameRow}>
          <span style={s.name}>{skill.name}</span>
          <Badge color={SKILL_TYPE_COLOR[skill.type]}>{skill.type}</Badge>
        </div>
        <p style={s.description}>{skill.description}</p>
        {muted && <p style={s.disabledNote}>{t("skills.disabledNote")}</p>}
      </div>

      {attached && (
        <div style={s.reorder}>
          <button
            type="button"
            onClick={onMoveUp ?? undefined}
            disabled={busy || onMoveUp === null}
            aria-label={upLabel}
            title={upLabel}
            style={s.moveBtn(busy || onMoveUp === null)}
          >
            <Icon.ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={onMoveDown ?? undefined}
            disabled={busy || onMoveDown === null}
            aria-label={downLabel}
            title={downLabel}
            style={s.moveBtn(busy || onMoveDown === null)}
          >
            <Icon.ArrowDown size={13} />
          </button>
        </div>
      )}

      {/* The label wraps the switch, which is a labelable element — that is what
          gives the toggle its accessible name without any visible chrome.
          While a write is in flight the toggle is inert: SkillsTab drops the
          click anyway, and a live-looking switch that does nothing is worse
          than a dimmed one. The vendored Toggle takes no `disabled`, so the
          refusal is expressed here. */}
      <label style={s.toggleLabel(busy)} aria-disabled={busy || undefined}>
        <span style={s.srOnly}>
          {attached ? t("skills.detach", { name: skill.name }) : t("skills.attach", { name: skill.name })}
        </span>
        <Toggle on={attached} onChange={busy ? () => {} : onToggle} size={16} />
      </label>
    </li>
  );
}
