import type { TourComponentKind } from "@devdigest/shared";

/** Box fill per component kind — design tokens, keyed by the contract's type (AC-32). */
export const KIND_COLORS: Record<TourComponentKind, string> = {
  ui: "var(--info-bg)",
  api: "var(--accent-bg)",
  service: "var(--ok-bg)",
  worker: "var(--sugg-bg)",
  data: "var(--warn-bg)",
  external: "var(--bg-hover)",
  library: "var(--crit-bg)",
};

/** Box border per component kind. */
export const KIND_STROKES: Record<TourComponentKind, string> = {
  ui: "var(--info)",
  api: "var(--accent)",
  service: "var(--ok)",
  worker: "var(--sugg)",
  data: "var(--warn)",
  external: "var(--border-strong)",
  library: "var(--crit)",
};

/** Layout geometry, in SVG user units. */
export const BOX_W = 180;
export const BOX_H = 40;
export const GAP_X = 60;
export const GAP_Y = 18;
export const PAD = 12;
/** Characters of a label drawn inside a box; the full label is the box's <title>. */
export const LABEL_CHARS = 24;
