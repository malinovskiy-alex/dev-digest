/* ReviewFocusList — "Review focus — read these first": a count badge and one
   row per item `<file>:<line> — <reason>`, in the model's order (R-51). The
   reason is plain text (R-36, D-28); an empty list says so (R-52). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { ReviewFocusItem } from "@devdigest/shared";
import type { BriefNavigation } from "@/lib/hooks/brief";
import { BriefFileRef } from "../../../BriefFileRef";
import { cx } from "./styles";

export function ReviewFocusList({
  items,
  nav,
}: {
  items: ReviewFocusItem[];
  nav: BriefNavigation;
}): React.JSX.Element {
  const t = useTranslations("brief");
  const headingId = React.useId();
  return (
    <section className={cx.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={cx.heading}>
        {t("reviewFocus")}
        <span className={cx.count}>{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className={cx.empty}>{t("noFocus")}</p>
      ) : (
        <ol className={cx.list}>
          {items.map((item, i) => {
            const key = `focus:${i}`;
            return (
              <li key={`${i}:${item.file}:${item.line}`} className={cx.item}>
                <BriefFileRef
                  path={item.file}
                  line={item.line}
                  inDiff={nav.inDiff(item.file)}
                  notice={nav.noticeKey === key}
                  onActivate={() => nav.activate(key, item.file, item.line)}
                />
                <span className={cx.dash} aria-hidden>
                  —
                </span>
                <span className={cx.reason}>{item.reason}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
