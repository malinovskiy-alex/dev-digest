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

export function CodeLine({
  ln,
  path,
  threads,
  commenting,
  findings = NO_FINDINGS,
  renderFinding,
}: {
  ln: Line;
  path: string;
  threads: CommentThread[];
  commenting?: DiffCommentApi;
  /** Review findings anchored to this line (always shown, unlike comments). */
  findings?: FindingRecord[];
  renderFinding?: DiffFindingApi["renderFinding"];
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

  return (
    <div
      style={cs.rowWrap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={sev ? { ...lineRowFor(ln.kind), ...findingBarFor(sev.c) } : lineRowFor(ln.kind)}>
        <span className="mono tnum" style={{ ...s.lineNo, position: "relative" }}>
          {showAdd && target && (
            <button
              type="button"
              title="Add a comment on this line"
              aria-label="Add a comment on this line"
              onClick={() => setComposing(true)}
              style={cs.addBtn}
            >
              +
            </button>
          )}
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
