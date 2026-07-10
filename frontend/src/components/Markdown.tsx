"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

// Studio-tokened renderers for the small subset of markdown our concept bodies
// use. We render only the props we need (children, and href for links) rather
// than spreading react-markdown's props: with `passNode` on, react-markdown
// injects a hast `node` object into every override, and spreading it would emit
// an invalid `node` attribute on the DOM element.
const LINK_CLASS =
  "text-accent-purple underline decoration-dotted underline-offset-2 hover:text-accent-purple/80 transition-colors";

const MARKDOWN_COMPONENTS: Components = {
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 marker:text-muted">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1 marker:text-muted">{children}</ol>,
  code: ({ children }) => (
    <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.75rem] text-accent-teal/90">
      {children}
    </code>
  ),
  a: ({ href = "", children }) => {
    const isInternal = href.startsWith("/") || href.startsWith("#");
    return isInternal ? (
      <Link href={href} className={LINK_CLASS}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    );
  },
};

/**
 * Renders a markdown string with the Studio design tokens, without
 * `dangerouslySetInnerHTML`. Shared by the in-tool micro-docs (ParamInfo) and
 * the `/docs` handbook so a concept's `body` looks identical in both places.
 *
 * `tone` trims the type scale for compact in-tool panels vs. full doc pages.
 */
export function Markdown({
  children,
  tone = "compact",
}: {
  children: string;
  tone?: "compact" | "prose";
}) {
  const text = tone === "prose" ? "text-sm" : "text-xs";
  return (
    <div className={`${text} leading-relaxed text-foreground/80 space-y-2`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
