/* CreateSkillModal — write a skill by hand. `source` is forced to 'manual' by
   the API, so a hand-written skill is trusted from the start and lands enabled. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SKILL_TYPES } from "@/lib/skill-types";
import { useCreateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { BODY_ROWS, DEFAULT_TYPE, DESCRIPTION_ROWS, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function CreateSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (skill: Skill) => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<Skill["type"]>(DEFAULT_TYPE);
  const [body, setBody] = React.useState("");

  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));
  const ready = name.trim().length > 0 && description.trim().length > 0 && body.trim().length > 0;

  const submit = async () => {
    // mutateAsync rejects on a 4xx/5xx. Uncaught, that is an unhandled
    // rejection inside an event handler — no error boundary sees it, the modal
    // stays open, and the user presses Create and watches nothing happen.
    try {
      const skill = await create.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        type,
        body,
      });
      toast.success(t("create.success", { name: skill.name }));
      onCreated?.(skill);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!ready || create.isPending}>
            {create.isPending ? t("create.submitting") : t("create.submit")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("create.nameLabel")} required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder={t("create.namePlaceholder")}
            aria-label={t("create.nameLabel")}
            mono
          />
        </FormField>
        <FormField label={t("create.descriptionLabel")} hint={t("preview.descriptionHint")} required>
          <Textarea
            value={description}
            onChange={setDescription}
            placeholder={t("create.descriptionPlaceholder")}
            rows={DESCRIPTION_ROWS}
          />
        </FormField>
        <FormField label={t("create.typeLabel")}>
          <SelectInput
            value={type}
            onChange={(v) => setType(v as Skill["type"])}
            options={typeOptions}
          />
        </FormField>
        <FormField label={t("create.bodyLabel")} required>
          <Textarea
            value={body}
            onChange={setBody}
            placeholder={t("create.bodyPlaceholder")}
            rows={BODY_ROWS}
            mono
          />
        </FormField>
      </div>
    </Modal>
  );
}
