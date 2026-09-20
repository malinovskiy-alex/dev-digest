/* SkillPreview — the right-hand rail of /skills, and the skill editor.
   Read mode renders the body as markdown with its provenance; edit mode is the
   same panel with name/description/type/body as fields. A changed body is what
   mints a new version, so `v{version}` ticking up after Save is the visible
   proof of the versioning rule. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  FormField,
  Icon,
  Markdown,
  SelectInput,
  Skeleton,
  TextInput,
  Textarea,
  ErrorState,
} from "@devdigest/ui";
import { SkillType, type Skill } from "@devdigest/shared";
import { useSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { BODY_ROWS, DESCRIPTION_ROWS } from "./constants";
import { changedFields, isUntrusted, toDraft, type SkillDraft } from "./helpers";
import { s } from "./styles";

export function SkillPreview({ skillId }: { skillId: string }): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: skill, isLoading, isError, refetch } = useSkill(skillId);
  const update = useUpdateSkill();
  // `draft === null` IS read mode — one source of truth instead of an
  // `editing` boolean that can disagree with the form it guards.
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);

  // Selecting another skill leaves the editor.
  React.useEffect(() => setDraft(null), [skillId]);

  if (isLoading) {
    return (
      <div style={s.loading}>
        <Skeleton height={20} />
        <Skeleton height={14} width="70%" />
        <Skeleton height={140} />
      </div>
    );
  }
  if (isError || !skill) {
    return <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />;
  }

  const typeOptions = SkillType.options.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const save = async () => {
    const patch = changedFields(skill, draft ?? toDraft(skill));
    if (Object.keys(patch).length === 0) {
      setDraft(null);
      return;
    }
    const saved = await update.mutateAsync({ id: skill.id, patch });
    setDraft(null);
    toast.success(t("preview.saved", { version: saved.version }));
  };

  if (draft) {
    return (
      <div style={s.wrap}>
        <FormField label={t("preview.nameLabel")} required>
          <TextInput
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
            aria-label={t("preview.nameLabel")}
          />
        </FormField>
        <FormField label={t("preview.descriptionLabel")} hint={t("preview.descriptionHint")}>
          <Textarea
            value={draft.description}
            onChange={(description) => setDraft({ ...draft, description })}
            rows={DESCRIPTION_ROWS}
          />
        </FormField>
        <FormField label={t("preview.typeLabel")}>
          <SelectInput
            value={draft.type}
            onChange={(type) => setDraft({ ...draft, type: type as Skill["type"] })}
            options={typeOptions}
          />
        </FormField>
        <FormField label={t("preview.bodyLabel")} hint={t("preview.bodyHint")}>
          <Textarea
            value={draft.body}
            onChange={(body) => setDraft({ ...draft, body })}
            rows={BODY_ROWS}
            mono
          />
        </FormField>
        <div style={s.actions}>
          <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
            {update.isPending ? t("preview.saving") : t("preview.save")}
          </Button>
          <Button kind="ghost" onClick={() => setDraft(null)} disabled={update.isPending}>
            {t("preview.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerText}>
          <div style={s.name}>{skill.name}</div>
          <div style={s.description}>{skill.description}</div>
        </div>
        <Button kind="secondary" size="sm" icon="Edit" onClick={() => setDraft(toDraft(skill))}>
          {t("preview.edit")}
        </Button>
      </div>
      <div style={s.metaRow}>
        <Badge color="var(--text-secondary)" mono>
          {t("preview.version", { version: skill.version })}
        </Badge>
        <Badge color="var(--text-secondary)" icon={isUntrusted(skill) ? "Upload" : "Edit"}>
          {t(`listItem.source.${skill.source}`)}
        </Badge>
        <Badge
          color={skill.enabled ? "var(--ok)" : "var(--text-muted)"}
          icon={skill.enabled ? "CheckCircle" : "Slash"}
        >
          {skill.enabled ? t("preview.enabled") : t("preview.disabled")}
        </Badge>
      </div>
      {isUntrusted(skill) && (
        <div style={s.notice}>
          <Icon.Shield size={14} style={s.noticeIcon} />
          {/* D6: an enabled skill is rendered as INSTRUCTIONS, outside the
              <untrusted> delimiters that neutralise the diff and the PR body.
              The safety is the lifecycle, and this notice is the part of it the
              user actually reads. */}
          <span>{t("preview.untrustedNotice")}</span>
        </div>
      )}
      <div style={s.body}>
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
