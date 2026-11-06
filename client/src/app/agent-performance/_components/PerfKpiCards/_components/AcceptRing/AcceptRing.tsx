/* AcceptRing — a ring filled to the pooled accept percent, stroked in its band
   colour (R-98, D-24). Decorative: the value is already printed beside it, so it
   is hidden from assistive technology. The caller renders it only when the rate
   is known — never an empty ring (R-99). Own SVG: `CircularScore` hard-codes
   other thresholds. */
import React from "react";
import { RING_SIZE, RING_STROKE } from "./constants";

export function AcceptRing({ percent, color }: { percent: number; color: string }): React.JSX.Element {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;
  const mid = RING_SIZE / 2;
  return (
    <svg width={RING_SIZE} height={RING_SIZE} aria-hidden="true" focusable="false">
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--border)" strokeWidth={RING_STROKE} />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={RING_STROKE}
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${mid} ${mid})`}
      />
    </svg>
  );
}
