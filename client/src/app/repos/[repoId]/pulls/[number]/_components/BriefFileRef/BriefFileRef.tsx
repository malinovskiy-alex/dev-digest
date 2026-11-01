/* BriefFileRef — one file reference of the PR Brief (a Review focus item or a
   risk's file ref): a keyboard-reachable button whose accessible name carries
   the full path and line (R-58), the path cut in the middle with the full form
   in `title` (R-72), a "via blast radius" tag for a file outside the PR's diff
   (R-76) and, when it was just activated, the inline "File not in this PR's
   diff" notice (R-56). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { refText, refTitle } from "./helpers";
import { cx } from "./styles";

export function BriefFileRef({
  path,
  line,
  lines,
  inDiff,
  notice,
  onActivate,
}: {
  path: string;
  /** The line navigation targets; null → the top of the file (R-55). */
  line: number | null;
  /** Visible line part when it is a range (`12-18`); defaults to `line`. */
  lines?: string;
  /** The path is one of the PR's changed files (R-76). */
  inDiff: boolean;
  /** Show the "not in this PR's diff" notice next to this reference (R-56). */
  notice: boolean;
  onActivate: () => void;
}): React.JSX.Element {
  const t = useTranslations("brief");
  const name = line != null ? t("openRef", { path, line }) : t("openRefNoLine", { path });
  return (
    <span className={cx.wrap}>
      <button
        type="button"
        className={cx.button}
        aria-label={name}
        title={refTitle(path, line, lines)}
        onClick={onActivate}
      >
        {refText(path, line, lines)}
      </button>
      {!inDiff && <span className={cx.tag}>{t("viaBlast")}</span>}
      {notice && (
        <span role="status" className={cx.notice}>
          {t("notInDiff")}
        </span>
      )}
    </span>
  );
}
