/* ImportEntryTable — every entry the archive declared, and what happened to it.
   Only the `core` entry is ever decompressed; an `executable` entry contributes
   its central-directory name and size and nothing else. That is a fact about
   the parser, and this table is where a reader can check it — so it is never
   collapsed by default. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { SkillImportEntry } from "@devdigest/shared";
import { formatBytes } from "../../helpers";
import { s } from "./styles";

export function ImportEntryTable({ entries }: { entries: SkillImportEntry[] }): React.JSX.Element {
  const t = useTranslations("skills");

  return (
    <table style={s.table}>
      <caption style={s.caption}>{t("import.entries.heading")}</caption>
      <thead>
        <tr>
          <th scope="col" style={s.th}>
            {t("import.entries.path")}
          </th>
          <th scope="col" style={s.thNumeric}>
            {t("import.entries.size")}
          </th>
          <th scope="col" style={s.th}>
            {t("import.entries.kind")}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const executable = entry.kind === "executable";
          return (
            <tr key={entry.path} style={s.row(entry.ignored)}>
              <td style={s.td}>
                <span style={s.path}>
                  {executable && <Icon.Lock size={12} style={s.lock} />}
                  <span className="mono">{entry.path}</span>
                </span>
              </td>
              <td style={s.tdNumeric} className="tnum">
                {formatBytes(entry.bytes)}
              </td>
              <td style={s.td}>
                <span style={s.kindCell}>
                  <span>{t(`import.entries.${entry.kind}`)}</span>
                  {entry.ignored && (
                    <span style={s.notProcessed}>{t("import.entries.notProcessed")}</span>
                  )}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
