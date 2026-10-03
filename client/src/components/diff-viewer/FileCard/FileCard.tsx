/* FileCard — one collapsible file in the diff: header (path, findings dot,
   +/- stat, comment count) and, when open, its parsed lines plus any outdated
   comments and any review findings that no rendered line can host. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import type { Severity } from "@/lib/types";
import type { PrFile } from "@/lib/types";
import { AUTO_EXPAND_MAX_LINES } from "../constants";
import { parsePatch, type Line } from "../helpers";
import {
  buildThreads,
  keysForLine,
  partitionThreads,
  cs,
  type CommentThread,
  type DiffCommentApi,
} from "../comments";
import { partitionFindings, topSeverity, type DiffFindingApi } from "../findings";
import { s, chevronFor, findingDotFor, findingsBadgeFor } from "../styles";
import { CodeLine } from "../CodeLine";
import { OutdatedComments } from "../OutdatedComments";

/** Items (threads or findings) anchored to a given parsed line (RIGHT=new, LEFT=old). */
function itemsForLine<T>(ln: Line, matched: Map<string, T[]>): T[] {
  if (matched.size === 0) return [];
  const out: T[] = [];
  for (const key of keysForLine(ln)) {
    const list = matched.get(key);
    if (list) out.push(...list);
  }
  return out;
}

/** Header summary of a file's findings: a dot and the icon of the most severe
 *  one, plus how many findings the file has (all severities). */
function FileFindingsBadge({ severity, count }: { severity: Severity; count: number }) {
  const t = useTranslations("shell");
  const sev = SEV[severity];
  const SevIcon = Icon[sev.icon];
  const label = t("diffViewer.findingsCount", { count });
  return (
    <span role="img" aria-label={label} title={label} style={findingsBadgeFor(sev.c)}>
      <span style={findingDotFor(sev.c)} />
      <SevIcon size={12} />
      {count}
    </span>
  );
}

export function FileCard({
  file,
  commenting,
  findings,
}: {
  file: PrFile;
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = React.useState(
    (file.additions ?? 0) + (file.deletions ?? 0) <= AUTO_EXPAND_MAX_LINES
  );
  const lines = React.useMemo(() => parsePatch(file.patch), [file.patch]);

  // Split this file's comment threads and review findings into ones we can
  // anchor to a rendered line vs. the rest (outdated comments; findings whose
  // line is not in this patch) — the rest is surfaced below, never dropped.
  const comments = commenting?.comments;
  const allFindings = findings?.findings;
  const { matched, outdated, fileFindings, matchedFindings, unanchored } = React.useMemo(() => {
    const renderedKeys = new Set<string>();
    for (const ln of lines) for (const k of keysForLine(ln)) renderedKeys.add(k);
    const threads = comments
      ? partitionThreads(buildThreads(comments.filter((c) => c.path === file.path)), renderedKeys)
      : { matched: new Map<string, CommentThread[]>(), outdated: [] };
    const ofFile: FindingRecord[] = allFindings?.filter((f) => f.file === file.path) ?? [];
    const placed = partitionFindings(ofFile, renderedKeys);
    return {
      matched: threads.matched,
      outdated: threads.outdated,
      fileFindings: ofFile,
      matchedFindings: placed.matched,
      unanchored: placed.unanchored,
    };
  }, [comments, allFindings, file.path, lines]);
  const fileTop = topSeverity(fileFindings);

  const commentCount = commenting
    ? commenting.comments.filter((c) => c.path === file.path).length
    : 0;

  return (
    <div style={s.fileCard}>
      <div onClick={() => setOpen((o) => !o)} style={s.fileHeader}>
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <Icon.FileText size={14} style={s.fileIcon} />
        <span style={s.pathWrap}>
          <span className="mono" style={s.filePath}>
            {file.path}
          </span>
        </span>
        {fileTop && <FileFindingsBadge severity={fileTop} count={fileFindings.length} />}
        <span className="mono tnum" style={s.fileStat}>
          <span style={s.addText}>+{file.additions}</span>{" "}
          <span style={s.delText}>−{file.deletions}</span>
        </span>
        {commentCount > 0 && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}
          >
            <Icon.MessageSquare size={12} />
            {commentCount}
          </span>
        )}
      </div>
      {open && (
        <div style={s.fileBody}>
          {lines.length === 0 ? (
            <div style={s.noDiff}>{t("diffViewer.noDiffText")}</div>
          ) : (
            lines.map((ln, i) => (
              <CodeLine
                key={i}
                ln={ln}
                path={file.path}
                threads={itemsForLine(ln, matched)}
                commenting={commenting}
                findings={itemsForLine(ln, matchedFindings)}
                renderFinding={findings?.showFindings === false ? undefined : findings?.renderFinding}
              />
            ))
          )}
          {commenting && commenting.showComments && <OutdatedComments threads={outdated} />}
          {findings && findings.showFindings !== false && unanchored.length > 0 && (
            <div style={cs.outdatedWrap}>
              <span style={cs.outdatedTitle}>{t("diffViewer.unanchoredFindings")}</span>
              {unanchored.map((f) => (
                <React.Fragment key={f.id}>{findings.renderFinding(f)}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
