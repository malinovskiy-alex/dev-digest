/* One finding, as it appears inside a findings popover.

   Strictly a read-out: no buttons, and no links either. Accepting or rejecting
   a finding happens on the PR detail page, in the expanded run card — a panel
   that disappears when the pointer leaves is the wrong place to put an action,
   and any focusable descendant here would also become a stray tab stop between
   two rows of whatever list the trigger sits in. "No controls" is a contract a
   test holds it to. */
"use client";

import { SeverityBadge, CategoryTag, ConfidenceNum, type Severity, type Category } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { lineLabel, shortRationale } from "@/lib/finding-format";
import { s } from "./styles";

export interface FindingPreviewProps {
  f: FindingRecord;
}

export function FindingPreview({ f }: FindingPreviewProps) {
  return (
    <div style={s.row}>
      <div style={s.badgeWrap}>
        <SeverityBadge severity={f.severity as Severity} compact />
      </div>
      <div style={s.main}>
        <div style={s.titleRow}>
          <span style={s.findingTitle}>{f.title}</span>
          <CategoryTag category={f.category as Category} />
        </div>
        <div style={s.metaRow}>
          {/* A span, not MonoLink: MonoLink renders an anchor. */}
          <span className="mono" style={s.location}>
            {f.file}:{lineLabel(f)}
          </span>
          <ConfidenceNum value={f.confidence} />
        </div>
        <p style={s.rationale}>{shortRationale(f.rationale)}</p>
      </div>
    </div>
  );
}

export default FindingPreview;
