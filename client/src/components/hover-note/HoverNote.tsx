/* HoverNote — a focusable inline note with a tooltip shown on hover AND on
   keyboard focus (L05 R-71, R-25, D-26). In-tree, no portal: there is no tooltip
   primitive in @devdigest/ui. The tooltip text stays in the DOM and is wired
   to the trigger with aria-describedby, so assistive tech reads it either way.

   Promoted from the PR Brief card when the Agent Performance screen became its
   second consumer (L08, D-14). `focusable={false}` wraps a control that is
   already focusable (a button): the wrapper adds no tab stop of its own, the
   tooltip still opens on hover and on the control's focus (`focus-within`),
   and the control's own accessible name must carry the text. */
"use client";

import React from "react";
import { cx } from "./styles";

export function HoverNote({
  children,
  tooltip,
  className,
  focusable = true,
}: {
  /** The visible note. */
  children: React.ReactNode;
  /** The tooltip body. */
  tooltip: React.ReactNode;
  className?: string;
  /** false when `children` is itself focusable — no nested tab stop. */
  focusable?: boolean;
}): React.JSX.Element {
  const id = React.useId();
  const wrap = className ? `${cx.wrap} ${className}` : cx.wrap;
  if (!focusable) {
    return (
      <span className={wrap}>
        {children}
        <span role="tooltip" aria-hidden="true" className={cx.tip}>
          {tooltip}
        </span>
      </span>
    );
  }
  return (
    <span tabIndex={0} aria-describedby={id} className={wrap}>
      {children}
      <span id={id} role="tooltip" className={cx.tip}>
        {tooltip}
      </span>
    </span>
  );
}
