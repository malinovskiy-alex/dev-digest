/* ContextDocPreviewModal — read one document without leaving the editor (R-29).
   The text is the repo's own (untrusted) markdown, rendered through
   <UntrustedMarkdown>: no raw HTML, no remote images, no in-studio navigation. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ErrorState, Modal, Skeleton } from "@devdigest/ui";
import { UntrustedMarkdown } from "@/components/untrusted-markdown";
import { ApiError } from "@/lib/api";
import { useContextDocContent } from "@/lib/hooks/project-context";
import { PREVIEW_WIDTH } from "../../constants";
import { cx } from "./styles";

export interface ContextDocPreviewModalProps {
  repoId: string;
  path: string;
  onClose: () => void;
}

export function ContextDocPreviewModal({ repoId, path, onClose }: ContextDocPreviewModalProps): React.JSX.Element {
  const t = useTranslations("context");
  const content = useContextDocContent(repoId, path);
  return (
    <Modal
      width={PREVIEW_WIDTH}
      title={t("list.previewTitle")}
      subtitle={<span className={cx.path}>{path}</span>}
      onClose={onClose}
      footer={
        <Button size="sm" onClick={onClose}>
          {t("list.close")}
        </Button>
      }
    >
      {content.isLoading && (
        <div className={cx.skeletons}>
          <Skeleton height={16} />
          <Skeleton height={16} width="70%" />
        </div>
      )}
      {content.isError && (
        <ErrorState
          body={content.error instanceof ApiError ? content.error.message : t("list.previewLoadError")}
          onRetry={() => void content.refetch()}
        />
      )}
      {content.data && (
        <div className={cx.body}>
          <UntrustedMarkdown>{content.data.content}</UntrustedMarkdown>
        </div>
      )}
    </Modal>
  );
}
