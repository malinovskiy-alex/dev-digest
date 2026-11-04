/* SmartDiffGroup — one role group of the Smart Diff (core, tests, wiring, docs,
   boilerplate): a collapsible header with the role's label, description and
   counts, over a DiffViewer of the group's files. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { PrFile, SmartDiffGroup as SmartDiffGroupData } from "@devdigest/shared";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi, type DiffFocus } from "@/components/diff-viewer";
import { ROLE_META } from "./constants";
import { filesWithFindings } from "./helpers";
import * as styles from "./styles";

export function SmartDiffGroup({
  group,
  files,
  commenting,
  findings,
  focus = null,
}: {
  group: SmartDiffGroupData;
  /** The group's files as full PrFiles (with patches), in GitHub order. */
  files: PrFile[];
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
  /** A focus target (R-53): the group opens when it holds that file. */
  focus?: DiffFocus | null;
}) {
  const t = useTranslations("prReview");
  const meta = ROLE_META[group.role];
  const holdsFocus = !!focus && files.some((f) => f.path === focus.path);
  // Only a target not yet handled opens the group; after that the user's
  // collapse sticks (F-07).
  const openFor = holdsFocus && !focus?.handled ? `${focus.path}:${focus.line ?? ""}` : null;
  const [open, setOpen] = React.useState(meta.defaultOpen || openFor !== null);
  // A target that arrives later (or changes) still opens a default-closed
  // group — adjusted during render against the previous target, not in an
  // effect (F-31).
  const [openedFor, setOpenedFor] = React.useState(openFor);
  if (openFor !== openedFor) {
    setOpenedFor(openFor);
    if (openFor) setOpen(true);
  }
  const withFindings = filesWithFindings(group);

  return (
    <section className={styles.section}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={styles.header}
      >
        <Icon.ChevronRight
          size={13}
          aria-hidden
          className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
        />
        <span aria-hidden className={`${styles.square} ${meta.colorClass}`} />
        <span className={styles.label}>{t(meta.labelKey)}</span>
        <span className={styles.description}>{t(meta.descriptionKey)}</span>
        <span className={styles.spacer} />
        {withFindings > 0 && (
          <span
            role="img"
            aria-label={t("smartDiff.filesWithFindings", { count: withFindings })}
            title={t("smartDiff.filesWithFindings", { count: withFindings })}
            className={styles.findingsCount}
          >
            <span className={styles.findingsDot} />
            {withFindings}
          </span>
        )}
        <span className={styles.filesCount}>{t("smartDiff.filesCount", { count: files.length })}</span>
      </button>
      {open && (
        <DiffViewer files={files} commenting={commenting} findings={findings} focus={holdsFocus ? focus : null} />
      )}
    </section>
  );
}
