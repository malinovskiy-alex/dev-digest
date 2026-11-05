/* PullFreqHint — what a card's pull frequency means (L08 skill-stats R-82,
   R-83, D-11, F-18), shown while the pull-frequency badge is hovered or the card
   holds keyboard focus.

   - Read ONCE: the card root points `aria-describedby` at this id and the
     element itself is `aria-hidden`, so its text is the card's description
     and never part of the card button's name.
   - Hoverable: no `pointer-events-none`, and it stays shown while hovered itself;
     it sits directly under the badge row with no gap (WCAG 1.4.13).
   - Dismissible: the card hides it on Escape (`dismissed`) until the pointer
     or focus leaves the card (WCAG 1.4.13).
   - Never over the description and never clipped by the rail's `overflow: auto`:
     it is in the card's flow, below the badge row, not an overlay.
   - Never shifts the layout (F-19): its line is always reserved and only its
     `visibility` changes, so hovering the badge leaves the card's height alone.
   - Reserved from the first paint (F-20): the card renders it whenever a pull
     frequency is passed. Until the read is `ready` it is `reserveOnly` — no id
     (so nothing describes the card), never visible, aria-hidden — and keeps the
     same text only so its height matches the ready hint exactly. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cx } from "./styles";

export function PullFreqHint({
  id,
  dismissed,
  reserveOnly = false,
}: {
  id: string;
  dismissed: boolean;
  /** Pull frequency not `ready` yet (loading / failed): hold the line, never show or describe. */
  reserveOnly?: boolean;
}): React.JSX.Element {
  const t = useTranslations("skills");
  return (
    <span
      id={reserveOnly ? undefined : id}
      aria-hidden="true"
      className={reserveOnly ? cx.reserved : dismissed ? cx.dismissed : cx.hint}
    >
      <span className={cx.box}>{t("listItem.pullFreqHint")}</span>
    </span>
  );
}
