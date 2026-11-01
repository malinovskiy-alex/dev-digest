/* FirstTasksSection — 3-5 starter tasks, each with a title, a one-line reason,
   a kind tag and a link to the file at its line or to the PR (AC-54, AC-57).
   Each task is an inner card like a critical-path row: kind tag and title,
   the reason on the second line, an outlined "Open" at the right (design
   D-15). Repo and model text renders as plain text only. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { TourTasks } from "@devdigest/shared";
import { taskHref, taskReason, taskTitle, type Msg } from "./helpers";
import { cx } from "./styles";

export function FirstTasksSection({
  list,
  repoFullName,
  revision,
}: {
  list: TourTasks;
  repoFullName: string;
  revision: string | null;
}): React.JSX.Element {
  const t = useTranslations("onboarding");
  const say = (m: { text: string } | Msg): string =>
    "text" in m ? m.text : t(m.key, m.values);

  if (list.tasks.length === 0) {
    return <p className={cx.gap}>{list.gap === "needs_clone" ? t("gaps.needsClone") : t("gaps.noCandidates")}</p>;
  }
  return (
    <ul className={cx.list}>
      {list.tasks.map((task) => {
        const title = say(taskTitle(task));
        const reason = taskReason(task);
        const href = taskHref(task, repoFullName, revision);
        return (
          <li key={task.candidate_id} className={cx.task}>
            <div className={cx.body}>
              <div className={cx.head}>
                <Badge>{t(`tasks.kind.${task.kind}`)}</Badge>
                <span className={cx.title}>{title}</span>
              </div>
              {reason && <p className={cx.reason}>{say(reason)}</p>}
            </div>
            {href && (
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t("tasks.openTask", { title })} className={cx.link}>
                {t("openShort")}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
