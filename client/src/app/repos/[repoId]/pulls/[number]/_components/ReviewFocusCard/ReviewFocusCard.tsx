/* ReviewFocusCard — "Review focus — read these first" as its own card on
   Overview, after the Intent / Blast grid (R-92): a count badge and one row per
   item `<file>:<line> — <reason>`, in the model's order (R-51). The reason is
   plain text (R-36, D-28); an empty list says so (R-52). While a brief is
   generated it shows an `aria-hidden` skeleton, no count, and is `aria-busy`
   (R-93). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@devdigest/ui";
import type { ReviewFocusItem } from "@devdigest/shared";
import type { BriefNavigation } from "@/lib/hooks/brief";
import { BriefFileRef } from "../BriefFileRef";
import { cx } from "./styles";

export function ReviewFocusCard({
  items,
  nav,
}: {
  /** The brief's items, or null while a generation runs (R-93). */
  items: ReviewFocusItem[] | null;
  nav: BriefNavigation;
}): React.JSX.Element {
  const t = useTranslations("brief");
  const headingId = React.useId();
  return (
    <section className={cx.card} aria-labelledby={headingId} aria-busy={items === null}>
      <h3 id={headingId} className={cx.heading}>
        {t("reviewFocus")}
        {items && <span className={cx.count}>{items.length}</span>}
      </h3>
      {items === null ? (
        // Purely visual: the one live "Generating…" status is the PR Brief block's (R-93).
        <div className={cx.skeletons} aria-hidden>
          <Skeleton width="65%" />
          <Skeleton width="55%" />
        </div>
      ) : items.length === 0 ? (
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
