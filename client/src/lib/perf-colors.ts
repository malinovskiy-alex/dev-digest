/* perf-colors.ts — the agent and model colours of the Agent Performance
   dashboard (L08, D-25). An agent's colour is derived from its id alone, so it
   is the same on every load and in both the table swatch and the by-agent donut
   (R-102). The "Deleted agents" row and the unknown model use the neutral grey,
   which the palette does not contain, so it is never derived for an existing
   agent (R-103). Two agents may share a colour; the legend text carries the
   meaning (R-69). */

/**
 * Eight categorical colours legible on the dark and the light theme. No grey,
 * and kept apart from the band colours (--ok green, --warn amber, --crit red).
 */
export const AGENT_PALETTE = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#2563eb", // blue
  "#a16207", // ochre
] as const;

/** Neutral marker for the "Deleted agents" row and segment (R-103). */
export const DELETED_AGENT_COLOR = "var(--info)";
/** Neutral marker for the "Unknown model" segment. */
export const UNKNOWN_MODEL_COLOR = "var(--info)";

/** FNV-1a, 32 bit, over UTF-16 code units — small, stable, well spread. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pick(seed: string): string {
  return AGENT_PALETTE[fnv1a(seed) % AGENT_PALETTE.length]!;
}

/** An existing agent's colour; `null` (the deleted row) → the neutral colour. */
export function agentColor(agentId: string | null): string {
  return agentId == null ? DELETED_AGENT_COLOR : pick(agentId);
}

/** A by-model segment's colour, from `provider/model`; no stored model → neutral. */
export function modelColor(provider: string | null, model: string | null): string {
  return model == null ? UNKNOWN_MODEL_COLOR : pick(`${provider ?? ""}/${model}`);
}
