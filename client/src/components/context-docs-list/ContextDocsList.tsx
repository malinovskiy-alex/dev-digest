/* ContextDocsList — the document list both Context tabs share (agent + skill).

   The parent owns the data and the write: it builds the rows with
   `buildDocRows`, and `onCommit(nextRows)` is called once per check, uncheck,
   keyboard move or drop. This component owns only what is local to the list:
   the filter text, the drag draft, and which document is being previewed.

   Reorder indices address the FULL row array, never the filtered view, so a
   filter can narrow what is shown without changing what is written (R-25). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { matchesPathFilter, moveRow, toggleRow, type DocRow } from "@/lib/context-docs";
import { ContextDocRow } from "./_components/ContextDocRow";
import { ContextDocPreviewModal } from "./_components/ContextDocPreviewModal";
import { cx } from "./styles";

export interface ContextDocsListProps {
  repoId: string;
  rows: DocRow[];
  /** True while a write is in flight; the rows' controls go inert. */
  busy: boolean;
  onCommit: (next: DocRow[]) => void;
  /** Rendered left of the filter (title, counter). */
  header?: React.ReactNode;
  /** Rendered under the list (total, hints). */
  footer?: React.ReactNode;
}

export function ContextDocsList({
  repoId,
  rows: committed,
  busy,
  onCommit,
  header,
  footer,
}: ContextDocsListProps): React.JSX.Element {
  const t = useTranslations("context");
  const [filter, setFilter] = React.useState("");
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);
  // While a drag is in progress the list follows the pointer locally; the write
  // happens once, on drop. Null means "show the committed order".
  const [draft, setDraft] = React.useState<DocRow[] | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const rows = draft ?? committed;

  const commit = (next: DocRow[]) => {
    if (busy) return;
    setDraft(null);
    onCommit(next);
  };

  const onMove = (path: string, delta: -1 | 1) => {
    const from = rows.findIndex((r) => r.path === path);
    if (from === -1) return;
    const next = moveRow(rows, from, from + delta);
    if (next !== rows) commit(next);
  };

  const onDragEnter = (path: string) => {
    if (dragIndex === null) return;
    const to = rows.findIndex((r) => r.path === path);
    if (to === -1 || to === dragIndex) return;
    const next = moveRow(rows, dragIndex, to);
    if (next === rows) return;
    setDraft(next);
    setDragIndex(next.findIndex((r) => r.path === rows[dragIndex]?.path));
  };

  const onDragEnd = () => {
    setDragIndex(null);
    if (draft === null) return;
    const same = draft.length === committed.length && draft.every((r, i) => r.path === committed[i]?.path);
    if (same) setDraft(null);
    else commit(draft);
  };

  const visible = rows.filter((r) => matchesPathFilter(r.path, filter));

  return (
    <div className={cx.wrap}>
      <div className={cx.toolbar}>
        {header}
        <div className={cx.search}>
          <Icon.Search size={13} className={cx.searchIcon} />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("list.filterPlaceholder")}
            aria-label={t("list.filterLabel")}
            className={cx.searchInput}
          />
        </div>
      </div>

      <div className={cx.scroll}>
        {rows.length === 0 && <p className={cx.empty}>{t("list.none")}</p>}
        {rows.length > 0 && visible.length === 0 && (
          <p className={cx.empty}>{t("list.noMatches", { q: filter })}</p>
        )}
        {visible.length > 0 && (
          <ul className={cx.list}>
            {visible.map((row) => (
              <ContextDocRow
                key={`${row.kind}:${row.path}`}
                row={row}
                dragging={dragIndex !== null && rows[dragIndex]?.path === row.path}
                busy={busy}
                onToggle={() => commit(toggleRow(rows, row.path))}
                onMove={(delta) => onMove(row.path, delta)}
                onPreview={() => setPreviewPath(row.path)}
                onDragStart={() => setDragIndex(rows.findIndex((r) => r.path === row.path))}
                onDragEnter={() => onDragEnter(row.path)}
                onDragEnd={onDragEnd}
              />
            ))}
          </ul>
        )}
      </div>

      {footer}

      {previewPath && (
        <ContextDocPreviewModal repoId={repoId} path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}
