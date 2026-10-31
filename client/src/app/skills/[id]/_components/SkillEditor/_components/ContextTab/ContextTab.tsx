/* ContextTab (skill) — project documents attached to this skill (L05). Every
   agent that has the skill active inherits them, after its own documents.

   Same list as the agent tab, without inherited rows. Below it: the total and
   a "Serializes as" preview of what the skill contributes to the prompt's
   `## Project context` section. Attaching documents does NOT version the skill. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ContextDocsList } from "@/components/context-docs-list";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { buildDocRows, promptTokenTotal, toEntries, type DocRow } from "@/lib/context-docs";
import { useContextDocs } from "@/lib/hooks/project-context";
import { useSetSkillContextDocs, useSkillContextDocs } from "@/lib/hooks/skills";
import { useActiveRepo } from "@/lib/repo-context";
import { useToast } from "@/lib/toast";
import { checkedCount, serializePreview } from "./helpers";
import { cx } from "./styles";

export function ContextTab({ skill }: { skill: Skill }): React.JSX.Element {
  const t = useTranslations("skills");
  const toast = useToast();
  const { repoId } = useActiveRepo();
  const listing = useContextDocs(repoId);
  const links = useSkillContextDocs(skill.id);
  const save = useSetSkillContextDocs();
  const [draft, setDraft] = React.useState<DocRow[] | null>(null);

  const serverRows = React.useMemo(
    () => buildDocRows(listing.data?.docs ?? [], links.data?.attached ?? []),
    [listing.data, links.data],
  );
  const rows = draft ?? serverRows;

  if (!repoId) return <RepoNotFound />;

  const isLoading = listing.isLoading || links.isLoading;
  const isError = listing.isError || links.isError;

  const commit = (next: DocRow[]) => {
    if (save.isPending) return;
    setDraft(next);
    save.mutate(
      { skillId: skill.id, docs: toEntries(next) },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(t("context.saved"));
        },
        onError: (err) => {
          setDraft(null);
          toast.error(t("context.saveError", { message: err instanceof ApiError ? err.message : String(err) }));
        },
      },
    );
  };

  const preview = serializePreview(rows);

  return (
    <div className={cx.wrap}>
      <p className={cx.hint}>{t("context.inheritHint")}</p>

      {isLoading && (
        <div className={cx.skeletons}>
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      )}

      {isError && (
        <ErrorState
          body={
            (listing.error ?? links.error) instanceof ApiError
              ? (listing.error ?? links.error)!.message
              : undefined
          }
          onRetry={() => {
            void listing.refetch();
            void links.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <ContextDocsList
          repoId={repoId}
          rows={rows}
          busy={save.isPending}
          onCommit={commit}
          header={
            <>
              <h2 className={cx.h2}>{t("context.title")}</h2>
              <Badge color="var(--accent)" bg="var(--accent-bg)">
                {t("context.attachedCount", { count: checkedCount(rows) })}
              </Badge>
            </>
          }
          footer={
            <div className={cx.footer}>
              <span className={cx.total}>
                {t("context.total", { count: promptTokenTotal(rows).toLocaleString() })}
              </span>
              <span className={cx.label}>{t("context.serializesAs")}</span>
              {preview ? (
                <pre className={cx.pre}>{preview}</pre>
              ) : (
                <p className={cx.none}>{t("context.serializesNone")}</p>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
