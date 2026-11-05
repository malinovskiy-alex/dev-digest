/* perf-range.ts — the applied range of the Agent Performance dashboard and the
   agent Stats tab (L08), as pure functions over the page address.

   Address shape (D-7): `range=1d|30d|custom`, `start`/`end` as `YYYY-MM-DD`
   (custom only), `at` as an ISO instant (a preset's pinned end, written only by
   a dashboard View link, D-8). Anything unrecognised falls back to "30 days"
   without an error (R-33, R-39).

   Presets are rolling windows ending at the moment they are applied (R-34); a
   custom range is whole local days, from 00:00 of the start date to 00:00 of
   the day after the end date, in the browser's time zone (R-35). */

/** A preset choice: the 24 hours or the 30 × 24 hours ending at `at` or at the apply moment. */
export type PerfPreset = "1d" | "30d";

export type PerfRangeChoice =
  | { kind: "preset"; preset: PerfPreset; /** pinned end (ISO), from a View link only */ at: string | null }
  | { kind: "custom"; /** YYYY-MM-DD */ start: string; /** YYYY-MM-DD */ end: string };

/** The instants a choice resolves to: start-inclusive, end-exclusive. */
export interface PerfRange {
  from: Date;
  to: Date;
}

export type PerfBucketUnit = "hour" | "day";

/**
 * Why a custom range cannot be applied (R-36, R-37). `missing` = a date input is
 * empty or malformed; `tooEarly` = the range or its previous window would start
 * before 1970-01-01T00:00Z (F-08).
 */
export type CustomRangeError = "missing" | "endBeforeStart" | "future" | "tooEarly";

export const RANGE_PARAM = "range";
export const START_PARAM = "start";
export const END_PARAM = "end";
export const AT_PARAM = "at";
/** Every address key this range owns — `apply` rewrites exactly these. */
export const RANGE_PARAM_KEYS = [RANGE_PARAM, START_PARAM, END_PARAM, AT_PARAM] as const;

/** Length of each preset in hours (R-34). */
export const PRESET_HOURS: Record<PerfPreset, number> = { "1d": 24, "30d": 720 };

/** The choice used when the address carries none, or an invalid one (R-33, R-39). */
export const DEFAULT_CHOICE: PerfRangeChoice = { kind: "preset", preset: "30d", at: null };

const HOUR_MS = 3_600_000;

/**
 * No window — the applied range nor its previous window of equal length — may
 * start before this instant (F-08). The server contract enforces the same bound
 * (422); the client keeps such a range from ever being requested.
 */
export const EARLIEST_MS = Date.UTC(1970, 0, 1);
/** The date inputs' lower bound. A start this early can still fail on its previous window. */
export const MIN_DATE = "1970-01-01";

/** True when the range's previous window `[from − (to − from), from)` starts at or after EARLIEST_MS. */
export function previousWindowInBounds(range: PerfRange): boolean {
  const from = range.from.getTime();
  return from - (range.to.getTime() - from) >= EARLIEST_MS;
}
const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Read-only view of URLSearchParams — `useSearchParams()` satisfies it. */
export interface ParamReader {
  get(name: string): string | null;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` of a local calendar date. */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local 00:00 of a `YYYY-MM-DD` date, or null when the string is not a real calendar date. */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = DATE_SHAPE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  // Reject roll-overs such as 2026-02-31 → March 3.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayLocal(now: Date): string {
  return localDateKey(now);
}

/** Validate a custom range against today (R-36, R-37). `null` = valid. */
export function validateCustom(start: string, end: string, today: string): CustomRangeError | null {
  if (!parseLocalDate(start) || !parseLocalDate(end)) return "missing";
  // `YYYY-MM-DD` strings order lexicographically like the dates they name.
  if (end < start) return "endBeforeStart";
  if (start > today || end > today) return "future";
  if (!previousWindowInBounds(customRange(start, end)!)) return "tooEarly";
  return null;
}

/** Local midnight of `start` to local midnight after `end` (R-35); null when a date is invalid. */
function customRange(start: string, end: string): PerfRange | null {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!s || !e) return null;
  return { from: s, to: new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1) };
}

/** The choice the page address describes; invalid or missing → 30 days, no error (R-33, R-39). */
export function parseRangeParams(sp: ParamReader, now: Date): PerfRangeChoice {
  const range = sp.get(RANGE_PARAM);
  if (range === "1d" || range === "30d") {
    const at = sp.get(AT_PARAM);
    if (at == null) return { kind: "preset", preset: range, at: null };
    const t = Date.parse(at);
    if (Number.isNaN(t) || t > now.getTime()) return DEFAULT_CHOICE;
    const hours = PRESET_HOURS[range] * HOUR_MS;
    if (!previousWindowInBounds({ from: new Date(t - hours), to: new Date(t) })) return DEFAULT_CHOICE;
    return { kind: "preset", preset: range, at: new Date(t).toISOString() };
  }
  if (range === "custom") {
    const start = sp.get(START_PARAM) ?? "";
    const end = sp.get(END_PARAM) ?? "";
    if (validateCustom(start, end, todayLocal(now)) !== null) return DEFAULT_CHOICE;
    return { kind: "custom", start, end };
  }
  return DEFAULT_CHOICE;
}

/**
 * The instants a choice covers. A preset ends at its pinned `at`, else at `end`
 * (the apply moment, D-8); a custom range runs from local midnight of the start
 * date to local midnight after the end date (R-35) — 23 or 25 hours on a DST day.
 */
export function resolveRange(choice: PerfRangeChoice, end: Date): PerfRange {
  if (choice.kind === "preset") {
    const to = choice.at ? new Date(choice.at) : new Date(end.getTime());
    return { from: new Date(to.getTime() - PRESET_HOURS[choice.preset] * HOUR_MS), to };
  }
  // parseRangeParams only ever yields a valid custom choice; fall back defensively.
  const today = todayLocal(end);
  return customRange(choice.start, choice.end) ?? customRange(today, today)!;
}

/** A choice's identity in the address — two choices with the same key are the same range rule. */
export function choiceKey(choice: PerfRangeChoice): string {
  return new URLSearchParams(rangeToParams(choice)).toString();
}

/** The address entries a choice writes (the `RANGE_PARAM_KEYS` it does not name are dropped). */
export function rangeToParams(choice: PerfRangeChoice): Record<string, string> {
  if (choice.kind === "custom") {
    return { [RANGE_PARAM]: "custom", [START_PARAM]: choice.start, [END_PARAM]: choice.end };
  }
  return choice.at
    ? { [RANGE_PARAM]: choice.preset, [AT_PARAM]: choice.at }
    : { [RANGE_PARAM]: choice.preset };
}

/**
 * The agent Stats tab with the same applied range (R-56). A preset pins its end
 * (`at = range.to`) because the window is rolling; a custom range carries its dates.
 */
export function statsHref(agentId: string, choice: PerfRangeChoice, range: PerfRange): string {
  const sp = new URLSearchParams({ tab: "stats" });
  const pinned: PerfRangeChoice =
    choice.kind === "preset" ? { kind: "preset", preset: choice.preset, at: range.to.toISOString() } : choice;
  for (const [k, v] of Object.entries(rangeToParams(pinned))) sp.set(k, v);
  return `/agents/${encodeURIComponent(agentId)}?${sp.toString()}`;
}

/** The browser's IANA time zone (Q-10, D-19); UTC when the runtime cannot say. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Sparkline grain (R-90, D-18): per hour only for the "1 day" preset — a custom single day stays per day. */
export function bucketFor(choice: PerfRangeChoice): PerfBucketUnit {
  return choice.kind === "preset" && choice.preset === "1d" ? "hour" : "day";
}

/** Walk step: a local day is never shorter than 23 h, so a 12 h step visits every day; hours are walked hour by hour. */
const WALK_STEP_MS: Record<PerfBucketUnit, number> = { hour: HOUR_MS, day: 12 * HOUR_MS };

/** Builds the server's bucket keys (`YYYY-MM-DD` / `YYYY-MM-DDTHH`) for an instant in `tz`. */
function bucketKeyer(unit: PerfBucketUnit, tz: string): (d: Date) => string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  return (d) => {
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(d)) parts[p.type] = p.value;
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    return unit === "day" ? day : `${day}T${parts.hour}`;
  };
}

/**
 * One sparkline point per local day (or hour) of `tz` that the range touches,
 * oldest first — from the bucket of `from` to the bucket of `to − 1 ms`,
 * inclusive (D-18). A bucket the server did not send is 0, so the points add up
 * to the runs of the buckets given (R-91). A repeated local hour (DST fall-back)
 * is one point; a skipped one (spring-forward) has none.
 */
export function fillBuckets(
  range: PerfRange,
  unit: PerfBucketUnit,
  buckets: readonly { key: string; runs: number }[],
  tz: string,
): number[] {
  const last = range.to.getTime() - 1;
  if (last < range.from.getTime()) return [];
  const keyOf = bucketKeyer(unit, tz);
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    if (seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };
  for (let t = range.from.getTime(); t <= last; t += WALK_STEP_MS[unit]) push(keyOf(new Date(t)));
  push(keyOf(new Date(last)));
  const runs = new Map(buckets.map((b) => [b.key, b.runs]));
  return keys.map((k) => runs.get(k) ?? 0);
}
