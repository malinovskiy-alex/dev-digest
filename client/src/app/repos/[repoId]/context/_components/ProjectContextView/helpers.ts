import type { ContextDoc } from "@devdigest/shared";

/** A folder of the document tree. `path` is its full repo-relative path. */
export interface FolderNode {
  kind: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export interface DocNode {
  kind: "doc";
  doc: ContextDoc;
}

export type TreeNode = FolderNode | DocNode;

/**
 * Turn the flat, path-sorted listing into a folder tree: folders first, then
 * documents, each alphabetical. Pure, so the tree is derived during render.
 */
export function buildTree(docs: ContextDoc[]): TreeNode[] {
  const root: FolderNode = { kind: "folder", name: "", path: "", children: [] };
  for (const doc of docs) {
    const segments = doc.folder === "" ? [] : doc.folder.split("/");
    let node = root;
    let prefix = "";
    for (const name of segments) {
      prefix = prefix ? `${prefix}/${name}` : name;
      let child = node.children.find(
        (c): c is FolderNode => c.kind === "folder" && c.name === name,
      );
      if (!child) {
        child = { kind: "folder", name, path: prefix, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ kind: "doc", doc });
  }
  sortTree(root);
  return root.children;
}

function sortTree(folder: FolderNode): void {
  folder.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    const an = a.kind === "folder" ? a.name : a.doc.name;
    const bn = b.kind === "folder" ? b.name : b.doc.name;
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  for (const child of folder.children) if (child.kind === "folder") sortTree(child);
}

/** M in "Indexed: N files · M tokens total" — the same `approx_tokens` each doc shows. */
export function totalTokens(docs: ContextDoc[]): number {
  return docs.reduce((n, d) => n + d.approx_tokens, 0);
}
