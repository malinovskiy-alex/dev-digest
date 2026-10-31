/* PromptBlock — one labelled, collapsible prompt segment with copy + fullscreen
   actions; fullscreen opens PromptModalBody in a Modal.

   Each block carries its own weight in tokens. That number is the point of the
   section: it is what makes "the skills block costs a third of this prompt" a
   thing you can read off the screen instead of guess at. It is an estimate —
   see `estimateTokens` in lib/tokens. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Modal } from "@devdigest/ui";
import { s } from "../../styles";
import { PromptModalBody } from "../PromptModalBody";
import { estimateTokens } from "@/lib/tokens";

const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  borderRadius: 5,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-muted)",
  cursor: "pointer",
};

export function PromptBlock({ label, text, color }: { label: string; text: string; color: string }) {
  const t = useTranslations("runs");
  const tokens = estimateTokens(text);
  const [open, setOpen] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div style={s.promptRow}>
      <div style={s.promptHead}>
        {/* The toggle is its own button, named by the row label, beside the
            copy/fullscreen buttons — a button cannot contain buttons. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((o) => !o)}
          style={s.promptToggleBtn}
        >
          <span style={s.promptDot(color)} />
          <span style={s.promptLabel}>{label}</span>
          <Badge color="var(--text-muted)" mono>
            {t("trace.prompt.tokens", { count: tokens })}
          </Badge>
        </button>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            title={t("trace.prompt.copy")}
            aria-label={t("trace.prompt.copy")}
            onClick={copy}
            style={miniBtnStyle}
          >
            {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
          </button>
          <button
            type="button"
            title={t("trace.prompt.fullscreen")}
            // The row label is in the name: every prompt row has this button,
            // and "Open fullscreen" alone cannot say which block it opens.
            aria-label={t("trace.prompt.fullscreenFor", { label })}
            onClick={() => setFull(true)}
            style={miniBtnStyle}
          >
            <Icon.ExternalLink size={12} />
          </button>
          <span
            aria-hidden
            onClick={() => setOpen((o) => !o)}
            style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}
          >
            {open ? t("trace.collapse") : t("trace.expand")}
          </span>
        </span>
      </div>
      {open && (
        <pre className="mono" style={s.promptPre}>
          {text || "—"}
        </pre>
      )}
      {full && (
        <Modal
          width={1200}
          title={label}
          onClose={() => setFull(false)}
          footer={
            <Button kind="secondary" size="sm" icon={copied ? "Check" : "Copy"} onClick={copy}>
              {copied ? t("drawer.copied") : t("trace.prompt.copy")}
            </Button>
          }
        >
          <PromptModalBody text={text} />
        </Modal>
      )}
    </div>
  );
}
