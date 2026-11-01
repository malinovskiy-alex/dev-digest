/* TourSection — one of the five tour sections: a heading the "On this page"
   list can focus (tabIndex -1) and a named collapse toggle. Every section is
   open on load (AC-10, AC-11). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { cx } from "./styles";

export function TourSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const [open, setOpen] = React.useState(true);
  const headingId = `${id}-heading`;
  const bodyId = `${id}-body`;

  return (
    <section id={id} aria-labelledby={headingId} className={cx.section}>
      <div className={cx.head}>
        <h2 id={headingId} tabIndex={-1} className={cx.title}>
          {title}
        </h2>
        <button
          type="button"
          className={cx.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? t("collapse", { title }) : t("expand", { title })}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <Icon.ChevronDown size={14} /> : <Icon.ChevronRight size={14} />}
        </button>
      </div>
      <div id={bodyId} hidden={!open} className={open ? cx.body : cx.bodyHidden}>
        {children}
      </div>
    </section>
  );
}
