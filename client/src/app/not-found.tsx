"use client";

/**
 * Shown for any unmatched URL, and by an explicit `notFound()` call.
 *
 * A client component because ErrorState's retry/action affordances are
 * interactive; there is no data to fetch here, so nothing is lost by it.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <ErrorState
      fullScreen
      title={t("notFound.title")}
      body={
        <>
          {t("notFound.body")}{" "}
          {/* "/" is the only safe destination: it redirects to the first
              repo's PR list, or to onboarding when there are no repos.
              There is no /repos route — that mistake is what this page
              was showing when it was first opened in the browser. */}
          <Link href="/">{t("notFound.home")}</Link>
        </>
      }
    />
  );
}
