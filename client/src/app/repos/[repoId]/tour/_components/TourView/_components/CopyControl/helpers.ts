/** Pure-ish helper for the copy control: the only browser API it touches. */

/**
 * Write `text` to the clipboard. `true` on success, `false` when the Clipboard
 * API is absent (outside a secure context, R-8) or rejects (AC-77).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
