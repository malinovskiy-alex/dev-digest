/* ConventionCard — one extracted house-rule: the rule, the code it was found
   in, how consistently the repo follows it, and the two decisions a reader can
   make about it (keep / drop, or correct the wording first).

   The evidence block is not decoration. Every line in it was re-read from the
   repo by the server's evidence gate, so it is the repo's own code and the
   `file:line` above it resolves — which is what makes "accept" a judgement
   rather than a guess. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, IconBtn, ProgressBar, SelectInput, Textarea } from "@devdigest/ui";
import type { ConventionCandidate, ConventionCategory } from "@devdigest/shared";
import { CONVENTION_CATEGORIES } from "@/lib/convention-categories";
import { confidenceColor, evidenceRef } from "../../helpers";
import { s } from "./styles";

export function ConventionCard({
  candidate,
  busy,
  onStatusChange,
  onEdit,
}: {
  candidate: ConventionCandidate;
  busy?: boolean;
  onStatusChange: (status: ConventionCandidate["status"]) => void;
  onEdit: (patch: { rule: string; category: ConventionCategory }) => void;
}): React.JSX.Element {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(candidate.rule);
  const [category, setCategory] = React.useState<ConventionCategory>(candidate.category);
  const [copied, setCopied] = React.useState(false);

  const accepted = candidate.status === "accepted";
  const pct = Math.round(candidate.confidence * 100);

  const open = () => {
    // Re-seed from the row every time: a save that failed left the local draft
    // ahead of the server, and re-opening should show what is actually stored.
    setRule(candidate.rule);
    setCategory(candidate.category);
    setEditing(true);
  };

  const save = () => {
    const next = rule.trim();
    if (next.length === 0) return;
    onEdit({ rule: next, category });
    setEditing(false);
  };

  /**
   * Copies the `file:line` reference AND the code under it — the reference
   * alone is what you paste into a review comment, the code is what you paste
   * into a search. `navigator.clipboard` is absent in jsdom and over plain
   * HTTP, so the failure is swallowed: a copy button that throws is worse than
   * one that does nothing.
   */
  const copy = () => {
    const payload = `${evidenceRef(candidate)}\n${candidate.evidence_snippet}`;
    void navigator.clipboard
      ?.writeText(payload)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => undefined);
  };

  return (
    <div style={s.card(accepted)}>
      <div style={s.main}>
        {editing ? (
          <div style={s.editForm}>
            <label style={{ display: "block" }}>
              <span style={s.confidenceLabel}>{t("card.ruleLabel")}</span>
              <Textarea value={rule} onChange={setRule} rows={2} />
            </label>
            <label style={{ display: "block" }}>
              <span style={s.confidenceLabel}>{t("card.categoryLabel")}</span>
              <SelectInput
                value={category}
                onChange={(v) => setCategory(v as ConventionCategory)}
                options={CONVENTION_CATEGORIES.map((c) => ({
                  value: c,
                  label: t(`category.${c}`),
                }))}
              />
            </label>
            <div style={s.editActions}>
              <Button kind="primary" size="sm" onClick={save} disabled={rule.trim().length === 0}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.ruleRow}>
            <span style={s.rule(accepted)}>{candidate.rule}</span>
            <Badge color="var(--text-secondary)">{t(`category.${candidate.category}`)}</Badge>
          </div>
        )}

        <div style={s.evidence}>
          <div style={s.evidenceHeader}>
            <span className="mono" style={s.evidencePath}>
              {evidenceRef(candidate)}
            </span>
            <IconBtn
              icon={copied ? "Check" : "Copy"}
              label={copied ? t("card.copied") : t("card.copyEvidence")}
              size={24}
              onClick={copy}
            />
          </div>
          <pre className="mono" style={s.snippet}>
            {candidate.evidence_snippet}
          </pre>
        </div>

        <div style={s.confidenceRow}>
          <span style={s.confidenceLabel}>{t("card.confidence")}</span>
          <div style={s.confidenceBar}>
            <ProgressBar value={pct} color={confidenceColor(candidate.confidence)} />
          </div>
          <span className="mono tnum" style={s.confidenceValue}>
            {pct}%
          </span>
        </div>
      </div>

      {/*
        A segmented pair, not a checkbox. Each label names the STATE when that
        state is current and the ACTION when it is not ("Accepted" vs "Accept"),
        so the highlight never has to be decoded — and `aria-pressed` says the
        same thing to a screen reader, which cannot see the highlight at all.
      */}
      <div style={s.actions} role="group" aria-label={candidate.rule}>
        <Button
          kind={accepted ? "primary" : "secondary"}
          icon="Check"
          disabled={busy}
          aria-pressed={accepted}
          onClick={() => onStatusChange("accepted")}
        >
          {accepted ? t("card.accepted") : t("card.accept")}
        </Button>
        <Button
          kind={accepted ? "ghost" : "secondary"}
          icon="X"
          disabled={busy}
          aria-pressed={!accepted}
          onClick={() => onStatusChange("rejected")}
        >
          {accepted ? t("card.reject") : t("card.rejected")}
        </Button>
        {/*
          Edit sits with the other two rather than as a bare icon by the rule.
          The three are one decision — keep it, drop it, or fix the wording
          first — and an icon-only control makes the third look like a lesser
          affordance than it is.
        */}
        {!editing && (
          <Button kind="ghost" icon="Edit" disabled={busy} onClick={open}>
            {t("card.edit")}
          </Button>
        )}
      </div>
    </div>
  );
}
