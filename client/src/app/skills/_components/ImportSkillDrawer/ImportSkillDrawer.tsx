/* ImportSkillDrawer — pick -> preview -> confirm, all in one drawer.
   NOTHING is stored before confirm: the preview call parses the upload and
   returns what WOULD be written, and only the confirm call persists it — with
   `enabled: false`, because an imported skill is somebody else's instructions
   until a human has read it (D6). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Drawer,
  FormField,
  Icon,
  SectionLabel,
  SelectInput,
  TextInput,
  Textarea,
} from "@devdigest/ui";
import type { Skill, SkillImportPreview } from "@devdigest/shared";
import { SKILL_TYPES } from "@/lib/skill-types";
import { useConfirmImport, useImportPreview, type ImportUpload } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { ImportEntryTable } from "./_components/ImportEntryTable";
import { ACCEPTED_FILES, BODY_ROWS, DESCRIPTION_ROWS, DRAWER_WIDTH, MAX_UPLOAD_BYTES } from "./constants";
import { formatBytes, importErrorCode, importStep, readUpload } from "./helpers";
import { s } from "./styles";

/** Name / description / type as the user confirmed them — the preview's
    extraction is a starting point, not a contract (front matter is parsed
    without a YAML library, so a misparse should cost a keystroke). */
interface ImportFields {
  name: string;
  description: string;
  type: Skill["type"];
}

export function ImportSkillDrawer({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (skill: Skill) => void;
}): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const previewImport = useImportPreview();
  const confirmImport = useConfirmImport();

  // The upload is kept so the confirm call can re-send it: the server re-parses
  // and compares the fresh core hash to `token` rather than caching the preview.
  const [upload, setUpload] = React.useState<ImportUpload | null>(null);
  const [picked, setPicked] = React.useState<{ filename: string; size: number } | null>(null);
  const [preview, setPreview] = React.useState<SkillImportPreview | null>(null);
  const [fields, setFields] = React.useState<ImportFields | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const step = importStep(preview, confirmImport.isPending);

  const describe = (e: unknown): string => {
    const code = importErrorCode(e);
    return code ? t(`errors.${code}`) : t("import.failed");
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreview(null);
    setFields(null);
    setUpload(null);
    setPicked({ filename: file.name, size: file.size });
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("import.tooLarge"));
      return;
    }
    try {
      const next = await readUpload(file);
      setUpload(next);
      const parsed = await previewImport.mutateAsync(next);
      setPreview(parsed);
      setFields({ name: parsed.name, description: parsed.description, type: parsed.type });
    } catch (e) {
      setError(describe(e));
    }
  };

  const confirm = async () => {
    if (!upload || !preview || !fields) return;
    setError(null);
    try {
      const skill = await confirmImport.mutateAsync({
        ...upload,
        token: preview.token,
        name: fields.name,
        description: fields.description,
        type: fields.type,
      });
      toast.success(t("import.success", { name: skill.name }));
      onImported(skill);
      onClose();
    } catch (e) {
      setError(describe(e));
    }
  };

  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose} disabled={confirmImport.isPending}>
            {t("import.cancel")}
          </Button>
          <Button
            kind="primary"
            icon="Upload"
            onClick={confirm}
            disabled={step !== "preview"}
            loading={confirmImport.isPending}
          >
            {confirmImport.isPending ? t("import.confirming") : t("import.confirm")}
          </Button>
        </div>
      }
    >
      {error && (
        <div style={s.error} role="alert">
          <Icon.AlertTriangle size={14} style={s.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      <div style={s.section}>
        <FormField label={t("import.pick")} hint={t("import.pickHint")}>
          <input
            type="file"
            accept={ACCEPTED_FILES}
            aria-label={t("import.pick")}
            style={s.fileInput}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </FormField>
        {picked && (
          <div style={s.picked}>
            {t("import.picked", { filename: picked.filename, size: formatBytes(picked.size) })}
          </div>
        )}
        {previewImport.isPending && <div style={s.picked}>{t("import.parsing")}</div>}
      </div>

      {preview && fields && (
        <>
          <div style={s.section}>
            <SectionLabel icon="Sparkles">{t("import.previewTitle")}</SectionLabel>
            <p style={s.hint}>{t("import.previewHint")}</p>
          </div>
          <FormField label={t("preview.nameLabel")} required>
            <TextInput
              value={fields.name}
              onChange={(name) => setFields({ ...fields, name })}
              aria-label={t("preview.nameLabel")}
              mono
            />
          </FormField>
          <FormField label={t("preview.descriptionLabel")} hint={t("preview.descriptionHint")}>
            <Textarea
              value={fields.description}
              onChange={(description) => setFields({ ...fields, description })}
              rows={DESCRIPTION_ROWS}
            />
          </FormField>
          <FormField label={t("preview.typeLabel")}>
            <SelectInput
              value={fields.type}
              onChange={(v) => setFields({ ...fields, type: v as Skill["type"] })}
              options={typeOptions}
            />
          </FormField>
          <FormField label={t("preview.bodyLabel")} hint={t("import.bodyReadOnly")}>
            {/* NOT a Textarea. The vendored one always wires its own onChange
                and takes no `readOnly`, so a value-only Textarea renders as a
                focusable field that silently discards every keystroke. This is
                display: what you are about to store is exactly what the parser
                extracted, and editing it would make `token` — the hash the
                server re-checks on confirm — meaningless. */}
            <pre style={s.bodyPreview}>{preview.body}</pre>
          </FormField>
          <div style={s.section}>
            <ImportEntryTable entries={preview.entries} />
          </div>
          {preview.warnings.length > 0 && (
            <div style={s.section}>
              <SectionLabel icon="AlertTriangle">{t("import.warningsTitle")}</SectionLabel>
              <ul style={s.warnings}>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
