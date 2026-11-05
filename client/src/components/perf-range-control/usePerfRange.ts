/* usePerfRange — the applied range of the Agent Performance dashboard and the
   agent Stats tab, kept in the page address (R-38, R-84, D-7).

   The applied moment of a preset is the page load, then every `apply`
   (D-8, R-34). `apply` rewrites only the range keys, keeping the path
   and every other key (`tab` on the Stats tab), so a reload or a shared link
   shows the same range. */
"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  RANGE_PARAM_KEYS,
  choiceKey,
  parseLocalDate,
  parseRangeParams,
  rangeToParams,
  resolveRange,
  type PerfRange,
  type PerfRangeChoice,
} from "@/lib/perf-range";
import { PRESET_LABEL_KEYS, RANGE_DATE_FORMAT } from "./constants";

/**
 * When each range rule was applied. `apply` sets the state at once, but the
 * address only changes in the router's later transition, so a render can see the
 * NEW state with an OLD address — after several fast applies, more than one old
 * address (F-02, F-14). Every apply time is therefore stored under the key of the
 * choice it belongs to, and a render resolves whatever address it sees at that
 * address's own time: an old address keeps its old query key, so only the choice
 * actually applied is ever read. Bounded: older keys are dropped first.
 */
const MAX_REMEMBERED = 8;
type AppliedTimes = ReadonlyMap<string, Date>;

/** A copy of `times` with `key` set to `at` as the newest entry, trimmed to MAX_REMEMBERED. */
function remember(times: AppliedTimes, key: string, at: Date): AppliedTimes {
  const next = new Map(times);
  next.delete(key);
  next.set(key, at);
  while (next.size > MAX_REMEMBERED) next.delete(next.keys().next().value!);
  return next;
}

/** The newest stored time, or `fallback` when nothing was applied yet. */
function latest(times: AppliedTimes, fallback: Date): Date {
  let last = fallback;
  for (const at of times.values()) last = at;
  return last;
}

export function usePerfRange(): {
  choice: PerfRangeChoice;
  range: PerfRange;
  apply: (next: PerfRangeChoice) => void;
} {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // The mount time stands for the first apply (D-8); lazily, so it is read once.
  const [mountedAt] = React.useState(() => new Date());
  const [times, setTimes] = React.useState<AppliedTimes>(() => new Map());

  const newest = latest(times, mountedAt);
  const choice = parseRangeParams(search, newest);
  const key = choiceKey(choice);
  // A key never applied here (first render, back/forward) takes the newest moment.
  const appliedAt = times.get(key) ?? newest;
  const range = resolveRange(choice, appliedAt);

  const apply = (next: PerfRangeChoice) => {
    const sp = new URLSearchParams(search.toString());
    for (const k of RANGE_PARAM_KEYS) sp.delete(k);
    for (const [k, v] of Object.entries(rangeToParams(next))) sp.set(k, v);
    const now = new Date();
    // Pin the address being shown to the time it is shown at, then add the new choice.
    setTimes((prev) => remember(prev.has(key) ? prev : remember(prev, key, appliedAt), choiceKey(next), now));
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return { choice, range, apply };
}

export interface RangeLabels {
  /** "(1D)", "(30D)", "(<start> – <end>)" — card titles and the Runs header (R-40). */
  short: string;
  /** "the last day", "the last 30 days", "<start> – <end>" — empty-state sentences (D-9). */
  sentence: string;
}

/** The applied range's labels (R-40, D-9). */
export function useRangeLabels(choice: PerfRangeChoice): RangeLabels {
  const t = useTranslations("agentPerformance");
  const format = useFormatter();
  if (choice.kind === "preset") {
    const keys = PRESET_LABEL_KEYS[choice.preset];
    return { short: t(keys.short), sentence: t(keys.sentence) };
  }
  const fmt = (s: string) => {
    const d = parseLocalDate(s);
    return d ? format.dateTime(d, RANGE_DATE_FORMAT) : s;
  };
  const values = { start: fmt(choice.start), end: fmt(choice.end) };
  return { short: t("range.short.custom", values), sentence: t("range.sentence.custom", values) };
}
