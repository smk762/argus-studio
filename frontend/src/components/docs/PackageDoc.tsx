import Link from "next/link";
import type { ComponentProps, JSX } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ExternalLink } from "@/components/ExternalLink";
import {
  packageHref,
  packageLinks,
  shortSha,
  subPages,
  type PackageDocPage,
  type PackageDocs,
} from "@/lib/packageDocs";
import { packageDoc, readPackageDoc } from "@/lib/packageDocsRender";

const LINK =
  "text-accent-purple-ink underline decoration-dotted underline-offset-2 hover:text-accent-purple-ink transition-colors";

type Props<T extends keyof JSX.IntrinsicElements> = ComponentProps<T> & { node?: unknown };

/** A heading with its GitHub id. A later `#` in the file renders as a section. */
function heading(Tag: "h2" | "h3" | "h4" | "h5" | "h6", className: string) {
  return function DocHeading({ id, children }: Props<"h2">) {
    return (
      <Tag id={id} className={`scroll-mt-24 ${className}`}>
        {children}
      </Tag>
    );
  };
}

const H2 = "text-xl font-semibold text-foreground mt-10 mb-3";

/**
 * The markdown's elements in Studio's docs tokens (as mdx-components.tsx
 * styles the hand-written pages). Only children and the props each element
 * needs are passed on: react-markdown hands every override a hast `node`, and
 * GFM's table alignment arrives as a `style`, which the CSP would refuse.
 */
const COMPONENTS = {
  h1: heading("h2", H2),
  h2: heading("h2", H2),
  h3: heading("h3", "text-base font-semibold text-foreground mt-6 mb-2"),
  h4: heading("h4", "text-sm font-semibold text-foreground mt-4 mb-2"),
  h5: heading("h5", "text-sm font-medium text-foreground mt-4 mb-1"),
  h6: heading("h6", "text-sm font-medium text-muted mt-4 mb-1"),
  p: ({ children }: Props<"p">) => <p className="my-3 text-sm leading-relaxed text-foreground/80">{children}</p>,
  a: ({ href = "", children }: Props<"a">) =>
    href.startsWith("/") && !href.startsWith("//") ? (
      <Link href={href} className={LINK}>
        {children}
      </Link>
    ) : href.startsWith("#") ? (
      <a href={href} className={LINK}>
        {children}
      </a>
    ) : (
      <ExternalLink href={href} className={LINK}>
        {children}
      </ExternalLink>
    ),
  ul: ({ children }: Props<"ul">) => (
    <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-foreground/80 marker:text-muted">{children}</ul>
  ),
  ol: ({ children }: Props<"ol">) => (
    <ol className="my-3 ml-5 list-decimal space-y-1.5 text-sm text-foreground/80 marker:text-muted">{children}</ol>
  ),
  li: ({ children }: Props<"li">) => <li className="pl-1">{children}</li>,
  strong: ({ children }: Props<"strong">) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }: Props<"em">) => <em>{children}</em>,
  del: ({ children }: Props<"del">) => <del>{children}</del>,
  blockquote: ({ children }: Props<"blockquote">) => (
    <blockquote className="my-4 border-l-2 border-accent-purple/40 bg-surface/50 py-2 pl-4 text-sm text-muted">
      {children}
    </blockquote>
  ),
  code: ({ children }: Props<"code">) => (
    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[0.8125rem] text-accent-teal-ink [overflow-wrap:anywhere]">
      {children}
    </code>
  ),
  pre: ({ children }: Props<"pre">) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground/90 scrollbar-thin [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-foreground/90 [&_code]:[overflow-wrap:normal]">
      {children}
    </pre>
  ),
  table: ({ children }: Props<"table">) => (
    <div className="my-4 overflow-x-auto scrollbar-thin">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: Props<"th">) => (
    <th className="border border-border bg-surface px-3 py-2 text-left align-top font-medium text-foreground">{children}</th>
  ),
  td: ({ children }: Props<"td">) => <td className="border border-border px-3 py-2 align-top text-foreground/80">{children}</td>,
  hr: () => <hr className="my-8 border-border" />,
  img: ({ src, alt }: Props<"img">) =>
    // eslint-disable-next-line @next/next/no-img-element -- a vendored doc image, same origin, any size
    typeof src === "string" ? <img src={src} alt={alt ?? ""} loading="lazy" className="my-4 h-auto max-w-full rounded-lg border border-border" /> : null,
};

/** "argus-lens 0.11.1.dev4+g4804154 @ 4804154", with PyPI, the source and the changelog at that commit. */
function PackageHeader({ pkg, page, title }: { pkg: PackageDocs; page: PackageDocPage | null; title: string }) {
  const links = packageLinks(pkg);
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-foreground mt-2 mb-2 [overflow-wrap:anywhere]">{title}</h1>
      <p className="text-sm text-foreground/80">
        <span className="font-mono text-[0.8125rem] text-foreground [overflow-wrap:anywhere]">
          {pkg.package} {pkg.version} @ {shortSha(pkg.commit)}
        </span>
        <span className="mx-1.5 text-muted" aria-hidden>
          ·
        </span>
        <ExternalLink href={links.pypi} className={LINK}>
          PyPI
        </ExternalLink>
        <span className="mx-1.5 text-muted" aria-hidden>
          ·
        </span>
        <ExternalLink href={links.source} className={LINK}>
          Source
        </ExternalLink>
        <span className="mx-1.5 text-muted" aria-hidden>
          ·
        </span>
        <ExternalLink href={links.changelog} className={LINK}>
          Changelog
        </ExternalLink>
      </p>
      <p className="mt-1 text-xs text-muted">
        {page ? (
          <>
            Imported from <code className="font-mono">{page.file}</code> on
          </>
        ) : (
          "Recorded from"
        )}{" "}
        {pkg.package}&apos;s <code className="font-mono">{pkg.branch}</code> branch at that commit. Fixes go upstream, not here.
      </p>
    </header>
  );
}

/** The package's other pages, listed on its README page so the sidebar keeps one entry per package. */
function PackagePages({ pkg }: { pkg: PackageDocs }) {
  const pages = subPages(pkg);
  if (pages.length === 0 && pkg.held.length === 0) return null;
  const links = packageLinks(pkg);
  return (
    <nav aria-label={`${pkg.package} pages`} className="mb-8 rounded-lg border border-border bg-surface/40 px-4 py-3">
      {pages.length > 0 ? (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">More in {pkg.package}</p>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {pages.map((page) => (
              <li key={page.slug}>
                <Link href={packageHref(pkg.short, page.slug)} className={LINK}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {pkg.held.length > 0 ? (
        <p className={`text-sm text-foreground/80 ${pages.length > 0 ? "mt-3" : ""}`}>
          Not imported yet, read on GitHub:{" "}
          {pkg.held.map((file, i) => (
            <span key={file}>
              {i > 0 ? ", " : null}
              <ExternalLink href={links.blob(file)} className={LINK}>
                {file}
              </ExternalLink>
            </span>
          ))}
          . {pkg.held.length > 1 ? "They are" : "It is"} held back until {pkg.held.length > 1 ? "they pass" : "it passes"}{" "}
          the docs opsec check upstream.
        </p>
      ) : null}
    </nav>
  );
}

/** One imported doc. A server component: the file is read and transformed on the server, never in the browser. */
function PackageArticle({ pkg, page }: { pkg: PackageDocs; page: PackageDocPage }) {
  const { plugin } = packageDoc(pkg, page);
  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm, plugin]} skipHtml components={COMPONENTS}>
        {readPackageDoc(pkg, page)}
      </ReactMarkdown>
    </div>
  );
}

/** A package's page: its README (when imported) under the version header, and the list of its other pages. */
export function PackageReadme({ pkg }: { pkg: PackageDocs }) {
  const readme = pkg.pages.find((page) => page.slug === "") ?? null;
  return (
    <>
      <PackageHeader pkg={pkg} page={readme} title={pkg.package} />
      <PackagePages pkg={pkg} />
      {readme ? <PackageArticle pkg={pkg} page={readme} /> : null}
    </>
  );
}

/** One of a package's `docs/*.md` pages under the version header. */
export function PackageSubPage({ pkg, page }: { pkg: PackageDocs; page: PackageDocPage }) {
  return (
    <>
      <PackageHeader pkg={pkg} page={page} title={page.title} />
      <PackageArticle pkg={pkg} page={page} />
    </>
  );
}
