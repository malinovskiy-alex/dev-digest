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
import { useDeleteSkill, useSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { BODY_ROWS, DESCRIPTION_ROWS } from "./constants";
import { changedFields, isUntrusted, toDraft, type SkillDraft } from "./helpers";
import { s } from "./styles";

export function SkillPreview({
  skillId,
  onDeleted,
}: {
  skillId: string;
  /** Lets the list drop its selection — this panel is about to describe a row
      that no longer exists. */
  onDeleted?: () => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data: skill, isLoading, isError, refetch } = useSkill(skillId);
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  // `draft === null` IS read mode — one source of truth instead of an
  // `editing` boolean that can disagree with the form it guards.
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);

  // NOTE: no effect resets `draft` when `skillId` changes. An effect runs AFTER
  // the render, so for one frame the form would hold the PREVIOUS skill's draft
  // under the new id — and a Save in that frame writes the wrong text to the
  // wrong skill. The list passes `key={skill.id}`, so switching skills
  // remounts this panel and clears the draft synchronously instead.

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
    // mutateAsync rejects on a 4xx/5xx. Uncaught, that is an unhandled
    // rejection inside an event handler — no error boundary sees it, and the
    // user presses Save and watches nothing happen. System errors are toasts
    // (see lib/toast.tsx).
    try {
      const saved = await update.mutateAsync({ id: skill.id, patch });
      setDraft(null);
      toast.success(t("preview.saved", { version: saved.version }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  /**
   * The confirm cannot quote a usage count: `unlinked_from` is only knowable
   * AFTER the cascade has run, so the number goes in the result toast instead
   * of being guessed at in the question.
   */
  const remove = async () => {
    if (!window.confirm(t("preview.deleteConfirm", { name: skill.name }))) return;
    try {
      const result = await del.mutateAsync(skill.id);
      toast.success(t("preview.deleted", { name: skill.name, count: result.unlinked_from }));
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
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
        <Button
          kind="ghost"
          size="sm"
          icon="Trash"
          onClick={remove}
          disabled={del.isPending}
          aria-label={t("preview.delete")}
        >
          {t("preview.delete")}
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
