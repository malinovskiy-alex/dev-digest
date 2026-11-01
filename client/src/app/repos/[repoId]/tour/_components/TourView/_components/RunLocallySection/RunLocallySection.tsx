/* RunLocallySection — numbered commands derived from the clone's files, in
   monospace, each with an optional comment and a "Copy command N" control
   that copies the command without its number (AC-39, AC-42, AC-43). Nothing
   is ever run from here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourCommands } from "@devdigest/shared";
import { CopyControl } from "../CopyControl";
import { cx } from "./styles";

export function RunLocallySection({ list }: { list: TourCommands }): React.JSX.Element {
  const t = useTranslations("onboarding");
  if (list.commands.length === 0) {
    return <p className={cx.gap}>{list.gap === "needs_clone" ? t("gaps.needsClone") : t("gaps.noManifest")}</p>;
  }
  return (
    <ol className={cx.list}>
      {list.commands.map((c) => (
        <li key={c.step} className={cx.row}>
          <span className={cx.step}>{c.step}.</span>
          <code className={cx.command}>{c.command}</code>
          {c.comment && <span className={cx.comment}>{c.comment}</span>}
          <CopyControl text={c.command} ariaLabel={t("copyCommand", { n: c.step })} />
        </li>
      ))}
    </ol>
  );
}
