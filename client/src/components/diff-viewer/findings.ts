/* Inline review findings for the DiffViewer (Files changed tab).
   The twin of comments.ts: pure helpers + the API shape the viewer needs.
   The viewer never renders a finding itself — the route passes `renderFinding`
   (it owns FindingCard), so src/components never imports from src/app. */
import type { ReactNode } from "react";
import type { FindingRecord } from "@devdigest/shared";
import type { Severity } from "@/lib/types";
import { lineKey } from "./comments";
import { SEVERITY_RANK } from "./constants";

/** What the viewer needs to show review findings inline. */
export interface DiffFindingApi {
  /** The findings to place on the diff (any file — each FileCard filters). */
  findings: FindingRecord[];
  /** Renders one finding card; supplied by the route. */
  renderFinding: (f: FindingRecord) => ReactNode;
}

/** The line key a finding anchors to: its start line on the new (RIGHT) side. */
export function findingKey(f: FindingRecord): string | null {
  return lineKey("RIGHT", f.start_line);
}

/**
 * Split findings into those whose start line is a rendered RIGHT line (keyed)
 * and "unanchored" ones (the line is not in this patch, or only exists on the
 * old side). Unanchored findings are surfaced separately so none is dropped.
 */
export function partitionFindings(
  findings: FindingRecord[],
  renderedKeys: Set<string>,
): { matched: Map<string, FindingRecord[]>; unanchored: FindingRecord[] } {
  const matched = new Map<string, FindingRecord[]>();
  const unanchored: FindingRecord[] = [];
  for (const f of findings) {
    const key = findingKey(f);
    if (key && renderedKeys.has(key)) {
      const list = matched.get(key) ?? [];
      list.push(f);
      matched.set(key, list);
    } else {
      unanchored.push(f);
    }
  }
  return { matched, unanchored };
}

/** The most severe severity among `findings`, or null for an empty list. */
export function topSeverity(findings: FindingRecord[]): Severity | null {
  let top: Severity | null = null;
  for (const f of findings) {
    if (top === null || SEVERITY_RANK[f.severity] > SEVERITY_RANK[top]) top = f.severity;
  }
  return top;
}
