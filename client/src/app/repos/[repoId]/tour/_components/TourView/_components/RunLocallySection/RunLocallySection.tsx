/* RunLocallySection — numbered commands derived from the clone's files, in
   monospace, each with an optional comment and a "Copy command N" control
   that copies the command without its number (AC-39, AC-42, AC-43). Each
   command is a full-width row: step number, the command and its `# comment`
   in the same monospace line (its `backtick` spans as code, F-44), the copy
   icon at the far right (design D-13).
   Nothing is ever run from here. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourCommands } from "@devdigest/shared";
import { CopyControl } from "../CopyControl";
import { commentParts } from "./helpers";
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
          <span className={cx.step}>{t("listNumber", { n: c.step })}</span>
          <span className={cx.line}>
            <code className={cx.command}>{c.command}</code>
            {c.comment && (
              <span className={cx.comment}>
                {"# "}
                {commentParts(c.comment).map((part, i) =>
                  part.code ? (
                    <code key={i} className={cx.commentCode}>
                      {part.text}
                    </code>
                  ) : (
                    <React.Fragment key={i}>{part.text}</React.Fragment>
                  ),
                )}
              </span>
            )}
          </span>
          <CopyControl text={c.command} ariaLabel={t("copyCommand", { n: c.step })} />
        </li>
      ))}
    </ol>
  );
}
