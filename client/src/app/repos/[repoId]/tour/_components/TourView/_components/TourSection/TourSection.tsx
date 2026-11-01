/* TourSection — one of the five tour sections: an icon tile, a heading the
   "On this page" list can focus (tabIndex -1) and a named collapse toggle
   whose chevron points up while open. Every section is open on load (AC-10,
   AC-11). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { cx } from "./styles";

export function TourSection({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  /** The header tile's `@devdigest/ui` icon (design D-8); no tile when absent. */
  icon?: keyof typeof Icon;
  children: React.ReactNode;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const [open, setOpen] = React.useState(true);
  const headingId = `${id}-heading`;
  const bodyId = `${id}-body`;
  const TileIcon = icon ? Icon[icon] : null;

  return (
    <section id={id} aria-labelledby={headingId} className={cx.section}>
      <div className={cx.head}>
        <div className={cx.heading}>
          {TileIcon && (
            <span className={cx.tile} aria-hidden="true">
              <TileIcon size={18} />
            </span>
          )}
          <h2 id={headingId} tabIndex={-1} className={cx.title}>
            {title}
          </h2>
        </div>
        <button
          type="button"
          className={cx.toggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? t("collapse", { title }) : t("expand", { title })}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon.ChevronDown size={16} className={open ? cx.chevronOpen : undefined} />
        </button>
      </div>
      <div id={bodyId} hidden={!open} className={open ? cx.body : cx.bodyHidden}>
        {children}
      </div>
    </section>
  );
}
