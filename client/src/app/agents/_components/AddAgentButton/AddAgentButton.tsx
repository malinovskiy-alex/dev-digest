/* AddAgentButton — the "Add Agent" split button shared by both agents screens:
   the grid at /agents and the editor's left-hand list at /agents/:id. When it
   lived inside the grid, the editor's copy was a lookalike whose only menu item
   routed away instead of creating anything.

   It reports the intent and nothing more. Opening the modal stays with the
   route, because /agents also opens it from its empty-state CTA and two owners
   of the same dialog is one too many. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown } from "@devdigest/ui";
import { TEMPLATES } from "./constants";

export function AddAgentButton({
  onCreate,
  width = 220,
}: {
  onCreate: () => void;
  width?: number;
}) {
  const t = useTranslations("agents");

  return (
    <Dropdown
      width={width}
      align="right"
      trigger={
        <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
          {t("list.addAgent")}
        </Button>
      }
      items={[
        { label: t("list.createFromScratch"), icon: "Edit", onClick: onCreate },
        { divider: true },
        // The templates are listed but not yet distinct: every one opens the
        // same blank modal. They are muted so the menu does not promise a
        // prefilled prompt it cannot deliver.
        ...TEMPLATES.map((tp) => ({
          label: tp,
          icon: "Cpu" as const,
          muted: true,
          onClick: onCreate,
        })),
      ]}
    />
  );
}
