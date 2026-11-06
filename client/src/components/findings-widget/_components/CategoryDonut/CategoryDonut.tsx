/* CategoryDonut — a fixed-size recharts ring inside `role="img"` named by
   `title`, the total in its centre (R-60, R-66), and a sibling legend that
   carries every value as text, "count · p%", so nothing depends on colour
   alone (R-61, R-66). Segments come in display order and keep it. */
"use client";

import React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { DONUT_SIZE, DONUT_STROKE } from "./constants";
import { cx } from "./styles";

export interface CategorySegment {
  key: string;
  label: string;
  count: number;
  /** the legend's value text, e.g. "4 · 31%" */
  text: string;
  color: string;
}

export function CategoryDonut({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: readonly CategorySegment[];
}): React.JSX.Element {
  const outer = DONUT_SIZE / 2;
  return (
    <div className={cx.wrap}>
      <div role="img" aria-label={title} className={cx.chart}>
        <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
          <Pie
            data={segments.map((s) => ({ key: s.key, label: s.label, value: s.count }))}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={outer - DONUT_STROKE}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
            stroke="none"
          >
            {segments.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
        <span className={cx.centre}>{total}</span>
      </div>
      <ul className={cx.legend}>
        {segments.map((s) => (
          <li key={s.key} className={cx.item}>
            <span aria-hidden="true" className={cx.swatch} style={{ background: s.color }} />
            <span className={cx.label}>{s.label}</span>
            <span className={cx.value}>{s.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
