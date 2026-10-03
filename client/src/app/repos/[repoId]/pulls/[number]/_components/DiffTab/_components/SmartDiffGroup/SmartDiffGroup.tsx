/* SmartDiffGroup — one role group of the Smart Diff (core, tests, wiring, docs,
   boilerplate): a collapsible header with the role's label, description and
   counts, over a DiffViewer of the group's files. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { PrFile, SmartDiffGroup as SmartDiffGroupData } from "@devdigest/shared";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { ROLE_META } from "./constants";
import { filesWithFindings } from "./helpers";
import * as styles from "./styles";

export function SmartDiffGroup({
  group,
  files,
  commenting,
  findings,
}: {
  group: SmartDiffGroupData;
  /** The group's files as full PrFiles (with patches), in GitHub order. */
  files: PrFile[];
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
}) {
  const t = useTranslations("prReview");
  const meta = ROLE_META[group.role];
  const [open, setOpen] = React.useState(meta.defaultOpen);
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
      {open && <DiffViewer files={files} commenting={commenting} findings={findings} />}
    </section>
  );
}
