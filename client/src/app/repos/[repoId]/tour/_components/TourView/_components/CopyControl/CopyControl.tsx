/* CopyControl — copies a string to the clipboard. On success "Copied" shows
   for 2 s in a live region (AC-76); when the clipboard is unavailable a
   read-only field with the text, selected on focus, and "Copy it manually"
   take its place (AC-77). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { COPIED_MS } from "./constants";
import { copyText } from "./helpers";
import { cx } from "./styles";

export function CopyControl({
  text,
  label,
  ariaLabel,
}: {
  text: string;
  /** Visible button text; icon-only when absent. */
  label?: string;
  ariaLabel: string;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  // Clears the "Copied" confirmation after COPIED_MS — a timer, cleaned up.
  React.useEffect(() => {
    if (state !== "copied") return;
    const handle = setTimeout(() => setState("idle"), COPIED_MS);
    return () => clearTimeout(handle);
  }, [state]);

  const onCopy = async () => {
    setState((await copyText(text)) ? "copied" : "failed");
  };

  return (
    <span className={cx.wrap}>
      <button type="button" className={cx.button} aria-label={ariaLabel} onClick={() => void onCopy()}>
        <Icon.Copy size={12} />
        {label}
      </button>
      <span role="status" className={cx.copied}>
        {state === "copied" ? t("copied") : ""}
      </span>
      {state === "failed" && (
        <span className={cx.manual}>
          <input
            readOnly
            className={cx.input}
            value={text}
            aria-label={ariaLabel}
            onFocus={(e) => e.currentTarget.select()}
          />
          {t("copyManually")}
        </span>
      )}
    </span>
  );
}
