/* ConfirmDialog — the one "are you sure?" for destructive actions.

   It replaces `window.confirm`, which cannot be styled, cannot be dismissed
   with anything but its own two buttons, blocks the whole tab while it is up,
   and — in a browser-driven test or a screenshot — is invisible to the page.
   This one is a real dialog: confirm, cancel, and the X the Modal already
   provides, all three closing it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import { DIALOG_WIDTH } from "./constants";
import { s } from "./styles";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  body: React.ReactNode;
  /** The affirmative button's text — name the act ("Delete skill"), not "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** True while the action is in flight; both buttons go inert. */
  busy?: boolean;
}): React.JSX.Element {
  const t = useTranslations("common");

  return (
    <Modal
      width={DIALOG_WIDTH}
      title={title}
      onClose={busy ? undefined : onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button kind="danger" icon="Trash" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={s.body}>{body}</div>
    </Modal>
  );
}
