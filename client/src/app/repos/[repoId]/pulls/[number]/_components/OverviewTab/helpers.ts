/** Helpers for the PR Overview tab. The storage is passed in, so these stay testable without a browser. */
import { OVERVIEW_SCROLL_KEY_PREFIX } from "./constants";

/** What is saved before a focus navigation: the scroll offset, and whether the user came back with Back. */
interface SavedScroll {
  y: number;
  back: boolean;
}

export function overviewScrollKey(prId: string): string {
  return `${OVERVIEW_SCROLL_KEY_PREFIX}${prId}`;
}

function read(storage: Storage | null, prId: string): SavedScroll | null {
  const raw = storage?.getItem(overviewScrollKey(prId)) ?? null;
  if (raw == null) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedScroll>;
    return typeof v.y === "number" && Number.isFinite(v.y) && v.y >= 0 ? { y: v.y, back: v.back === true } : null;
  } catch {
    return null;
  }
}

/** Remember the Overview scroll position before navigating to Files changed (D-32). Not yet a Back. */
export function saveOverviewScroll(storage: Storage | null, prId: string, y: number): void {
  try {
    storage?.setItem(overviewScrollKey(prId), JSON.stringify({ y: Math.round(y), back: false }));
  } catch {
    /* storage full or disabled: Back still works, at the top of the page */
  }
}

/** The browser went Back (popstate) after the save: the next Overview mount may restore (R-77). */
export function markOverviewBack(storage: Storage | null, prId: string): void {
  try {
    const saved = read(storage, prId);
    if (saved) storage?.setItem(overviewScrollKey(prId), JSON.stringify({ ...saved, back: true }));
  } catch {
    /* nothing to mark */
  }
}

/**
 * Read and forget the saved position. Returns it only when the Overview was
 * reached with Back; a plain tab click forgets it without scrolling (F-14).
 */
export function takeOverviewScroll(storage: Storage | null, prId: string): number | null {
  try {
    const saved = read(storage, prId);
    storage?.removeItem(overviewScrollKey(prId));
    return saved?.back ? saved.y : null;
  } catch {
    return null;
  }
}

/** `window.sessionStorage`, or null where it does not exist or throws on access. */
export function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The pending Back listeners, at most one per PR (F-22). A listener lives on
 * `window` because it must outlive the unmounted Overview; it is replaced by
 * the next activation, removes itself when it fires, and is removed when the
 * Overview mounts again and consumes or forgets the saved position.
 */
const backListeners = new Map<string, () => void>();

/** Arm the one Back listener of this PR: the next `popstate` marks the saved position restorable. */
export function armOverviewBack(prId: string): void {
  disarmOverviewBack(prId);
  const onPop = () => {
    backListeners.delete(prId);
    markOverviewBack(sessionStore(), prId);
  };
  backListeners.set(prId, onPop);
  window.addEventListener("popstate", onPop, { once: true });
}

/** Remove this PR's pending Back listener, if any. */
export function disarmOverviewBack(prId: string): void {
  const onPop = backListeners.get(prId);
  if (!onPop) return;
  backListeners.delete(prId);
  if (typeof window !== "undefined") window.removeEventListener("popstate", onPop);
}
