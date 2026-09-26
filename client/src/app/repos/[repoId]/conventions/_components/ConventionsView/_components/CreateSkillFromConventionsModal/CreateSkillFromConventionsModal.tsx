/* CreateSkillFromConventionsModal — the last step before a scan becomes a
   reusable Skill.

   The draft it opens on is composed by the SERVER from the accepted candidates
   (never by a model), and every field here is editable before anything is
   written. That is the vetting gate: an extracted skill lands `enabled` by
   default because the user has just read its whole body, which is exactly what
   an imported skill cannot promise. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  ErrorState,
  FormField,
  Icon,
  Modal,
  SearchableSelect,
  SelectInput,
  Skeleton,
  TextInput,
  Textarea,
  Toggle,
} from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "@/lib/skill-types";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useCreateConventionSkill, useSkillDraft } from "@/lib/hooks/conventions";
import { useAgents } from "@/lib/hooks/agents";
import { BODY_ROWS, CHARS_PER_TOKEN, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export function CreateSkillFromConventionsModal({
  repoId,
  repoName,
  onClose,
  onCreated,
}: {
  repoId: string;
  repoName: string;
  onClose: () => void;
  onCreated?: (skill: Skill) => void;
}): React.JSX.Element {
  const t = useTranslations("conventions");
  // The type picker's labels belong to the skills vocabulary, not this screen's
  // — a second namespace, so every test provider that renders this modal has to
  // supply both or next-intl quietly renders the raw key.
  const tSkills = useTranslations("skills");
  const toast = useToast();
  const draft = useSkillDraft(repoId, true);
  const create = useCreateConventionSkill(repoId);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("convention");
  const [body, setBody] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [agentId, setAgentId] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  /**
   * Which agent sends it. Extracting a skill nobody sends changes no review, so
   * the attach belongs in the same step as the write — but it stays optional:
   * a scan is also a legitimate way to capture the rules and decide later.
   */
  const agents = useAgents();
  const agentOptions = [
    { value: "", label: t("createSkill.agentNone") },
    ...(agents.data ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  /**
   * Seed the form from the draft once it arrives, and never again — a refetch
   * that overwrote a half-written body would throw away the user's edits, which
   * is the one thing this modal exists to preserve.
   */
  React.useEffect(() => {
    if (!draft.data || touched) return;
    setName(draft.data.name);
    setDescription(draft.data.description);
    setType(draft.data.type);
    setBody(draft.data.body);
    setTouched(true);
  }, [draft.data, touched]);

  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: tSkills(`listItem.type.${v}`) }));
  const tokens = Math.ceil(body.length / CHARS_PER_TOKEN);
  const ready =
    !!draft.data && name.trim().length > 0 && body.trim().length > 0 && !create.isPending;

  const submit = async () => {
    if (!draft.data) return;
    // mutateAsync rejects on a 4xx/5xx. Uncaught, that is an unhandled rejection
    // inside an event handler: no error boundary sees it, the modal stays open,
    // and the user watches the button do nothing.
    try {
      const skill = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || draft.data.description,
        type,
        body,
        enabled,
        convention_ids: draft.data.convention_ids,
        ...(agentId ? { agent_id: agentId } : {}),
      });
      toast.success(
        t("createSkill.success", { name: skill.name, count: draft.data.convention_ids.length }),
      );
      onCreated?.(skill);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("createSkill.failed"));
    }
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("createSkill.title")}
      subtitle={draft.data?.name ?? repoName}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <span style={s.footerNote}>{t("createSkill.savedAs")}</span>
          <Button kind="ghost" onClick={onClose}>
            {t("createSkill.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!ready}>
            {create.isPending ? t("createSkill.submitting") : t("createSkill.submit")}
          </Button>
        </div>
      }
    >
      {draft.isLoading && (
        <div style={s.loading} role="status" aria-busy="true">
          <Skeleton height={320} />
        </div>
      )}

      {draft.isError && (
        <ErrorState
          body={
            draft.error instanceof ApiError
              ? draft.error.message
              : t("createSkill.draftError")
          }
          onRetry={() => draft.refetch()}
        />
      )}

      {draft.data && (
        <div style={s.body}>
          <div style={s.notice}>
            <Icon.Sparkles size={15} style={s.noticeIcon} />
            <span>
              {t("createSkill.mergedFrom", {
                count: draft.data.convention_ids.length,
                repo: repoName,
              })}
            </span>
          </div>

          <FormField label={t("createSkill.nameLabel")} required>
            <TextInput
              value={name}
              onChange={setName}
              aria-label={t("createSkill.nameLabel")}
              mono
            />
          </FormField>

          <FormField label={t("createSkill.descriptionLabel")}>
            <TextInput
              value={description}
              onChange={setDescription}
              aria-label={t("createSkill.descriptionLabel")}
            />
          </FormField>

          <div style={s.row}>
            <FormField label={t("createSkill.typeLabel")}>
              <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
            </FormField>
            <FormField label={t("createSkill.enabledLabel")} hint={t("createSkill.enabledHint")}>
              <div style={s.toggleRow}>
                <Toggle on={enabled} onChange={setEnabled} size={16} />
              </div>
            </FormField>
          </div>

          <FormField label={t("createSkill.agentLabel")} hint={t("createSkill.agentHint")}>
            <SearchableSelect
              value={agentId}
              onChange={setAgentId}
              options={agentOptions}
              placeholder={t("createSkill.agentSearch")}
            />
          </FormField>

          <FormField label={t("createSkill.bodyLabel")} required>
            <div style={s.fileBar}>
              <Icon.FileText size={13} />
              <span className="mono" style={s.fileName}>
                {t("createSkill.bodyFile", { name: name || draft.data.name })}
              </span>
              <span className="mono tnum" style={s.tokens}>
                {t("createSkill.tokens", { count: tokens })}
              </span>
            </div>
            <Textarea value={body} onChange={setBody} rows={BODY_ROWS} mono />
          </FormField>
        </div>
      )}
    </Modal>
  );
}
