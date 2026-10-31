/* ContextDocRow — one document of a Context tab's list.

   A direct row has a drag handle (a real <button>, ↑/↓ on the keyboard), the
   checkbox that decides whether the doc reaches the prompt, the name, folder,
   category, its weight in tokens, and Preview. Every control's accessible name
   carries the FULL path, so two `README.md` rows stay distinguishable (R-33).

   Only a checked, stored row can be reordered. An inherited row (the doc comes
   through an active skill) is dimmed, has no checkbox and no handle, and says
   which skill it comes from. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Checkbox, Icon } from "@devdigest/ui";
import { middleTruncate, type DocRow } from "@/lib/context-docs";
import { ROW_FOLDER_MAX, ROW_NAME_MAX } from "../../constants";
import { cx } from "./styles";

export interface ContextDocRowProps {
  row: DocRow;
  dragging: boolean;
  busy: boolean;
  onToggle: () => void;
  onMove: (delta: -1 | 1) => void;
  onPreview: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}

export function ContextDocRow({
  row,
  dragging,
  busy,
  onToggle,
  onMove,
  onPreview,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: ContextDocRowProps): React.JSX.Element {
  const t = useTranslations("context");
  const inherited = row.kind === "inherited";
  // Whether the row CAN be reordered at all — independent of a save in flight.
  const reorderable = !inherited && row.stored && row.enabled;
  const movable = reorderable && !busy;
  const slash = row.path.lastIndexOf("/");
  const name = row.doc?.name ?? (slash >= 0 ? row.path.slice(slash + 1) : row.path);
  const folder = row.doc?.folder ?? (slash >= 0 ? row.path.slice(0, slash) : "");

  const onHandleKey = (e: React.KeyboardEvent) => {
    if (!movable) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove(1);
    }
  };

  const reorderLabel = row.enabled
    ? t("list.reorder", { path: row.path })
    : t("list.reorderDisabled", { path: row.path });

  return (
    <li
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={movable ? onDragEnd : undefined}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      className={cx.row({ enabled: row.enabled && !inherited, inherited, dragging, movable })}
    >
      {inherited ? (
        <span className={cx.handleSpacer} aria-hidden="true" />
      ) : (
        <button
          type="button"
          // `disabled` only for a row that can never move. While a save is in
          // flight the handle stays focusable (aria-disabled) and just ignores
          // keys, so ↑/↓ does not throw keyboard focus to <body> after every move.
          disabled={!reorderable}
          aria-disabled={busy || undefined}
          aria-label={reorderLabel}
          title={reorderLabel}
          onKeyDown={onHandleKey}
          className={cx.handle(!movable)}
        >
          <Icon.Menu size={14} />
        </button>
      )}

      {inherited ? (
        <span className={cx.name(true)} title={row.path}>
          {middleTruncate(name, ROW_NAME_MAX)}
        </span>
      ) : (
        <Checkbox
          checked={row.enabled}
          onChange={busy ? undefined : () => onToggle()}
          label={
            <span className={cx.name(row.enabled)} title={row.path}>
              <span className="sr-only">{t("list.attach", { path: row.path })}</span>
              <span aria-hidden="true">{middleTruncate(name, ROW_NAME_MAX)}</span>
            </span>
          }
        />
      )}

      {folder && (
        <span className={cx.folder} title={row.path}>
          {middleTruncate(folder, ROW_FOLDER_MAX)}
        </span>
      )}

      <div className={cx.spacer} />

      {row.viaSkills.length > 0 && (
        <Badge color="var(--info)">{t("list.viaSkill", { skills: row.viaSkills.join(", ") })}</Badge>
      )}
      {row.missing && <Badge color="var(--crit)">{t("list.notFound")}</Badge>}
      {row.doc?.truncated && <Badge color="var(--warn)">{t("list.willTruncate")}</Badge>}
      {row.doc && <Badge>{row.doc.category}</Badge>}
      {row.doc && (
        <span className={cx.tokens}>{t("list.tokens", { count: row.doc.approx_tokens.toLocaleString() })}</span>
      )}
      <Button
        size="sm"
        kind="ghost"
        icon="Eye"
        disabled={row.missing}
        aria-label={t("list.preview", { path: row.path })}
        onClick={onPreview}
      >
        {t("list.previewButton")}
      </Button>
    </li>
  );
}
