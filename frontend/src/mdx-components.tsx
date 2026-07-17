import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { nodeText, slugify } from "@/lib/slug";

/**
 * Maps the markdown primitives emitted by MDX onto the Studio design tokens
 * (see globals.css) so docs pages match the rest of the site without per-page
 * styling. Any component imported inside an `.mdx` file (live widgets, etc.)
 * renders as-is; this only themes the plain prose.
 *
 * Internal links go through next/link so docs<->tools navigation is client-side.
 * `h2`/`h3` get a slug `id` (from their text) so the on-page TOC and `#anchor`
 * links resolve; a caller-supplied `id` still wins.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props: ComponentPropsWithoutRef<"h1">) => (
      <h1 className="text-2xl font-semibold text-foreground mt-2 mb-4" {...props} />
    ),
    h2: ({ id, children, ...props }: ComponentPropsWithoutRef<"h2">) => (
      <h2
        id={id ?? slugify(nodeText(children))}
        className="text-xl font-semibold text-foreground mt-10 mb-3 scroll-mt-24"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ id, children, ...props }: ComponentPropsWithoutRef<"h3">) => (
      <h3
        id={id ?? slugify(nodeText(children))}
        className="text-base font-semibold text-foreground mt-6 mb-2 scroll-mt-24"
        {...props}
      >
        {children}
      </h3>
    ),
    p: (props: ComponentPropsWithoutRef<"p">) => (
      <p className="text-sm leading-relaxed text-foreground/80 my-3" {...props} />
    ),
    ul: (props: ComponentPropsWithoutRef<"ul">) => (
      <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-foreground/80 marker:text-muted" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<"ol">) => (
      <ol className="my-3 ml-5 list-decimal space-y-1.5 text-sm text-foreground/80 marker:text-muted" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<"li">) => <li className="pl-1" {...props} />,
    a: ({ href = "", ...props }: ComponentPropsWithoutRef<"a">) => {
      const isInternal = href.startsWith("/") || href.startsWith("#");
      const className =
        "text-accent-purple underline decoration-dotted underline-offset-2 hover:text-accent-purple/80 transition-colors";
      if (isInternal) {
        return <Link href={href} className={className} {...props} />;
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} {...props} />
      );
    },
    code: (props: ComponentPropsWithoutRef<"code">) => (
      <code
        className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.8125rem] text-accent-teal/90"
        {...props}
      />
    ),
    pre: (props: ComponentPropsWithoutRef<"pre">) => (
      <pre
        className="my-4 overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground/90 scrollbar-thin [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-foreground/90"
        {...props}
      />
    ),
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className="my-4 border-l-2 border-accent-purple/40 bg-surface/50 py-2 pl-4 text-sm text-muted"
        {...props}
      />
    ),
    hr: () => <hr className="my-8 border-border" />,
    table: (props: ComponentPropsWithoutRef<"table">) => (
      <div className="my-4 overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    th: (props: ComponentPropsWithoutRef<"th">) => (
      <th
        className="border border-border bg-surface px-3 py-2 text-left font-medium text-foreground"
        {...props}
      />
    ),
    td: (props: ComponentPropsWithoutRef<"td">) => (
      <td className="border border-border px-3 py-2 text-foreground/80" {...props} />
    ),
    ...components,
  };
}
