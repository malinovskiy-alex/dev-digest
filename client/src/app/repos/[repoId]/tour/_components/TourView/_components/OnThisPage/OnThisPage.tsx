/* OnThisPage — the aside listing the five sections (AC-08). A click scrolls
   the section into view and focuses its heading (AC-09); the entry of the
   section nearest the top of the viewport is marked current (AC-81). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { activeSection } from "./helpers";
import { cx } from "./styles";

export function OnThisPage({ items }: { items: Array<{ id: string; title: string }> }): React.JSX.Element {
  const t = useTranslations("onboarding");
  const [active, setActive] = React.useState<string | null>(items[0]?.id ?? null);
  const ids = items.map((i) => i.id).join(" ");

  // Syncs with the window's scroll position — an external system.
  React.useEffect(() => {
    const list = ids.split(" ").filter(Boolean);
    const update = () => {
      const tops = list.flatMap((id) => {
        const el = document.getElementById(`${id}-heading`);
        return el ? [{ id, top: el.getBoundingClientRect().top }] : [];
      });
      const next = activeSection(tops);
      if (next) setActive(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [ids]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    document.getElementById(`${id}-heading`)?.focus();
    setActive(id);
  };

  return (
    <nav aria-label={t("onThisPage")} className={cx.nav}>
      <p className={cx.title}>{t("onThisPage")}</p>
      <ul className={cx.list}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === active ? cx.itemActive : cx.item}
              aria-current={item.id === active ? "true" : undefined}
              onClick={() => jump(item.id)}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
