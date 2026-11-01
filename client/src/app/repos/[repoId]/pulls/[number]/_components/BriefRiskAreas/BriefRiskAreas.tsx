/* BriefRiskAreas — the PR Brief's Risk areas, shown inside the Intent card in
   place of the intent's own list while a brief is stored (R-63). One row per
   risk: severity dot + hidden severity text, title and first file ref (R-49);
   an expand control reveals the explanation and every ref (R-50). Model text
   is rendered as plain text — never markdown, never HTML (R-36, D-28). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { Risk } from "@devdigest/shared";
import type { BriefNavigation } from "@/lib/hooks/brief";
import { BriefFileRef } from "../BriefFileRef";
import { SEVERITY_DOT } from "./constants";
import { parseRef, refLabel, type ParsedRef } from "./helpers";
import { cx } from "./styles";

export function BriefRiskAreas({ risks, nav }: { risks: Risk[]; nav: BriefNavigation }): React.JSX.Element {
  const t = useTranslations("brief");
  if (risks.length === 0) return <p className={cx.empty}>{t("noRisks")}</p>;
  return (
    <ul className={cx.list}>
      {risks.map((risk, i) => (
        <RiskRow key={`${i}:${risk.title}`} risk={risk} index={i} nav={nav} />
      ))}
    </ul>
  );
}

function RiskRow({ risk, index, nav }: { risk: Risk; index: number; nav: BriefNavigation }): React.JSX.Element {
  const t = useTranslations("brief");
  const [open, setOpen] = React.useState(false);
  const detailsId = React.useId();
  const refs = risk.file_refs.map(parseRef);
  const first = refs[0];

  return (
    <li className={cx.row}>
      <div className={cx.head}>
        <span aria-hidden className={`${cx.dot} ${SEVERITY_DOT[risk.severity]}`} />
        <div className={cx.main}>
          <p className={cx.title}>
            <span className="sr-only">{t(`severity.${risk.severity}`)} </span>
            {risk.title}
          </p>
          {first && !open && <RiskRef parsed={first} refKey={`risk:${index}:0`} nav={nav} />}
        </div>
        <button
          type="button"
          className={cx.expand}
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={t("riskExpand", { title: risk.title })}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon.ChevronRight size={14} aria-hidden className={open ? cx.chevronOpen : cx.chevron} />
        </button>
      </div>
      <div id={detailsId} hidden={!open} className={cx.details}>
        {open && (
          <>
            <p className={cx.explanation}>{risk.explanation}</p>
            <ul className={cx.refs}>
              {refs.map((ref, j) => (
                <li key={`${j}:${risk.file_refs[j]}`}>
                  <RiskRef parsed={ref} refKey={`risk:${index}:${j}`} nav={nav} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  );
}

function RiskRef({ parsed, refKey, nav }: { parsed: ParsedRef; refKey: string; nav: BriefNavigation }): React.JSX.Element {
  return (
    <BriefFileRef
      path={parsed.path}
      line={parsed.start}
      lines={refLabel(parsed)}
      inDiff={nav.inDiff(parsed.path)}
      notice={nav.noticeKey === refKey}
      onActivate={() => nav.activate(refKey, parsed.path, parsed.start)}
    />
  );
}
