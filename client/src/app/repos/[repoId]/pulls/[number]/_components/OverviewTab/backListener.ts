/* backListener — the Overview's pending Back listeners, at most one per PR
   (F-22). Kept out of helpers.ts because it holds module state and touches
   `window` (F-30). A listener lives on `window` because it must outlive the
   unmounted Overview; it is replaced by the next activation, removes itself
   when it fires, and is removed when the Overview mounts again and consumes
   or forgets the saved position. */
import { markOverviewBack, sessionStore } from "./helpers";

/** PR id → its pending `popstate` listener. */
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
