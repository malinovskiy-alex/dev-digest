import type { TourComponentKind } from "@devdigest/shared";

/**
 * Box fill per component kind — a faint tint of the border colour, so the
 * border carries the kind (design D-10) while each kind keeps its own fill
 * (AC-32). Design tokens, keyed by the contract's type.
 */
export const KIND_COLORS: Record<TourComponentKind, string> = {
  ui: "var(--bg-hover)",
  external: "var(--bg-elevated)",
  api: "var(--accent-bg)",
  service: "var(--warn-bg)",
  worker: "var(--sugg-bg)",
  data: "var(--ok-bg)",
  library: "var(--info-bg)",
};

/**
 * Box border per component kind, after the mockup: neutral for the client and
 * external systems, blue for entry points / the API, amber for the services in
 * between (middleware), green for data stores.
 */
export const KIND_STROKES: Record<TourComponentKind, string> = {
  ui: "var(--border-strong)",
  external: "var(--border-strong)",
  api: "var(--accent)",
  service: "var(--warn)",
  worker: "var(--sugg)",
  data: "var(--ok)",
  library: "var(--info)",
};

/** Layout geometry, in SVG user units. */
export const BOX_W = 180;
export const BOX_H = 40;
export const GAP_X = 60;
export const GAP_Y = 18;
export const PAD = 12;
/** Distance from the lowest box to the first gutter lane of a long edge (F-45). */
export const GUTTER_GAP = 22;
/** Spacing between gutter lanes, and between lanes sharing one gap. */
export const LANE_STEP = 8;
/** Lanes that fit side by side in half a column gap before they repeat. */
export const LANES_PER_GAP = 3;
/** Characters of a label drawn inside a box; the full label is the box's <title>. */
export const LABEL_CHARS = 24;
