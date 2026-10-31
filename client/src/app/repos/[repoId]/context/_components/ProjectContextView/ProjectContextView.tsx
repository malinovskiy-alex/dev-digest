/* /repos/:repoId/context — Project Context (L05).

   The cloned repo's markdown documents, read from git at the clone's current
   HEAD: a folder tree on the left, the selected document rendered on the
   right. Read-only by design (R-05) — documents are edited in the repo, and
   attached to agents and skills on their editors' Context tabs.

   States, in order: no such repo → RepoNotFound, loading → skeletons, error →
   ErrorState with Retry, not cloned → empty state, no documents → empty state. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { useContextDocs } from "@/lib/hooks/project-context";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { DocTree } from "./_components/DocTree";
import { DocViewer } from "./_components/DocViewer";
import { IndexedFooter } from "./_components/IndexedFooter";
import { PATH_PARAM, SKELETON_COUNT, SKELETON_HEIGHT } from "./constants";
import { buildTree, totalTokens } from "./helpers";
import { cx } from "./styles";

export function ProjectContextView(): React.JSX.Element {
  const t = useTranslations("context");
  const router = useRouter();
  const search = useSearchParams();
  const params = useParams<{ repoId: string }>();
  const { repos } = useActiveRepo();

  // The sidebar's `:repoId` href resolves to "_" when no repo is selected.
  const routeRepoId = params?.repoId ?? null;
  const repoId = routeRepoId && routeRepoId !== "_" ? routeRepoId : null;
  const repoNotFound = useRepoNotFound(routeRepoId);
  const repoName = repos.find((r) => r.id === repoId)?.full_name ?? t("page.crumbRepoFallback");

  const list = useContextDocs(repoId);
  const selectedPath = search.get(PATH_PARAM);

  const select = (path: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set(PATH_PARAM, path);
    router.replace(`/repos/${routeRepoId}/context?${sp.toString()}`);
  };

  const crumb = [{ label: repoName, mono: true }, { label: t("title") }];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  const data = list.data;
  const docs = data?.docs ?? [];
  const selectedDoc = docs.find((d) => d.path === selectedPath);

  return (
    <AppShell crumb={crumb}>
      <div className={cx.page}>
        <header className={cx.header}>
          <h1 className={cx.title}>{t("title")}</h1>
          <p className={cx.subtitle}>{t("page.subtitle")}</p>
        </header>

        {(list.isLoading || !repoId) && !list.isError && (
          <div className={cx.skeletons} aria-busy="true">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton key={i} height={SKELETON_HEIGHT} />
            ))}
          </div>
        )}

        {list.isError && (
          <ErrorState
            title={t("states.loadError")}
            body={list.error instanceof ApiError ? list.error.message : undefined}
            onRetry={() => void list.refetch()}
          />
        )}

        {data && !data.cloned && (
          <EmptyState icon="GitBranch" title={t("states.notCloned.title")} body={t("states.notCloned.body")} />
        )}

        {data && data.cloned && docs.length === 0 && (
          <EmptyState icon="FileText" title={t("states.empty.title")} body={t("states.empty.body")} />
        )}

        {data && data.cloned && docs.length > 0 && repoId && (
          <div className={cx.layout}>
            <section className={cx.treePanel} aria-label={t("page.documents")}>
              <div className={cx.treeHeader}>{t("page.documents")}</div>
              {data.capped && (
                <p className={cx.capped} role="status">
                  {t("listCapped", {
                    shown: docs.length.toLocaleString(),
                    total: data.total.toLocaleString(),
                  })}
                </p>
              )}
              <div className={cx.treeScroll}>
                <DocTree nodes={buildTree(docs)} selectedPath={selectedPath} onSelect={select} />
              </div>
              <IndexedFooter
                files={docs.length}
                tokens={totalTokens(docs)}
                listedAt={data.listed_at}
                refreshing={list.isFetching}
                onRefresh={() => void list.refetch()}
              />
            </section>

            <section className={cx.viewerPanel}>
              {selectedPath ? (
                <DocViewer
                  key={selectedPath}
                  repoId={repoId}
                  path={selectedPath}
                  doc={selectedDoc}
                  onRefreshList={() => void list.refetch()}
                />
              ) : (
                <p className={cx.selectPrompt}>{t("page.selectPrompt")}</p>
              )}
              <p className={cx.selectPrompt}>{t("page.readOnly")}</p>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
