/* /repos/:repoId/tour — Onboarding Tour (L05).

   A guided tour of the repository in five sections: architecture, critical
   paths, run locally, reading path and first tasks. Opening the page never
   calls a model (AC-25): the server returns the stored tour, or a skeleton
   built from the clone and the index. "Generate tour" / "Regenerate" starts one
   generation, and the query polls until it ends.

   States, in order: no such repo → RepoNotFound, loading → section skeletons,
   error → ErrorState with Retry, data → header + "On this page" + the five
   sections, whatever the status (AC-07). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { ApiError } from "@/lib/api";
import { useGenerateTour, useTour } from "@/lib/hooks/onboarding";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ArchitectureSection } from "./_components/ArchitectureSection";
import { CriticalPathsSection } from "./_components/CriticalPathsSection";
import { FirstTasksSection } from "./_components/FirstTasksSection";
import { OnThisPage } from "./_components/OnThisPage";
import { ReadingPathSection } from "./_components/ReadingPathSection";
import { RunLocallySection } from "./_components/RunLocallySection";
import { TourHeader } from "./_components/TourHeader";
import { TourSection } from "./_components/TourSection";
import { SECTION_ORDER, SKELETON_HEIGHT, type SectionKey } from "./constants";
import { isKnownIndexReason } from "./helpers";
import { cx } from "./styles";

export function TourView(): React.JSX.Element {
  const t = useTranslations("onboarding");
  const params = useParams<{ repoId: string }>();
  const { repos } = useActiveRepo();

  // The sidebar's `:repoId` href resolves to "_" when no repo is selected.
  const routeRepoId = params?.repoId ?? null;
  const repoId = routeRepoId && routeRepoId !== "_" ? routeRepoId : null;
  const repoNotFound = useRepoNotFound(routeRepoId);

  const query = useTour(repoId);
  const generate = useGenerateTour(repoId);
  const tour = query.data;

  const fullName = tour?.full_name ?? repos.find((r) => r.id === repoId)?.full_name ?? t("crumbRepoFallback");
  const crumb = [{ label: fullName, mono: true }, { label: t("title") }];
  const sections = SECTION_ORDER.map((s) => ({ id: s.id, title: t(s.titleKey) }));

  const notFound =
    repoNotFound || (query.error instanceof ApiError && query.error.status === 404);
  if (notFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  if (query.isError) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          title={t("loadError")}
          body={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      </AppShell>
    );
  }

  if (!tour) {
    return (
      <AppShell crumb={crumb}>
        <div className={cx.skeletons} aria-busy="true">
          <Skeleton height={28} width="40%" />
          {SECTION_ORDER.map((s) => (
            <Skeleton key={s.id} height={SKELETON_HEIGHT} />
          ))}
        </div>
      </AppShell>
    );
  }

  const reason = tour.index_reason;
  const indexReasonText = reason
    ? isKnownIndexReason(reason)
      ? t(`indexReason.${reason}` as "indexReason.no_data")
      : reason
    : null;

  const body: Record<SectionKey, React.ReactNode> = {
    architecture: <ArchitectureSection architecture={tour.sections.architecture} />,
    "critical-paths": (
      <CriticalPathsSection list={tour.sections.critical_paths} repoFullName={tour.full_name} revision={tour.revision} />
    ),
    "run-locally": <RunLocallySection list={tour.sections.run_locally} />,
    "reading-path": (
      <ReadingPathSection
        list={tour.sections.reading_path}
        repoFullName={tour.full_name}
        revision={tour.revision}
        indexReasonText={indexReasonText}
      />
    ),
    "first-tasks": (
      <FirstTasksSection list={tour.sections.first_tasks} repoFullName={tour.full_name} revision={tour.revision} />
    ),
  };

  return (
    <AppShell crumb={crumb}>
      <div className={cx.page}>
        <TourHeader
          tour={tour}
          indexReasonText={indexReasonText}
          generating={generate.isPending}
          onGenerate={() => generate.mutate()}
        />
        <div className={cx.layout}>
          <div className={cx.sections}>
            {SECTION_ORDER.map((s, i) => (
              <TourSection key={s.id} id={s.id} title={sections[i]!.title}>
                {body[s.key]}
              </TourSection>
            ))}
          </div>
          <aside className={cx.aside}>
            <OnThisPage items={sections} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
