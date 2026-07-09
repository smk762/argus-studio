"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

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
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: (props: ComponentPropsWithoutRef<"strong">) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          ul: (props: ComponentPropsWithoutRef<"ul">) => (
            <ul className="ml-4 list-disc space-y-1 marker:text-muted" {...props} />
          ),
          ol: (props: ComponentPropsWithoutRef<"ol">) => (
            <ol className="ml-4 list-decimal space-y-1 marker:text-muted" {...props} />
          ),
          code: (props: ComponentPropsWithoutRef<"code">) => (
            <code
              className="rounded bg-background px-1 py-0.5 font-mono text-[0.75rem] text-accent-teal/90"
              {...props}
            />
          ),
          a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
            const isInternal = href.startsWith("/") || href.startsWith("#");
            const className =
              "text-accent-purple underline decoration-dotted underline-offset-2 hover:text-accent-purple/80";
            return isInternal ? (
              <Link href={href} className={className} {...props} />
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props} />
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
