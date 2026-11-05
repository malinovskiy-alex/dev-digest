/* RangeCaption — the window the figures on screen were computed for, next to
   the range control (L08 skill-stats R-31 … R-33, D-9).

   `applied` is the RESPONSE's `range`, never the client's current range: while
   a newer range loads, the caption is not shown at all (no window has figures
   yet), and it never names a window other than the figures'. Dates are written
   in `applied.tz`, the browser zone the client sent (R-31).
   - preset → "1 day · Nov 4, 10:37 – Nov 5, 10:37" (the applied end, G-01);
   - custom → "Nov 1 – Nov 3", both days included (G-02), with years only when
     a date is outside the current year (OQ-4 A). */
"use client";

import React from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { captionNeedsYear, captionWindow, type PerfRangeChoice } from "@/lib/perf-range";
import { CAPTION_DAY_FORMAT, CAPTION_PRESET_FORMAT, PRESET_BUTTONS } from "./constants";
import { cx } from "./styles";

export function RangeCaption({
  choice,
  applied,
}: {
  choice: PerfRangeChoice;
  applied: { from: string; to: string; tz: string } | undefined;
}): React.JSX.Element | null {
  const t = useTranslations("agentPerformance");
  const format = useFormatter();
  const now = useNow();
  if (!applied) return null;

  const timeZone = applied.tz;
  const w = captionWindow(choice, applied);
  let text: string;
  if (w.kind === "preset") {
    const labelKey = PRESET_BUTTONS.find((b) => b.preset === w.preset)!.labelKey;
    const opts = { ...CAPTION_PRESET_FORMAT, timeZone };
    text = t("range.caption.preset", {
      choice: t(labelKey),
      start: format.dateTime(w.start, opts),
      end: format.dateTime(w.end, opts),
    });
  } else {
    const opts = captionNeedsYear([w.start, w.lastDay], now, timeZone)
      ? { ...CAPTION_DAY_FORMAT, year: "numeric" as const, timeZone }
      : { ...CAPTION_DAY_FORMAT, timeZone };
    text = t("range.caption.custom", { start: format.dateTime(w.start, opts), end: format.dateTime(w.lastDay, opts) });
  }
  return <p className={cx.caption}>{text}</p>;
}
