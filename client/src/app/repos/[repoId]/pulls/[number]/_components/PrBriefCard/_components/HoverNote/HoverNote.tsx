/* HoverNote — a focusable inline note with a tooltip shown on hover AND on
   keyboard focus (R-71, R-25, D-26). In-tree, no portal: there is no tooltip
   primitive in @devdigest/ui. The tooltip text stays in the DOM and is wired
   to the trigger with aria-describedby, so assistive tech reads it either way. */
"use client";

import React from "react";
import { cx } from "./styles";

export function HoverNote({
  children,
  tooltip,
  className,
}: {
  /** The visible note. */
  children: React.ReactNode;
  /** The tooltip body. */
  tooltip: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const id = React.useId();
  return (
    <span tabIndex={0} aria-describedby={id} className={className ? `${cx.wrap} ${className}` : cx.wrap}>
      {children}
      <span id={id} role="tooltip" className={cx.tip}>
        {tooltip}
      </span>
    </span>
  );
}
