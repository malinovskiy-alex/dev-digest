"use client";

/**
 * Route-level error boundary for every screen under app/.
 *
 * Without this file the App Router renders its own unstyled error page, which
 * is a real possibility here: the API is a separate process on :3001 that can
 * simply be down. `api.ts` already turns that into a readable ApiError — this
 * is what puts it on screen, with a retry that re-runs the failed render
 * rather than forcing a reload.
 *
 * Note this catches render-time throws only. Errors inside event handlers and
 * inside TanStack Query are handled where they happen: the pages branch on
 * `isError` and render ErrorState themselves.
 */

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";
import { ApiError } from "@/lib/api";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // Server Components strip the message in production and leave `digest` as
    // the only way to correlate with the server log, so log both.
    console.error("[route error]", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <ErrorState
      fullScreen
      title={t("errorBoundary.title")}
      body={error instanceof ApiError ? error.message : t("errorBoundary.body")}
      onRetry={reset}
    />
  );
}
