/** Constants for SmartDiffGroup — per-role presentation of a Smart Diff group. */
import type { SmartDiffRole } from "@devdigest/shared";

interface RoleMeta {
  /** `prReview` key of the role's label. */
  labelKey: string;
  /** `prReview` key of the role's one-line description. */
  descriptionKey: string;
  /** Tailwind background class of the role's colour square (theme tokens). */
  colorClass: string;
  /** Whether the group starts expanded. Docs and boilerplate start collapsed (S2). */
  defaultOpen: boolean;
}

/**
 * Every role the server can send. `satisfies Record<SmartDiffRole, …>` is the
 * compile-time exhaustiveness check: a sixth role in the contract fails the
 * typecheck here. `SmartDiffRole` is a TYPE import on purpose — a runtime import
 * from @devdigest/shared breaks the Next bundle (server/INSIGHTS.md).
 */
export const ROLE_META = {
  core: {
    labelKey: "smartDiff.coreLabel",
    descriptionKey: "smartDiff.coreDescription",
    colorClass: "bg-accent",
    defaultOpen: true,
  },
  tests: {
    labelKey: "smartDiff.testsLabel",
    descriptionKey: "smartDiff.testsDescription",
    colorClass: "bg-ok",
    defaultOpen: true,
  },
  wiring: {
    labelKey: "smartDiff.wiringLabel",
    descriptionKey: "smartDiff.wiringDescription",
    colorClass: "bg-info",
    defaultOpen: true,
  },
  docs: {
    labelKey: "smartDiff.docsLabel",
    descriptionKey: "smartDiff.docsDescription",
    colorClass: "bg-text-secondary",
    defaultOpen: false,
  },
  boilerplate: {
    labelKey: "smartDiff.boilerplateLabel",
    descriptionKey: "smartDiff.boilerplateDescription",
    colorClass: "bg-text-muted",
    defaultOpen: false,
  },
} satisfies Record<SmartDiffRole, RoleMeta>;
