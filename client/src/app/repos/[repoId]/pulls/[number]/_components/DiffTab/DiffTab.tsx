/* DiffTab — the PR's "Files changed" tab. Smart order groups the files by role
   (core → tests → wiring → docs → boilerplate, grouping from the smart-diff
   route); Original order is GitHub's flat list. Either way the latest review's
   findings render inline under the lines they cite. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel, Button, Skeleton } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import {
  usePrComments,
  useCreatePrComment,
  usePrReviews,
  useSmartDiff,
  useFindingAction,
} from "@/lib/hooks/reviews";
import { notify } from "@/lib/toast";
import type { PrFile } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { DiffOrderToggle } from "./_components/DiffOrderToggle";
import { SmartDiffGroup } from "./_components/SmartDiffGroup";
import { DEFAULT_DIFF_ORDER, type DiffOrder } from "./constants";
import { diffTotals, inlineFindings, resolveGroups } from "./helpers";
import * as styles from "./styles";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
  /** For the finding cards' "open on GitHub" file links. */
  repoFullName?: string | null;
  headSha?: string | null;
}

export function DiffTab({ prId, files, canComment, repoFullName, headSha }: DiffTabProps) {
  const t = useTranslations("prReview");
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  const { data: reviews } = usePrReviews(prId);
  const { data: smartDiff, isLoading: smartDiffLoading, isError: smartDiffFailed } = useSmartDiff(prId);
  const action = useFindingAction();
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);
  // Findings start shown — reading them next to the code is the point of the
  // tab; hiding them keeps the line bars, labels and header badges.
  const [showFindings, setShowFindings] = React.useState(true);
  const [order, setOrder] = React.useState<DiffOrder>(DEFAULT_DIFF_ORDER);

  // Derived, never stored. While the smart diff loads, a placeholder stands in
  // for the files: rendering the whole flat diff first and then re-rendering it
  // as groups doubles the work, which freezes the tab on a large PR. No
  // grouping once it settles (errored, or not covering every file) means
  // Original order with the toggle disabled — nothing is hidden.
  // Inline findings come from the review the server named in the smart diff
  // (in either order), so none render until the smart diff has resolved.
  const findings = inlineFindings(reviews, smartDiff, smartDiffFailed);
  const groups = resolveGroups(smartDiff, files);
  const effectiveOrder: DiffOrder = groups ? order : "original";
  const totals = diffTotals(files);
  const commentCount = comments?.length ?? 0;

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  // Same wiring as FindingsPanel, so a card behaves identically on both tabs.
  const findingApi: DiffFindingApi = {
    findings,
    showFindings,
    renderFinding: (f) => (
      <FindingCard
        f={f}
        defaultExpanded
        pending={action.isPending}
        repoFullName={repoFullName}
        headSha={headSha}
        onAction={(act) => action.mutate({ findingId: f.id, action: act, prId: prId ?? undefined })}
      />
    ),
  };

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <div className={styles.headerActions}>
            <DiffOrderToggle value={effectiveOrder} onChange={setOrder} disabled={!groups} />
            {findings.length > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showFindings ? "EyeOff" : "Eye"}
                onClick={() => setShowFindings((v) => !v)}
              >
                {showFindings
                  ? t("smartDiff.hideFindings", { count: findings.length })
                  : t("smartDiff.showFindings", { count: findings.length })}
              </Button>
            )}
            {commentCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments
                  ? t("smartDiff.hideComments", { count: commentCount })
                  : t("smartDiff.showComments", { count: commentCount })}
              </Button>
            )}
          </div>
        }
      >
        <span>{effectiveOrder === "smart" ? t("smartDiff.caption") : t("smartDiff.originalCaption")}</span>
        <span className={styles.summary}>{t("smartDiff.summary", totals)}</span>
      </SectionLabel>

      {smartDiffLoading ? (
        <div className={styles.loading} aria-busy="true" aria-label={t("smartDiff.loading")}>
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : effectiveOrder === "smart" && groups ? (
        <div className={styles.groups}>
          {groups.map(({ group, files: groupFiles }) => (
            <SmartDiffGroup
              key={group.role}
              group={group}
              files={groupFiles}
              commenting={commenting}
              findings={findingApi}
            />
          ))}
        </div>
      ) : (
        <DiffViewer files={files} commenting={commenting} findings={findingApi} />
      )}
    </section>
  );
}
