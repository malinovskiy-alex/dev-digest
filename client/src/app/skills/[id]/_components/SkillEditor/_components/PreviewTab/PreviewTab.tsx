/* PreviewTab — the skill exactly as an agent will read it: the body rendered,
   plus where it came from and whether it is live.

   This is the screen D6 leans on. An enabled skill is rendered into the prompt
   as INSTRUCTIONS, outside the <untrusted> delimiters that neutralise the diff
   and the PR body — so for anything that did not come from `manual`, reading
   the body before enabling it is the actual safety gate, not a formality. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { isUntrusted } from "../../helpers";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }): React.JSX.Element {
  const t = useTranslations("skills");
  const untrusted = isUntrusted(skill);

  return (
    <div style={s.wrap}>
      <p style={s.description}>{skill.description}</p>

      <div style={s.metaRow}>
        <Badge color="var(--text-secondary)" mono>
          {t("preview.version", { version: skill.version })}
        </Badge>
        <Badge color="var(--text-secondary)" icon={untrusted ? "Upload" : "Edit"}>
          {t(`listItem.source.${skill.source}`)}
        </Badge>
        <Badge
          color={skill.enabled ? "var(--ok)" : "var(--text-muted)"}
          icon={skill.enabled ? "CheckCircle" : "Slash"}
        >
          {skill.enabled ? t("preview.enabled") : t("preview.disabled")}
        </Badge>
      </div>

      {untrusted && (
        <div style={s.notice}>
          <Icon.Shield size={14} style={s.noticeIcon} />
          <span>{t("preview.untrustedNotice")}</span>
        </div>
      )}

      <div style={s.body}>
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
