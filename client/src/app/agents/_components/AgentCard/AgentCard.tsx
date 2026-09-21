/* AgentCard — model chip, skills count, enabled toggle. Stats are an A5 mount;
   we render the provider/model + skill count here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDeleteAgent } from "@/lib/hooks/agents";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { modelColor } from "./helpers";
import { s } from "./styles";

export function AgentCard({
  ag,
  active,
  onClick,
  onToggle,
}: {
  ag: Agent;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("agents");
  const toast = useToast();
  const del = useDeleteAgent();
  const [confirming, setConfirming] = React.useState(false);
  const color = modelColor(ag.model);

  const remove = async () => {
    try {
      await del.mutateAsync(ag.id);
      setConfirming(false);
      toast.success(t("delete.done", { name: ag.name }));
    } catch (e) {
      setConfirming(false);
      toast.error(e instanceof ApiError ? e.message : t("list.loadError"));
    }
  };

  return (
    <>
      {confirming && (
        <ConfirmDialog
          title={t("delete.title", { name: ag.name })}
          body={t("delete.body", { count: ag.skill_count })}
          confirmLabel={t("delete.confirm")}
          busy={del.isPending}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    <div onClick={onClick} style={s.card(!!active, ag.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Cpu size={15} />
        </div>
        <span style={s.name}>{ag.name}</span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={ag.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          disabled={del.isPending}
          title={t("delete.confirm")}
          aria-label={t("delete.label", { name: ag.name })}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} />
        </button>
      </div>
      <div style={s.description}>{ag.description || t("card.noDescription")}</div>
      <div style={s.metaRow}>
        <span className="mono" style={s.modelChip(color)}>
          {ag.model}
        </span>
        <Badge color="var(--text-secondary)" icon="Sparkles">
          {t("card.skillCount", { count: ag.skill_count })}
        </Badge>
      </div>
    </div>
    </>
  );
}
