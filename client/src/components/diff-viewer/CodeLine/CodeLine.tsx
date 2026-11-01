/* CodeLine — one rendered diff line: gutter number, +/- sign, text, plus the
   hover "+" affordance, any anchored comment threads, an inline composer, and
   any review findings anchored to it (severity bar, label, rendered cards). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import type { Severity } from "@/lib/types";
import { commentTargetFor, type CommentThread, type DiffCommentApi, cs } from "../comments";
import { topSeverity, type DiffFindingApi } from "../findings";
import { FINDING_LINE_LABEL_KEY } from "../constants";
import { type Line } from "../helpers";
import { s, lineRowFor, lineSignFor, findingBarFor, findingLabelFor } from "../styles";
import { CommentThreadView } from "../CommentThreadView";
import { InlineComposer } from "../InlineComposer";

const NO_FINDINGS: FindingRecord[] = [];

/** The right-aligned "blocker / warning / suggestion" label of a finding line.
 *  Its own component so only lines with findings pay for `useTranslations` —
 *  a large diff renders thousands of CodeLines. */
function FindingLineLabel({ severity }: { severity: Severity }) {
  const t = useTranslations("shell");
  const sev = SEV[severity];
  const SevIcon = Icon[sev.icon];
  return (
    <span style={findingLabelFor(sev.c)}>
      <SevIcon size={12} />
      {t(FINDING_LINE_LABEL_KEY[severity])}
    </span>
  );
}

/** The hover "+" that opens the inline composer. Its own component so only the
 *  hovered line pays for `useTranslations` (see FindingLineLabel). */
function AddCommentButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("shell");
  const label = t("diffViewer.addComment");
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} style={cs.addBtn}>
      +
    </button>
  );
}

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findings = NO_FINDINGS,
  renderFinding,
  highlighted = false,
  rowRef,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  /** Review findings anchored to this line (always shown, unlike comments). */
  findings?: FindingRecord[];
  renderFinding?: DiffFindingApi["renderFinding"];
  /** The line a PR Brief reference navigated to: highlighted, focusable, `aria-current` (R-54). */
  highlighted?: boolean;
  /** Ref to the line row, given only to the highlighted line (scroll + focus live in FileCard). */
  rowRef?: React.Ref<HTMLDivElement>;
}) {
  const [hover, setHover] = React.useState(false);
  const [composing, setComposing] = React.useState(false);

  if (ln.kind === "hunk") {
    return (
      <div className="mono" style={s.hunk}>
        {ln.text}
      </div>
    );
  }

  const sign = ln.kind === "add" ? "+" : ln.kind === "del" ? "−" : "";
  const target = commenting?.canComment ? commentTargetFor(ln) : null;
  const showAdd = hover && !!target && !composing;
  const top = topSeverity(findings);
  const sev = top ? SEV[top] : null;
  const rowStyle = sev ? { ...lineRowFor(ln.kind), ...findingBarFor(sev.c) } : lineRowFor(ln.kind);

  return (
    <div
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        ref={highlighted ? rowRef : undefined}
        tabIndex={highlighted ? -1 : undefined}
        aria-current={highlighted ? "location" : undefined}
        style={highlighted ? { ...rowStyle, ...s.lineHighlight } : rowStyle}
      >
        <span className="mono tnum" style={{ ...s.lineNo, position: "relative" }}>
          {showAdd && target && <AddCommentButton onClick={() => setComposing(true)} />}
          {ln.newNo ?? ln.oldNo ?? ""}
        </span>
        <span className="mono" style={lineSignFor(ln.kind)}>
          {sign}
        </span>
        <span className="mono" style={s.lineText}>
          {ln.text || " "}
        </span>
        {top && <FindingLineLabel severity={top} />}
      </div>

      {renderFinding && findings.length > 0 && (
        <div style={cs.thread}>
          {findings.map((f) => (
            <React.Fragment key={f.id}>{renderFinding(f)}</React.Fragment>
          ))}
        </div>
      )}

      {commenting &&
        commenting.showComments &&
        threads.map((th) => (
          <CommentThreadView key={th.rootId} thread={th} commenting={commenting} path={path} />
        ))}

      {commenting && composing && target && (
        <InlineComposer
          commenting={commenting}
          path={path}
          line={target.line}
          side={target.side}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
