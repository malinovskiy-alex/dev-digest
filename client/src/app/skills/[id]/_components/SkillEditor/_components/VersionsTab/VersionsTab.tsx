/* VersionsTab — the skill's body history.

   Only the body is versioned (server: `isBodyChange`), so every row here is a
   distinct prompt the agents once sent. That is the whole point of keeping
   them: a past review can be read against the exact text that produced it.

   Restore is a normal save of an old body, not a rewind. It mints a NEW
   version whose body equals the old one, so the history stays append-only and
   a run that cites v2 still resolves to the text v2 actually had. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useSkillVersions, useUpdateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { diffLines, newestFirst, summarize } from "./helpers";
import { s } from "./styles";

export function VersionsTab({ skill }: { skill: Skill }): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const update = useUpdateSkill();
  // Which row has its diff open. Only one at a time: two open diffs of the same
  // body against the same current text is noise, not comparison.
  const [openDiff, setOpenDiff] = React.useState<number | null>(null);
  // Restore rewrites the body, so it asks in the same dialog every other
  // destructive action in this app uses.
  const [restoring, setRestoring] = React.useState<{ version: number; body: string } | null>(null);

  if (isLoading) {
    return (
      <div style={s.skeletons} role="status" aria-busy="true">
        <Skeleton height={18} width={200} />
        <Skeleton height={52} />
        <Skeleton height={52} />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;
  }

  const versions = newestFirst(data);

  const restore = async () => {
    if (!restoring) return;
    const { version, body } = restoring;
    try {
      const saved = await update.mutateAsync({ id: skill.id, patch: { body } });
      setRestoring(null);
      toast.success(t("versions.restored", { from: version, version: saved.version }));
    } catch (e) {
      setRestoring(null);
      toast.error(e instanceof ApiError ? e.message : t("page.loadError"));
    }
  };

  return (
    <div style={s.wrap}>
      {restoring && (
        <ConfirmDialog
          title={t("versions.restoreTitle", { version: restoring.version })}
          body={t("versions.restoreConfirm", {
            version: restoring.version,
            next: skill.version + 1,
          })}
          confirmLabel={t("versions.restore")}
          busy={update.isPending}
          onConfirm={restore}
          onClose={() => setRestoring(null)}
        />
      )}
      <p style={s.count}>{t("versions.count", { count: versions.length })}</p>
      <p style={s.hint}>{t("versions.hint")}</p>

      <ul style={s.list}>
        {versions.map((v) => {
          const current = v.version === skill.version;
          const summary = summarize(v.body);
          const diffOpen = openDiff === v.version;
          return (
            <li key={v.version} style={s.row(current)}>
              <div style={s.rowMain}>
                <span className="mono" style={s.version}>
                  {t("preview.version", { version: v.version })}
                </span>
                <span style={s.summary(summary === null)}>
                  {summary ?? t("versions.emptyBody")}
                </span>
                <span className="tnum" style={s.date}>
                  {new Date(v.created_at).toLocaleDateString()}
                </span>
                {current ? (
                  <Badge color="var(--accent)" bg="var(--accent-bg)">
                    {t("versions.current")}
                  </Badge>
                ) : (
                  <Button
                    kind="secondary"
                    size="sm"
                    onClick={() => setRestoring({ version: v.version, body: v.body })}
                    disabled={update.isPending}
                  >
                    {t("versions.restore")}
                  </Button>
                )}
                <Button
                  kind="ghost"
                  size="sm"
                  onClick={() => setOpenDiff(diffOpen ? null : v.version)}
                  aria-expanded={diffOpen}
                  aria-label={t("versions.diffLabel", { version: v.version })}
                >
                  {t("versions.diff")}
                </Button>
              </div>

              {diffOpen && (
                <pre style={s.diff}>
                  {current
                    ? t("versions.diffIsCurrent")
                    : diffLines(v.body, skill.body).map((line, i) => (
                        <span key={i} style={s.diffLine(line.kind)}>
                          {line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}
                          {line.text}
                          {"\n"}
                        </span>
                      ))}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
