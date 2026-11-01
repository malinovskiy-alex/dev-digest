/* OnThisPage — the aside listing the five sections (AC-08). A click scrolls
   the section into view and focuses its heading (AC-09); the entry of the
   section nearest the top of its scroll container is marked current (AC-81). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { activeSection, scrolledToEnd } from "./helpers";
import { cx } from "./styles";

/**
 * The element the headings scroll in: the nearest ancestor whose own
 * overflow-y scrolls — the app shell scrolls its `<main>`, not the window
 * (F-38). `null` means the document itself scrolls.
 */
function scrollParent(el: Element | null): HTMLElement | null {
  for (let cur = el?.parentElement ?? null; cur; cur = cur.parentElement) {
    if (cur === document.body || cur === document.documentElement) return null;
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(cur).overflowY)) return cur;
  }
  return null;
}

export function OnThisPage({ items }: { items: Array<{ id: string; title: string }> }): React.JSX.Element {
  const t = useTranslations("onboarding");
  const [active, setActive] = React.useState<string | null>(items[0]?.id ?? null);
  const ids = items.map((i) => i.id).join(" ");

  // Syncs with the scroll position of the headings' scroll container — an
  // external system. Tops are measured from that container's top edge, so the
  // shell's top bar above it does not shift which section is current (F-38).
  React.useEffect(() => {
    const list = ids.split(" ").filter(Boolean);
    const first = list.length ? document.getElementById(`${list[0]}-heading`) : null;
    const container = scrollParent(first);
    const update = () => {
      const originTop = container ? container.getBoundingClientRect().top : 0;
      const tops = list.flatMap((id) => {
        const el = document.getElementById(`${id}-heading`);
        return el ? [{ id, top: el.getBoundingClientRect().top - originTop }] : [];
      });
      const root = container ?? document.documentElement;
      const next = activeSection(tops, scrolledToEnd(root.scrollTop, root.clientHeight, root.scrollHeight));
      if (next) setActive(next);
    };
    // At most one measurement per animation frame (F-24): the first scroll
    // event measures at once, the rest of that frame are dropped, and one
    // trailing measurement at the next frame catches where the scroll ended.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      update();
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    // The window too: the document scrolls when the shell is not the scroller
    // (and in a narrow layout). Scroll events do not bubble, so the container
    // gets its own listener.
    window.addEventListener("scroll", onScroll, { passive: true });
    container?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      container?.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
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
