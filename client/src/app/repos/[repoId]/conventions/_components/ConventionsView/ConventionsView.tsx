/* /repos/:repoId/conventions — the Conventions extractor (L02).

   Scan the cloned repo, read what it found, keep what is true, and turn the
   survivors into one reusable Skill. Every card's evidence was verified against
   the repo on the server before it got here, so the only judgement left on this
   screen is "is this rule real?" — which is the one a human is good at. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useActiveRepo } from "@/lib/repo-context";
import {
  useConventions,
  useExtractConventions,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { ConventionCard } from "./_components/ConventionCard";
import { CreateSkillFromConventionsModal } from "./_components/CreateSkillFromConventionsModal";
import { SKELETON_COUNT, SKELETON_HEIGHT } from "./constants";
import { acceptedCount, scanAge } from "./helpers";
import { s } from "./styles";

export function ConventionsView(): React.JSX.Element {
  const t = useTranslations("conventions");
  const toast = useToast();
  const router = useRouter();
  const params = useParams<{ repoId: string }>();
  const { repos } = useActiveRepo();

  // The route owns the id; `useActiveRepo` only supplies the display name. The
  // sidebar's href is `:repoId`-templated and resolves to "_" when no repo is
  // selected, which is why an unresolved id has to render the empty state below
  // rather than fetching against a placeholder.
  const routeRepoId = params?.repoId;
  const repoId = routeRepoId && routeRepoId !== "_" ? routeRepoId : null;
  const repoName = repos.find((r) => r.id === repoId)?.full_name ?? t("page.repoFallback");

  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const [creating, setCreating] = React.useState(false);

  const candidates = data?.candidates ?? [];
  const accepted = acceptedCount(candidates);
  const scanned = !!data?.scan;

  const runScan = async () => {
    try {
      await extract.mutateAsync();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("page.extractionFailed"));
    }
  };

  const setStatus = async (id: string, status: "accepted" | "rejected") => {
    try {
      await update.mutateAsync({ id, patch: { status } });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("card.updateFailed"));
    }
  };

  /**
   * One request per card. A bulk endpoint would be fewer round-trips, but this
   * button is pressed once on a list of a dozen — and keeping it on the same
   * `PATCH` the individual buttons use means there is one way a status ever
   * changes, and one place it can go wrong.
   */
  const setAll = async (status: "accepted" | "rejected") => {
    const targets = candidates.filter((c) => c.status !== status);
    try {
      for (const c of targets) {
        await update.mutateAsync({ id: c.id, patch: { status } });
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("card.updateFailed"));
    }
  };

  const openSkill = (skill: Skill) => router.push(`/skills/${skill.id}?tab=config`);

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      {creating && repoId && (
        <CreateSkillFromConventionsModal
          repoId={repoId}
          repoName={repoName}
          onClose={() => setCreating(false)}
          onCreated={openSkill}
        />
      )}

      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span className="mono" style={s.repoName}>
                {repoName}
              </span>
            </h1>
            {scanned ? (
              <p style={s.scanMeta}>
                {t("page.scanMeta", {
                  count: data!.scan!.sample_count,
                  when: scanAge(data!.scan!.created_at),
                })}
              </p>
            ) : (
              <p style={s.subtitle}>{t("page.subtitle")}</p>
            )}
          </div>
          {repoId && (
            <Button
              kind="secondary"
              icon="RefreshCw"
              loading={extract.isPending}
              onClick={runScan}
            >
              {extract.isPending
                ? t("page.scanning")
                : scanned
                  ? t("page.rescan")
                  : t("page.runExtraction")}
            </Button>
          )}
        </div>

        {!repoId && <EmptyState icon="ListChecks" title={t("page.noRepo")} />}

        {repoId && isLoading && (
          <div style={s.list} role="status" aria-busy="true">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton key={i} height={SKELETON_HEIGHT} />
            ))}
          </div>
        )}

        {repoId && isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}

        {repoId && !isLoading && !isError && candidates.length === 0 && (
          // "Scanned and found nothing" and "never scanned" are different
          // answers: the first one means the evidence gate dropped everything,
          // and saying "no conventions yet" there would blame the repo for what
          // was really a bad model answer.
          <EmptyState
            icon="ListChecks"
            title={scanned ? t("page.emptyAfterScan.title") : t("page.empty.title")}
            body={scanned ? t("page.emptyAfterScan.body") : t("page.empty.body")}
            cta={scanned ? t("page.emptyAfterScan.cta") : t("page.empty.cta")}
            onCta={runScan}
            ctaLoading={extract.isPending}
          />
        )}

        {repoId && candidates.length > 0 && (
          <>
            <div style={s.toolbar}>
              <Button
                kind="ghost"
                size="sm"
                icon={accepted > 0 ? "X" : "Check"}
                disabled={update.isPending}
                onClick={() => setAll(accepted > 0 ? "rejected" : "accepted")}
              >
                {accepted > 0 ? t("page.deselectAll") : t("page.selectAll")}
              </Button>
              <span style={s.toolbarCount}>
                {t("page.acceptedOf", { accepted, total: candidates.length })}
              </span>
              <Button
                kind="primary"
                icon="Sparkles"
                disabled={accepted === 0}
                onClick={() => setCreating(true)}
              >
                {t("page.createSkill")}
              </Button>
            </div>

            <div style={s.list}>
              {candidates.map((c) => (
                <ConventionCard
                  key={c.id}
                  candidate={c}
                  busy={update.isPending}
                  onStatusChange={(status) => setStatus(c.id, status)}
                  onEdit={(patch) =>
                    update
                      .mutateAsync({ id: c.id, patch })
                      .catch((e) =>
                        toast.error(
                          e instanceof ApiError ? e.message : t("card.updateFailed"),
                        ),
                      )
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
