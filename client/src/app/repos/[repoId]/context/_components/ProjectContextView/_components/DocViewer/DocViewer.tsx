/* DocViewer — the selected document, read-only: its name, what it costs in a
   prompt, how many agents use it, and the rendered markdown.

   The markdown is the repo's own text, i.e. untrusted. It goes through
   <UntrustedMarkdown> (no raw HTML, `javascript:` links dropped — R-17), which
   also never loads a remote image and never navigates the studio on a link. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { ContextDoc } from "@devdigest/shared";
import { UntrustedMarkdown } from "@/components/untrusted-markdown";
import { ApiError } from "@/lib/api";
import { useContextDocContent } from "@/lib/hooks/project-context";
import { DOC_NOT_FOUND_CODE } from "../../constants";
import { cx } from "./styles";

export interface DocViewerProps {
  repoId: string;
  path: string;
  /** The listing entry, when the path is in the current listing. */
  doc: ContextDoc | undefined;
  /** Re-read the listing (the "file not found" recovery, R-14). */
  onRefreshList: () => void;
}

export function DocViewer({ repoId, path, doc, onRefreshList }: DocViewerProps): React.JSX.Element {
  const t = useTranslations("context");
  const content = useContextDocContent(repoId, path);
  const notFound =
    content.error instanceof ApiError &&
    (content.error.code === DOC_NOT_FOUND_CODE || content.error.status === 404);

  return (
    <article className={cx.viewer}>
      <header className={cx.header}>
        <h2 className={cx.name} title={path}>
          {doc?.name ?? path}
        </h2>
        {doc && (
          <div className={cx.meta}>
            <Badge mono>{t("doc.tokens", { count: doc.approx_tokens.toLocaleString() })}</Badge>
            {doc.truncated && <Badge color="var(--warn)">{t("doc.truncated")}</Badge>}
            <Badge>{t("doc.usedBy", { count: doc.used_by })}</Badge>
          </div>
        )}
        <p className={cx.path}>{path}</p>
      </header>

      {content.isLoading && (
        <div className={cx.skeletons}>
          <Skeleton height={16} />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="60%" />
        </div>
      )}

      {notFound && (
        <div className={cx.notFound} role="alert">
          <p className={cx.notFoundText}>{t("states.notFound")}</p>
          <Button size="sm" icon="RefreshCw" onClick={onRefreshList}>
            {t("states.refreshList")}
          </Button>
        </div>
      )}

      {content.isError && !notFound && (
        <ErrorState
          body={content.error instanceof ApiError ? content.error.message : t("states.contentError")}
          onRetry={() => void content.refetch()}
        />
      )}

      {content.data && (
        <div className={cx.body}>
          <UntrustedMarkdown>{content.data.content}</UntrustedMarkdown>
        </div>
      )}
    </article>
  );
}
