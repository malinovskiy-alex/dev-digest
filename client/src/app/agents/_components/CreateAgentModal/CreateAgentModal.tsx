"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Modal, FormField, TextInput, SearchableSelect, Textarea } from "@devdigest/ui";
import type { Provider } from "@devdigest/shared";
import { useCreateAgent, useProviderModels } from "@/lib/hooks/agents";
import { toModelOptions } from "@/lib/model-label";
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODAL_WIDTH, PROVIDER_OPTIONS } from "./constants";
import { s } from "./styles";

/** Create-agent modal — name/description/provider/model/system-prompt. */
export function CreateAgentModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const create = useCreateAgent();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [provider, setProvider] = React.useState<Provider>(DEFAULT_PROVIDER);
  const [model, setModel] = React.useState(DEFAULT_MODEL);
  const [systemPrompt, setSystemPrompt] = React.useState(t("create.defaultSystemPrompt"));

  /**
   * The model list belongs to the provider, exactly as in the agent editor.
   * This form used to take the model as free text seeded with a hardcoded
   * `gpt-4.1`, so picking Anthropic here created an agent whose very first run
   * could only fail — the id means nothing to that provider, and nothing on the
   * screen said so.
   */
  const { data: models } = useProviderModels(provider);
  const modelOptions = toModelOptions(models);
  // A model the provider no longer lists (the seeded default, or one typed
  // before) still has to be visible as the current value.
  if (model && !modelOptions.some((o) => (typeof o === "string" ? o : o.value) === model)) {
    modelOptions.unshift(model);
  }
  const noModels = models !== undefined && models.length === 0;

  const modelProvider = React.useRef(provider);
  React.useEffect(() => {
    if (provider === modelProvider.current) return;
    if (!models || models.length === 0) return;
    modelProvider.current = provider;
    if (!models.some((m) => m.id === model)) setModel(models[0]!.id);
    // Runs on a PROVIDER change, not on every model pick within one provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, models]);

  const submit = async () => {
    const agent = await create.mutateAsync({
      name: name.trim() || t("create.defaultName"),
      description,
      provider,
      model,
      system_prompt: systemPrompt,
    });
    onClose();
    router.push(`/agents/${agent.id}?tab=config`);
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
          <Button kind="primary" icon="Plus" onClick={submit} disabled={create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("create.fields.name")} required>
          <TextInput value={name} onChange={setName} placeholder={t("create.fields.namePlaceholder")} />
        </FormField>
        <FormField label={t("create.fields.description")}>
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder={t("create.fields.descriptionPlaceholder")}
          />
        </FormField>
        <FormField label={t("create.fields.provider")}>
          <SearchableSelect
            value={provider}
            onChange={(v) => setProvider(v as Provider)}
            options={[...PROVIDER_OPTIONS]}
            placeholder={t("config.providerSearch")}
          />
        </FormField>
        <FormField
          label={t("create.fields.model")}
          hint={noModels ? t("config.modelEmptyHint", { provider }) : t("config.modelHint")}
        >
          <SearchableSelect
            value={model}
            onChange={setModel}
            options={modelOptions}
            placeholder={t("config.modelSearch")}
          />
        </FormField>
        <FormField label={t("create.fields.systemPrompt")}>
          <Textarea value={systemPrompt} onChange={setSystemPrompt} rows={6} mono />
        </FormField>
      </div>
    </Modal>
  );
}
