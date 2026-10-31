/* DocTree — the repo's markdown documents as a collapsible folder tree. Each
   leaf is a button with the document name (middle-truncated, full path in the
   tooltip) and its category tag. Folders start expanded. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { middleTruncate } from "@/lib/context-docs";
import type { FolderNode, TreeNode } from "../../helpers";
import { TREE_NAME_MAX } from "../../constants";
import { cx } from "./styles";

export interface DocTreeProps {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function DocTree({ nodes, selectedPath, onSelect }: DocTreeProps): React.JSX.Element {
  const t = useTranslations("context");
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(new Set());
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <ul className={cx.list} aria-label={t("tree.label")}>
      <Nodes nodes={nodes} depth={0} collapsed={collapsed} onToggle={toggle} selectedPath={selectedPath} onSelect={onSelect} />
    </ul>
  );
}

interface NodesProps {
  nodes: TreeNode[];
  depth: number;
  collapsed: ReadonlySet<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function Nodes({ nodes, ...rest }: NodesProps): React.JSX.Element {
  return (
    <>
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <Folder key={`f:${node.path}`} folder={node} {...rest} />
        ) : (
          <li key={node.doc.path}>
            <button
              type="button"
              title={node.doc.path}
              aria-current={rest.selectedPath === node.doc.path ? "true" : undefined}
              onClick={() => rest.onSelect(node.doc.path)}
              className={cx.leaf(rest.selectedPath === node.doc.path)}
              style={{ paddingLeft: 8 + rest.depth * 14 }}
            >
              <Icon.FileText size={13} className={cx.leafIcon} />
              <span className={cx.leafName}>{middleTruncate(node.doc.name, TREE_NAME_MAX)}</span>
              <span className={cx.tag}>{node.doc.category}</span>
            </button>
          </li>
        ),
      )}
    </>
  );
}

function Folder({ folder, ...rest }: { folder: FolderNode } & Omit<NodesProps, "nodes">): React.JSX.Element {
  const t = useTranslations("context");
  const open = !rest.collapsed.has(folder.path);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t("tree.toggleFolder", { folder: folder.path })}
        title={folder.path}
        onClick={() => rest.onToggle(folder.path)}
        className={cx.folder}
        style={{ paddingLeft: 8 + rest.depth * 14 }}
      >
        {open ? <Icon.ChevronDown size={13} /> : <Icon.ChevronRight size={13} />}
        <Icon.Folder size={13} className={cx.leafIcon} />
        <span className={cx.leafName}>{folder.name}</span>
      </button>
      {open && (
        <ul className={cx.list}>
          <Nodes nodes={folder.children} {...rest} depth={rest.depth + 1} />
        </ul>
      )}
    </li>
  );
}
