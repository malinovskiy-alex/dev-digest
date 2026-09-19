/* FindingsPanel — one run's findings: a severity tally that doubles as a
   filter, hide-low-confidence, j/k navigation, and the FindingCard list,
   wiring the accept/dismiss action hook (A2).

   The panel is mounted once per run card (ReviewRunAccordion renders one, under
   the VerdictBanner), which is what makes the severity filter per-run-card for
   free — and what makes it the only component that can honestly count what is
   rendered below, since it owns `hideLow`. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { SeverityChips, countBySeverity } from "@/components/severity-chips";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings } from "./helpers";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // Order matters. The tally is taken AFTER the confidence filter and BEFORE
  // the severity one, so a chip's number is always the number of cards drawn
  // below it. Counting the raw `findings` instead would leave "3 WARNING" above
  // a single card the moment "hide low confidence" is on.
  const afterConfidence = React.useMemo(
    () => visibleFindings(findings, hideLow),
    [findings, hideLow],
  );
  const counts = React.useMemo(() => countBySeverity(afterConfidence), [afterConfidence]);
  // Derived, not stored: turning hideLow on can empty the bucket the filter
  // points at, and a stored filter would leave the list stuck on nothing.
  const activeSeverity =
    severityFilter && (counts[severityFilter] ?? 0) > 0 ? severityFilter : null;
  const shown = React.useMemo(
    () =>
      activeSeverity ? afterConfidence.filter((f) => f.severity === activeSeverity) : afterConfidence,
    [afterConfidence, activeSeverity],
  );

  // Toggling off returns the full list. Reset the j/k cursor with it, or the
  // a/d shortcuts start acting on a card that is no longer on screen.
  const toggleSeverity = React.useCallback((sev: Severity) => {
    setSeverityFilter((cur) => (cur === sev ? null : sev));
    setFocusIdx(0);
  }, []);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <SeverityChips
          counts={counts}
          active={activeSeverity}
          onToggle={toggleSeverity}
          separator
        />
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
