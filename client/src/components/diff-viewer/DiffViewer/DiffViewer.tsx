/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline.
   Optional review findings render inline too, through the caller's
   `renderFinding` — the viewer stays route-agnostic. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PrFile } from "@/lib/types";
import { type DiffCommentApi } from "../comments";
import { type DiffFindingApi } from "../findings";
import { type DiffFocus } from "../focus";
import { s } from "../styles";
import { FileCard } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findings,
  focus,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
  /** Open, scroll to and focus this file (and line); only its FileCard receives it (D-33). */
  focus?: DiffFocus | null;
}) {
  const t = useTranslations("shell");
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((f) => (
        <FileCard
          key={f.path}
          file={f}
          commenting={commenting}
          findings={findings}
          focus={focus && focus.path === f.path ? focus : undefined}
        />
      ))}
    </div>
  );
}
