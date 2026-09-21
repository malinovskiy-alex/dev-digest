/* AddSkillButton — the "Add Skill" split button shared by both skills screens:
   the grid at /skills and the editor's left-hand list at /skills/:id.

   It reports which of the two ways a skill gets here was chosen and nothing
   more. Opening the modal or the drawer stays with the route, because /skills
   also opens the modal from its empty-state CTA and two owners of the same
   dialog is one too many. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown } from "@devdigest/ui";

export function AddSkillButton({
  onCreate,
  onImport,
  width = 220,
}: {
  onCreate: () => void;
  onImport: () => void;
  width?: number;
}): React.JSX.Element {
  const t = useTranslations("skills");

  return (
    <Dropdown
      width={width}
      align="right"
      trigger={
        <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
          {t("page.addSkill")}
        </Button>
      }
      items={[
        { label: t("page.menu.create"), icon: "Edit", onClick: onCreate },
        { divider: true },
        { label: t("page.menu.fromFile"), icon: "Upload", onClick: onImport },
      ]}
    />
  );
}
