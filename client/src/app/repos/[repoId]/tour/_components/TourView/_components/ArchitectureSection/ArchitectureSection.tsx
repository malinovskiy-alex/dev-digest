/* ArchitectureSection — the model's prose (rendered as untrusted markdown:
   no raw HTML, no images, and every link inert — web links included, F-29 —
   AC-62) and the diagram when
   at least two grounded components and one connection survived (AC-85).
   Without prose (a skeleton) it lists the stack and the top-level folders
   (AC-34). Inline code in the prose is an accent mono chip (design D-9). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { TourArchitecture } from "@devdigest/shared";
import { UntrustedMarkdown } from "@/components/untrusted-markdown";
import { ArchitectureDiagram } from "../ArchitectureDiagram";
import { cx } from "./styles";

export function ArchitectureSection({ architecture }: { architecture: TourArchitecture }): React.JSX.Element {
  const t = useTranslations("onboarding");
  const a = architecture;

  if (a.prose) {
    return (
      <>
        <div className={cx.prose}>
          <UntrustedMarkdown inertLinks>{a.prose}</UntrustedMarkdown>
        </div>
        {a.components.length >= 2 && a.connections.length >= 1 && (
          <ArchitectureDiagram components={a.components} connections={a.connections} />
        )}
      </>
    );
  }

  if (a.gap === "needs_clone") return <p className={cx.gap}>{t("gaps.needsClone")}</p>;

  const none = t("stack.none");
  return (
    <>
      {a.gap === "needs_index" && <p className={cx.gap}>{t("gaps.needsIndex")}</p>}
      <div className={cx.grid}>
        <div className={cx.group}>
          <h3 className={cx.groupTitle}>{t("stack.title")}</h3>
          <ul className={cx.list}>
            <li>
              {t("stack.languages", {
                list:
                  a.stack.languages.length > 0
                    ? a.stack.languages
                        .map((l) => t("stack.languageCount", { name: l.name, files: l.files }))
                        .join(", ")
                    : none,
              })}
            </li>
            <li>{t("stack.frameworks", { list: a.stack.frameworks.join(", ") || none })}</li>
            <li>{t("stack.runtime", { list: a.stack.runtime.join(", ") || none })}</li>
          </ul>
        </div>
        {a.folders.length > 0 && (
          <div className={cx.group}>
            <h3 className={cx.groupTitle}>{t("stack.folders")}</h3>
            <ul className={cx.list}>
              {a.folders.map((f) => (
                <li key={f.path} className={cx.mono}>
                  {t("stack.folderCount", { path: f.path, files: f.files })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
