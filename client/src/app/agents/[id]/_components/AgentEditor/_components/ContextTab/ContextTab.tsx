/* ContextTab — which project documents go into this agent's reviews, and in
   which order (L05).

   The list comes from the ACTIVE repo's listing: the documents are paths, and
   a path is resolved against whichever repo the agent reviews. Documents the
   agent inherits through an active skill are shown dimmed after its own, so
   the total is what the prompt will actually carry.

   Every check, uncheck and reorder PUTs the whole ordered list. The rows show
   the new state at once; a rejected write puts them back to the server's and
   says why (R-30). Changing this list does NOT version the agent. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { ContextDocsList } from "@/components/context-docs-list";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import {
  attachedCount,
  buildDocRows,
  promptTokenTotal,
  sourceCount,
  toEntries,
  type DocRow,
} from "@/lib/context-docs";
import { useAgentContextDocs, useSetAgentContextDocs } from "@/lib/hooks/agents";
import { useContextDocs } from "@/lib/hooks/project-context";
import { useActiveRepo } from "@/lib/repo-context";
import { useToast } from "@/lib/toast";
import { cx } from "./styles";

export function ContextTab({ agent }: { agent: Agent }): React.JSX.Element {
  const t = useTranslations("agents");
  const toast = useToast();
  const { repoId } = useActiveRepo();
  const listing = useContextDocs(repoId);
  const links = useAgentContextDocs(agent.id);
  const save = useSetAgentContextDocs();
  // The rows as last committed by the user, until the server answers.
  const [draft, setDraft] = React.useState<DocRow[] | null>(null);

  const serverRows = React.useMemo(
    () => buildDocRows(listing.data?.docs ?? [], links.data?.attached ?? [], links.data?.inherited ?? []),
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
      { agentId: agent.id, docs: toEntries(next) },
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

  return (
    <div className={cx.wrap}>
      <p className={cx.hint}>{t("context.orderHint")}</p>

      {isLoading && (
        <div className={cx.skeletons}>
          <Skeleton height={44} />
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
              {/* X and Y are counted from the FULL row array, never the filtered view. */}
              <Badge color="var(--accent)" bg="var(--accent-bg)">
                {t("context.attachedCount", { attached: attachedCount(rows), total: sourceCount(rows) })}
              </Badge>
            </>
          }
          footer={
            <div className={cx.footer}>
              <span className={cx.total}>
                {t("context.total", { count: promptTokenTotal(rows).toLocaleString() })}
              </span>
              <p className={cx.untrusted}>{t("context.untrustedHint")}</p>
            </div>
          }
        />
      )}
    </div>
  );
}
