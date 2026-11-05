/* CostDonut — a fixed-size recharts ring inside `role="img"` with the chart's
   accessible name (R-87), and a sibling legend listing every segment's name and
   house-format amount in the order received (R-67, R-69, R-51). The vendored
   `Donut` is not used: it prints `toFixed(2)` and has no accessible name (D-13). */
"use client";

import React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { formatCostUsd } from "@/lib/format-cost";
import { DONUT_SIZE, DONUT_STROKE } from "./constants";
import { cx } from "./styles";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function CostDonut({ title, segments }: { title: string; segments: readonly DonutSegment[] }): React.JSX.Element {
  const outer = DONUT_SIZE / 2;
  return (
    <div className={cx.wrap}>
      <div role="img" aria-label={title} className={cx.chart}>
        <PieChart width={DONUT_SIZE} height={DONUT_SIZE}>
          <Pie
            data={[...segments]}
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
      </div>
      <ul className={cx.legend}>
        {segments.map((s) => (
          <li key={s.key} className={cx.item}>
            <span aria-hidden="true" className={cx.swatch} style={{ background: s.color }} />
            <span className={cx.label}>{s.label}</span>
            <span className={cx.value}>{formatCostUsd(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
