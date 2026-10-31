/** True for an absolute web link (`http:` / `https:`). Everything else is not followed. */
export function isExternalHref(href: string | undefined | null): href is string {
  if (!href) return false;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    // relative (`./other.md`, `#anchor`, `/abs`) — not a URL on its own
    return false;
  }
}
