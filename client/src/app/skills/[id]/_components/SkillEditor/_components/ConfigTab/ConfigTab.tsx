/* ConfigTab — the skill's editable fields, and the only place its body is
   written. A changed body is what mints a new version, so `v{version}` ticking
   up in the header after Save is the visible proof of the versioning rule;
   name, description and type edits leave the version alone. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SKILL_TYPES } from "@/lib/skill-types";
import { useDeleteSkill, useUpdateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { BODY_ROWS, DESCRIPTION_ROWS } from "../../constants";
import { changedFields, toDraft, type SkillDraft } from "../../helpers";
import { s } from "./styles";

export function ConfigTab({
  skill,
  onDeleted,
}: {
  skill: Skill;
  /** Lets the route leave a screen that is about to describe a deleted row. */
  onDeleted?: () => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(() => toDraft(skill));
  const [confirming, setConfirming] = React.useState(false);

  // NOTE: no effect resyncs `draft` when `skill` changes. An effect runs AFTER
  // the render, so for one frame the form would hold the PREVIOUS skill's text
  // under the new id — and a Save in that frame writes the wrong body to the
  // wrong skill. The editor passes `key={skill.id}`, so switching skills
  // remounts this tab and reseeds the draft synchronously instead.

  const patch = changedFields(skill, draft);
  const dirty = Object.keys(patch).length > 0;
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const save = async () => {
    if (!dirty) return;
    // mutateAsync rejects on a 4xx/5xx. Uncaught, that is an unhandled
    // rejection inside an event handler — no error boundary sees it, and the
    // user presses Save and watches nothing happen.
    try {
      const saved = await update.mutateAsync({ id: skill.id, patch });
      toast.success(t("preview.saved", { version: saved.version }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  /**
   * The dialog quotes `agent_count` — what the skill is worth right now. The
   * exact `unlinked_from` is only knowable AFTER the cascade has run, so it
   * goes in the result toast rather than being guessed at in the question.
   */
  const remove = async () => {
    try {
      const result = await del.mutateAsync(skill.id);
      setConfirming(false);
      toast.success(t("preview.deleted", { name: skill.name, count: result.unlinked_from }));
      onDeleted?.();
    } catch (e) {
      setConfirming(false);
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  return (
    <div style={s.wrap}>
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
        <Button
          kind="primary"
          icon="Check"
          onClick={save}
          // Disabled until something actually changed: a Save that posts an
          // empty patch looks like it worked and did nothing.
          disabled={!dirty || update.isPending}
        >
          {update.isPending ? t("preview.saving") : t("preview.save")}
        </Button>
        <Button
          kind="ghost"
          onClick={() => setDraft(toDraft(skill))}
          disabled={!dirty || update.isPending}
        >
          {t("preview.cancel")}
        </Button>
        <div style={s.spacer} />
        <Button
          kind="ghost"
          icon="Trash"
          onClick={() => setConfirming(true)}
          disabled={del.isPending}
          aria-label={t("delete.label", { name: skill.name })}
        >
          {t("preview.delete")}
        </Button>
      </div>
    </div>
  );
}
