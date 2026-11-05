/* RangeControl — "1 day", "30 days", "Custom range" for the Agent Performance
   dashboard and the agent Stats tab (R-32). A preset applies at once; a custom
   range applies from two labelled date inputs and an Apply button, after
   validation: an end before the start (R-36), a date after today (R-37) or a
   range reaching before 1970 (F-08) shows its message and calls nothing. Plain
   buttons and inputs — keyboard-operable as is (R-85).

   The pressed button and the custom form follow the APPLIED choice, also when it
   changes while mounted (back/forward, a link to a preset — F-12): the local
   draft is reset during render when the choice's key changes. Not by re-keying
   the component, which would remount the buttons and drop keyboard focus. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import {
  MIN_DATE,
  choiceKey,
  todayLocal,
  validateCustom,
  type CustomRangeError,
  type PerfRangeChoice,
} from "@/lib/perf-range";
import { ERROR_KEYS, PRESET_BUTTONS } from "./constants";
import { cx } from "./styles";

export function RangeControl({
  choice,
  onApply,
}: {
  choice: PerfRangeChoice;
  onApply: (next: PerfRangeChoice) => void;
}): React.JSX.Element {
  const t = useTranslations("agentPerformance");
  const startId = React.useId();
  const endId = React.useId();
  const errorId = React.useId();
  const [customOpen, setCustomOpen] = React.useState(choice.kind === "custom");
  const [start, setStart] = React.useState(choice.kind === "custom" ? choice.start : "");
  const [end, setEnd] = React.useState(choice.kind === "custom" ? choice.end : "");
  const [error, setError] = React.useState<CustomRangeError | null>(null);

  // Adjust the draft when the applied choice changes from outside (React's
  // "storing information from previous renders" pattern — no effect, no extra commit).
  const key = choiceKey(choice);
  const [shownKey, setShownKey] = React.useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setCustomOpen(choice.kind === "custom");
    setStart(choice.kind === "custom" ? choice.start : "");
    setEnd(choice.kind === "custom" ? choice.end : "");
    setError(null);
  }

  // Recomputed per render: the date input's upper bound moves at midnight.
  const today = todayLocal(new Date());
  const customPressed = customOpen || choice.kind === "custom";

  const pickPreset = (preset: (typeof PRESET_BUTTONS)[number]["preset"]) => {
    setCustomOpen(false);
    setError(null);
    onApply({ kind: "preset", preset, at: null });
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateCustom(start, end, todayLocal(new Date()));
    setError(err);
    if (err === null) onApply({ kind: "custom", start, end });
  };

  return (
    <div className={cx.wrap}>
      <div role="group" aria-label={t("range.groupLabel")} className={cx.group}>
        {PRESET_BUTTONS.map((b) => (
          <button
            key={b.preset}
            type="button"
            className={cx.choice}
            aria-pressed={!customPressed && choice.kind === "preset" && choice.preset === b.preset}
            onClick={() => pickPreset(b.preset)}
          >
            {t(b.labelKey)}
          </button>
        ))}
        <button
          type="button"
          className={cx.choice}
          aria-pressed={customPressed}
          onClick={() => setCustomOpen(true)}
        >
          {t("range.custom")}
        </button>
      </div>
      {customOpen && (
        <form className={cx.custom} onSubmit={applyCustom} noValidate>
          <label htmlFor={startId} className={cx.field}>
            {t("range.start")}
            <input
              id={startId}
              type="date"
              // The wrapping <label> names it too; the lint rule only reads the control itself.
              aria-label={t("range.start")}
              className={cx.input}
              value={start}
              min={MIN_DATE}
              max={today}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label htmlFor={endId} className={cx.field}>
            {t("range.end")}
            <input
              id={endId}
              type="date"
              aria-label={t("range.end")}
              className={cx.input}
              value={end}
              min={MIN_DATE}
              max={today}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Button kind="secondary" size="sm" type="submit">
            {t("range.apply")}
          </Button>
        </form>
      )}
      {error && (
        <p id={errorId} role="alert" className={cx.error}>
          {t(ERROR_KEYS[error])}
        </p>
      )}
    </div>
  );
}
