/* UntrustedMarkdown — renders a repository's own markdown (Project Context
   documents), which is untrusted input.

   What it adds over the `@devdigest/ui` Markdown primitive:
   - no remote fetch on open: an image is shown as a placeholder with its alt
     text and, for a web URL, a link the user may choose to follow. Rendering
     `<img src>` would let any document beacon the reader's IP and open time;
   - links do not navigate the studio: a web link opens in a new tab with
     `noopener noreferrer nofollow`; a relative link (`./other.md`, `#x`) is
     repo-relative, would 404 inside the studio, and is shown as inert text.
   Like the primitive, it renders no raw HTML (react-markdown without
   rehype-raw) and drops `javascript:` URLs (the default urlTransform). */
"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { isExternalHref } from "./helpers";
import { cx } from "./styles";

export function UntrustedMarkdown({ children }: { children?: string | null }): React.JSX.Element | null {
  const t = useTranslations("context");
  if (!children) return null;

  const components: Components = {
    p: ({ children }) => <p className={cx.p}>{children}</p>,
    strong: ({ children }) => <strong className={cx.strong}>{children}</strong>,
    code: ({ children }) => <code className={cx.code}>{children}</code>,
    a: ({ children, href }) =>
      isExternalHref(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={cx.link}>
          {children}
        </a>
      ) : (
        <span className={cx.inertLink} title={href ?? undefined}>
          {children}
        </span>
      ),
    img: ({ src, alt }) => {
      const label = alt ? t("markdown.image", { alt }) : t("markdown.imageNoAlt");
      const source = typeof src === "string" ? src : undefined;
      return isExternalHref(source) ? (
        <a href={source} target="_blank" rel="noopener noreferrer nofollow" className={cx.image}>
          <Icon.File size={12} aria-hidden="true" />
          {label}
        </a>
      ) : (
        <span className={cx.image} title={source}>
          <Icon.File size={12} aria-hidden="true" />
          {label}
        </span>
      );
    },
  };

  return (
    <div className={cx.root}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
